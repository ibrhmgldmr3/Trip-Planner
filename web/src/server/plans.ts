import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tripDays, tripNights } from "@/lib/format";
import type {
  AccommodationChoice,
  BudgetLine,
  PlanDetail,
  PlanSummary,
  StoredStatus,
  TransportChoice,
} from "@/lib/plan";
import { ApiError } from "./api";
import { DEFAULT_AI_DAYS, generatePlan } from "./ai/generate";
import { geocodeCity, sanitizeStopCoordinates } from "./geo";
import { MAX_AI_DAYS, MAX_PLAN_DAYS, type GeneratePlanInput, type ManualPlanInput } from "./validation";

/* --------------------------- Dönüştürme ---------------------------- */

const toISODate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
const toDbDate = (value: string | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

const summarySelect = {
  id: true,
  source: true,
  status: true,
  city: true,
  country: true,
  startDate: true,
  endDate: true,
  travelers: true,
  travelStyle: true,
  budgetLevel: true,
  totalCost: true,
  currency: true,
  createdAt: true,
  // Kontrol listesi için: seçilen ulaşım/konaklama, tahmin kategorileri, durak sayıları.
  transport: true,
  accommodation: true,
  legacyDayPlan: true,
  budgetLines: { select: { kind: true, category: true } },
  days: { select: { _count: { select: { stops: true } } } },
} satisfies Prisma.PlanSelect;

type SummaryRow = Prisma.PlanGetPayload<{ select: typeof summarySelect }>;

/** Özet için gereken ortak alanlar; hem liste hem ayrıntı sorgusundan türetilir. */
type SummarySource = Omit<SummaryRow, "budgetLines" | "days"> & {
  budgetLines: Array<{ kind: string; category: BudgetLine["category"] }>;
  stopCount: number;
};

function toSummary(row: SummarySource): PlanSummary {
  const estimated = new Set(row.budgetLines.filter((line) => line.kind === "ESTIMATE").map((line) => line.category));
  return {
    checklist: {
      transport: row.transport !== null || estimated.has("TRANSPORT"),
      stay: row.accommodation !== null || estimated.has("ACCOMMODATION"),
      activities: row.stopCount > 0 || !!row.legacyDayPlan,
      budget: estimated.size > 0 || row.totalCost !== null,
    },
    id: row.id,
    source: row.source,
    status: row.status,
    city: row.city,
    country: row.country,
    startDate: toISODate(row.startDate),
    endDate: toISODate(row.endDate),
    travelers: row.travelers,
    travelStyle: row.travelStyle,
    budgetLevel: row.budgetLevel,
    totalCost: row.totalCost,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

const fromSummaryRow = (row: SummaryRow): PlanSummary =>
  toSummary({ ...row, stopCount: row.days.reduce((sum, day) => sum + day._count.stops, 0) });

const detailInclude = {
  days: {
    orderBy: { dayNumber: "asc" },
    include: { stops: { orderBy: { position: "asc" } } },
  },
  budgetLines: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.PlanInclude;

type DetailRow = Prisma.PlanGetPayload<{ include: typeof detailInclude }>;

const toLine = (line: DetailRow["budgetLines"][number]): BudgetLine => ({
  id: line.id,
  category: line.category,
  description: line.description,
  amount: line.amount,
  isPaid: line.isPaid,
});

function toDetail(row: DetailRow): PlanDetail {
  const hasLegacy = row.legacyDayPlan || row.legacyBudget || row.legacyRaw;
  return {
    ...toSummary({ ...row, stopCount: row.days.reduce((sum, day) => sum + day.stops.length, 0) }),
    latitude: row.latitude,
    longitude: row.longitude,
    interests: row.interests,
    transportPrefs: row.transportPrefs,
    stayPreference: row.stayPreference,
    specialRequests: row.specialRequests,
    cityGuide: row.cityGuide,
    foodGuide: row.foodGuide,
    practicalInfo: row.practicalInfo,
    transport: (row.transport as TransportChoice | null) ?? null,
    accommodation: (row.accommodation as AccommodationChoice | null) ?? null,
    targetBudget: row.targetBudget,
    days: row.days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      title: day.title,
      notes: day.notes,
      isFree: day.isFree,
      stops: day.stops.map((stop) => ({
        id: stop.id,
        position: stop.position,
        name: stop.name,
        description: stop.description,
        slot: stop.slot,
        startTime: stop.startTime,
        endTime: stop.endTime,
        cost: stop.cost,
        category: stop.category,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    })),
    estimates: row.budgetLines.filter((line) => line.kind === "ESTIMATE").map(toLine),
    expenses: row.budgetLines.filter((line) => line.kind === "EXPENSE").map(toLine),
    legacy: hasLegacy ? { dayPlan: row.legacyDayPlan, budget: row.legacyBudget, raw: row.legacyRaw } : null,
  };
}

/* ----------------------------- Okuma ------------------------------- */

export async function listPlans(userId: string, status?: StoredStatus): Promise<PlanSummary[]> {
  const rows = await prisma.plan.findMany({
    where: { userId, ...(status ? { status } : {}) },
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(fromSummaryRow);
}

/** Planı sahibine göre getirir; başkasının planı "bulunamadı" sayılır. */
export async function getPlan(userId: string, planId: string): Promise<PlanDetail> {
  const row = await prisma.plan.findFirst({ where: { id: planId, userId }, include: detailInclude });
  if (!row) throw new ApiError(404, "Plan bulunamadı.");
  return toDetail(row);
}

async function assertOwner(userId: string, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId },
    select: { id: true, status: true, endDate: true },
  });
  if (!plan) throw new ApiError(404, "Plan bulunamadı.");
  return plan;
}

/* ---------------------------- AI planı ----------------------------- */

const AI_PLANS_PER_HOUR = 10;
const generating = new Set<string>();

export async function createAiPlan(userId: string, input: GeneratePlanInput): Promise<string> {
  const dayCount = input.startDate && input.endDate ? tripDays(input.startDate, input.endDate) : DEFAULT_AI_DAYS;
  if (dayCount > MAX_AI_DAYS) {
    throw new ApiError(400, `AI ile en fazla ${MAX_AI_DAYS} günlük plan oluşturulabilir. Daha uzun geziler için tarihi daralt.`);
  }

  // Saatlik kota: sayaç veritabanından okunur, sunucu yeniden başlasa da korunur.
  const recent = await prisma.plan.count({
    where: { userId, source: "AI", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= AI_PLANS_PER_HOUR) {
    throw new ApiError(429, "Bir saat içinde çok fazla plan oluşturdun. Lütfen biraz sonra tekrar dene.", {
      "Retry-After": "900",
    });
  }

  // Aynı kullanıcının üst üste gönderdiği istekler tek üretime indirilir.
  if (generating.has(userId)) {
    throw new ApiError(409, "Zaten hazırlanan bir planın var. Bitmesini bekle.");
  }
  generating.add(userId);

  try {
    const [generated, center] = await Promise.all([
      generatePlan(input, dayCount),
      geocodeCity(input.city, input.country),
    ]);
    const { plan: ai, model } = generated;

    const totalCost = ai.budget.reduce((sum, line) => sum + line.amount, 0);

    const created = await prisma.plan.create({
      data: {
        userId,
        source: "AI",
        city: input.city,
        country: input.country ?? null,
        latitude: center?.latitude ?? null,
        longitude: center?.longitude ?? null,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
        travelers: input.travelers,
        travelStyle: input.travelStyle ?? null,
        budgetLevel: input.budgetLevel ?? null,
        interests: input.interests,
        transportPrefs: input.transportPrefs,
        stayPreference: input.stayPreference ?? null,
        specialRequests: input.specialRequests ?? null,
        cityGuide: ai.cityGuide ?? null,
        foodGuide: ai.foodGuide ?? null,
        practicalInfo: ai.practicalInfo ?? null,
        totalCost: totalCost > 0 ? totalCost : null,
        targetBudget: input.budgetAmount ?? null,
        aiModel: model,
        days: {
          // Model gün numaralarını atlayabilir ya da fazla gün yazabilir:
          // sıra esas alınır ve istenen gün sayısıyla sınırlanır.
          create: ai.days.slice(0, dayCount).map((day, dayIndex) => ({
            dayNumber: dayIndex + 1,
            title: day.title ?? null,
            stops: {
              create: day.stops.map((stop, position) => {
                const point = sanitizeStopCoordinates(stop.lat, stop.lng, center);
                return {
                  position,
                  name: stop.name,
                  description: stop.description ?? null,
                  slot: stop.slot ?? null,
                  startTime: stop.time ?? null,
                  cost: stop.estimatedCost !== undefined && stop.estimatedCost >= 0 ? stop.estimatedCost : null,
                  category: stop.category ?? null,
                  latitude: point?.latitude ?? null,
                  longitude: point?.longitude ?? null,
                };
              }),
            },
          })),
        },
        budgetLines: {
          create: ai.budget.map((line) => ({
            kind: "ESTIMATE" as const,
            category: line.category,
            description: line.description,
            amount: line.amount,
          })),
        },
      },
      select: { id: true },
    });

    return created.id;
  } finally {
    generating.delete(userId);
  }
}

/* --------------------------- Manuel plan ---------------------------- */

/** "10:00" → "12:30" arası süre; varış daha erkense ertesi gün sayılır. */
function travelDuration(departure?: string, arrival?: string): string | undefined {
  if (!departure || !arrival) return undefined;
  const [dh, dm] = departure.split(":").map(Number);
  const [ah, am] = arrival.split(":").map(Number);
  let minutes = ah * 60 + am - (dh * 60 + dm);
  if (minutes < 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dk`;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

/**
 * Manuel planın bütçe dökümü. Tutarlar istemciden alınmaz; girilen kalemlerden
 * sunucuda hesaplanır.
 */
export function manualBudget(input: ManualPlanInput) {
  const dayCount = tripDays(input.startDate, input.endDate);
  const nights = tripNights(input.startDate, input.endDate);
  const activities = input.days.reduce(
    (sum, day) => (day.isFree ? sum : sum + day.stops.reduce((total, stop) => total + stop.cost, 0)),
    0
  );

  const lines = [
    { category: "TRANSPORT" as const, description: "Ulaşım", amount: input.transport?.price ?? 0 },
    {
      category: "ACCOMMODATION" as const,
      description: nights > 0 ? `Konaklama (${nights} gece)` : "Konaklama",
      amount: (input.accommodation?.price ?? 0) * nights,
    },
    { category: "ACTIVITIES" as const, description: "Aktiviteler", amount: activities },
    { category: "FOOD" as const, description: `Yeme-içme (${dayCount} gün)`, amount: input.foodPerDay * dayCount },
    { category: "OTHER" as const, description: "Diğer giderler", amount: input.otherCost },
  ].filter((line) => line.amount > 0);

  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0), dayCount };
}

export async function createManualPlan(userId: string, input: ManualPlanInput): Promise<string> {
  const { lines, total, dayCount } = manualBudget(input);
  if (dayCount > MAX_PLAN_DAYS) {
    throw new ApiError(400, `Bir plan en fazla ${MAX_PLAN_DAYS} gün olabilir.`);
  }

  const center = await geocodeCity(input.city, input.country);

  const transport: TransportChoice | null = input.transport
    ? {
        type: input.transport.type,
        provider: input.transport.provider,
        price: input.transport.price,
        departure: input.transport.departure,
        arrival: input.transport.arrival,
        duration: travelDuration(input.transport.departure, input.transport.arrival),
      }
    : null;

  const accommodation: AccommodationChoice | null = input.accommodation
    ? {
        type: input.accommodation.type,
        name: input.accommodation.name ?? input.accommodation.type,
        location: input.accommodation.location,
        price: input.accommodation.price,
      }
    : null;

  const created = await prisma.plan.create({
    data: {
      userId,
      source: "MANUAL",
      city: input.city,
      country: input.country ?? null,
      latitude: center?.latitude ?? null,
      longitude: center?.longitude ?? null,
      startDate: toDbDate(input.startDate),
      endDate: toDbDate(input.endDate),
      travelers: input.travelers,
      travelStyle: input.travelStyle ?? null,
      transport: (transport ?? undefined) as Prisma.InputJsonValue | undefined,
      accommodation: (accommodation ?? undefined) as Prisma.InputJsonValue | undefined,
      totalCost: total > 0 ? total : null,
      targetBudget: input.targetBudget ?? null,
      days: {
        // Gün sayısı tarihlerden gelir; eksik günler boş, fazlası yok sayılır.
        create: Array.from({ length: dayCount }, (_, index) => {
          const day = input.days[index];
          return {
            dayNumber: index + 1,
            notes: day?.notes ?? null,
            isFree: day?.isFree ?? false,
            stops: {
              create: (day?.isFree ? [] : (day?.stops ?? [])).map((stop, position) => ({
                position,
                name: stop.name,
                description: stop.description ?? null,
                startTime: stop.startTime ?? null,
                endTime: stop.endTime ?? null,
                cost: stop.cost > 0 ? stop.cost : null,
              })),
            },
          };
        }),
      },
      budgetLines: {
        create: lines.map((line) => ({ kind: "ESTIMATE" as const, ...line })),
      },
    },
    select: { id: true },
  });

  return created.id;
}

/* ------------------------- Durum ve silme -------------------------- */

export async function updatePlanStatus(userId: string, planId: string, next: StoredStatus): Promise<PlanSummary> {
  const plan = await assertOwner(userId, planId);

  if (plan.status === next) {
    throw new ApiError(409, "Plan zaten bu durumda.");
  }
  if (next === "CANCELLED" && plan.status === "DONE") {
    throw new ApiError(409, "Gerçekleşmiş bir gezi iptal edilemez.");
  }
  if (next === "PLANNED" && plan.status !== "CANCELLED") {
    throw new ApiError(409, "Yalnızca iptal edilmiş planlar geri alınabilir.");
  }
  if (next === "DONE") {
    if (plan.status === "CANCELLED") {
      throw new ApiError(409, "İptal edilmiş plan gerçekleşti olarak işaretlenemez.");
    }
    // Tarihi olan planlar bitiş gününden önce "gerçekleşti" yapılamaz. Karşılaştırma
    // UTC gününe göredir; saat dilimi farkı için bitiş günü de kabul edilir.
    if (plan.endDate && plan.endDate.getTime() > Date.now()) {
      throw new ApiError(409, "Gezi henüz bitmedi; tarihi geçince gerçekleşti olarak işaretleyebilirsin.");
    }
  }

  const updated = await prisma.plan.update({
    where: { id: planId },
    data: { status: next, completedAt: next === "DONE" ? new Date() : null },
    select: summarySelect,
  });
  return fromSummaryRow(updated);
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  // Sahiplik koşulu sorgunun içinde: başkasının planı silinemez.
  const result = await prisma.plan.deleteMany({ where: { id: planId, userId } });
  if (result.count === 0) throw new ApiError(404, "Plan bulunamadı.");
}

/* ---------------------------- Harcamalar ---------------------------- */

const EXPENSES_PER_PLAN = 500;

export async function addExpense(
  userId: string,
  planId: string,
  data: { category: BudgetLine["category"]; description: string; amount: number }
): Promise<BudgetLine> {
  await assertOwner(userId, planId);

  const count = await prisma.budgetLine.count({ where: { planId, kind: "EXPENSE" } });
  if (count >= EXPENSES_PER_PLAN) {
    throw new ApiError(400, "Bu plan için harcama sınırına ulaşıldı.");
  }

  const line = await prisma.budgetLine.create({ data: { planId, kind: "EXPENSE", ...data } });
  return toLine(line);
}

async function findExpense(userId: string, planId: string, expenseId: string) {
  const line = await prisma.budgetLine.findFirst({
    where: { id: expenseId, planId, kind: "EXPENSE", plan: { userId } },
    select: { id: true },
  });
  if (!line) throw new ApiError(404, "Harcama bulunamadı.");
  return line;
}

export async function updateExpense(
  userId: string,
  planId: string,
  expenseId: string,
  data: Partial<{ category: BudgetLine["category"]; description: string; amount: number; isPaid: boolean }>
): Promise<BudgetLine> {
  await findExpense(userId, planId, expenseId);
  const line = await prisma.budgetLine.update({ where: { id: expenseId }, data });
  return toLine(line);
}

export async function deleteExpense(userId: string, planId: string, expenseId: string): Promise<void> {
  await findExpense(userId, planId, expenseId);
  await prisma.budgetLine.delete({ where: { id: expenseId } });
}
