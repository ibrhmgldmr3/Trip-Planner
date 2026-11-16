// Plan veri tipleri ve arayüz yardımcıları. Sunucu da istemci de kullanır;
// bu yüzden Prisma ya da sunucuya özel hiçbir şey içe aktarmaz.

import { tripDays, tripNights } from "./format";

/* ------------------------------ Tipler ------------------------------ */

export type PlanSource = "AI" | "MANUAL";

/** Veritabanında saklanan durum. */
export type StoredStatus = "PLANNED" | "CANCELLED" | "DONE";

/** Gösterilen durum: saklanan durum + tarihlerden hesaplanan "yolda" ve "tarihi geçti". */
export type PlanStatus = StoredStatus | "ACTIVE" | "COMPLETED";

export type DaySlot = "MORNING" | "NOON" | "EVENING";

export type BudgetCategory = "TRANSPORT" | "ACCOMMODATION" | "FOOD" | "ACTIVITIES" | "SHOPPING" | "OTHER";

export interface PlanSummary {
  id: string;
  source: PlanSource;
  status: StoredStatus;
  city: string;
  country: string | null;
  /** YYYY-AA-GG */
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  travelStyle: string | null;
  budgetLevel: string | null;
  totalCost: number | null;
  currency: string;
  createdAt: string;
  /** Planın hangi parçalarının dolu olduğu (panel kartındaki kontrol listesi). */
  checklist: PlanChecklist;
}

export interface PlanChecklist {
  transport: boolean;
  stay: boolean;
  activities: boolean;
  budget: boolean;
}

export const CHECKLIST_ITEMS: Array<{ key: keyof PlanChecklist; label: string }> = [
  { key: "transport", label: "Ulaşım" },
  { key: "stay", label: "Konaklama" },
  { key: "activities", label: "Aktiviteler" },
  { key: "budget", label: "Bütçe" },
];

export interface PlanStop {
  id: string;
  position: number;
  name: string;
  description: string | null;
  slot: DaySlot | null;
  startTime: string | null;
  endTime: string | null;
  cost: number | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlanDay {
  id: string;
  dayNumber: number;
  title: string | null;
  notes: string | null;
  isFree: boolean;
  stops: PlanStop[];
}

export interface BudgetLine {
  id: string;
  category: BudgetCategory;
  description: string;
  amount: number;
  isPaid: boolean;
}

export interface TransportChoice {
  type?: string;
  provider?: string;
  price?: number;
  duration?: string;
  departure?: string;
  arrival?: string;
}

export interface AccommodationChoice {
  name?: string;
  type?: string;
  price?: number;
  location?: string;
}

export interface PlanDetail extends PlanSummary {
  latitude: number | null;
  longitude: number | null;
  interests: string[];
  transportPrefs: string[];
  stayPreference: string | null;
  specialRequests: string | null;
  cityGuide: string | null;
  foodGuide: string | null;
  practicalInfo: string | null;
  transport: TransportChoice | null;
  accommodation: AccommodationChoice | null;
  targetBudget: number | null;
  days: PlanDay[];
  /** Planın öngördüğü giderler. */
  estimates: BudgetLine[];
  /** Kullanıcının kaydettiği gerçek harcamalar. */
  expenses: BudgetLine[];
  /** Yapılandırılmış veriye geçmeden önce üretilmiş planların metinleri. */
  legacy: { dayPlan: string | null; budget: string | null; raw: string | null } | null;
}

/* ------------------------------ Durum ------------------------------ */

/** "YYYY-AA-GG" değerini yerel gün olarak okur (saat dilimi kayması olmaz). */
function localDay(value: string | Date): number {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  }
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Saklanan durum ile tarihleri birleştirip gösterilecek durumu verir. */
export function effectiveStatus(
  plan: { startDate?: string | null; endDate?: string | null; status?: StoredStatus | null },
  now: Date = new Date()
): PlanStatus {
  if (plan.status === "CANCELLED" || plan.status === "DONE") return plan.status;
  if (!plan.startDate || !plan.endDate) return "PLANNED";

  const today = localDay(now);
  if (today < localDay(plan.startDate)) return "PLANNED";
  if (today <= localDay(plan.endDate)) return "ACTIVE";
  return "COMPLETED";
}

export const STATUS_LABEL: Record<PlanStatus, string> = {
  PLANNED: "Planlandı",
  ACTIVE: "Yolda",
  COMPLETED: "Tarihi geçti",
  CANCELLED: "İptal edildi",
  DONE: "Gerçekleşti",
};

export const canCancel = (status: PlanStatus) => status === "PLANNED" || status === "ACTIVE";
export const canRestore = (status: PlanStatus) => status === "CANCELLED";

/** Tarihi geçmiş ya da tarihsiz planlar "gerçekleşti" olarak işaretlenebilir. */
export function canMarkDone(plan: { startDate?: string | null; endDate?: string | null; status?: StoredStatus | null }) {
  const status = effectiveStatus(plan);
  if (status === "COMPLETED") return true;
  return status === "PLANNED" && (!plan.startDate || !plan.endDate);
}

/* ----------------------------- Etiketler ---------------------------- */

const STYLE_LABEL: Record<string, string> = {
  budget: "Ekonomik",
  standard: "Standart",
  luxury: "Lüks",
  adventure: "Macera",
  cultural: "Kültürel",
};

export function styleLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return STYLE_LABEL[value.toLowerCase()] ?? value;
}

export const SLOT_LABEL: Record<DaySlot, string> = {
  MORNING: "Sabah",
  NOON: "Öğle",
  EVENING: "Akşam",
};

/* ------------------------------ Bütçe ------------------------------ */

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  "TRANSPORT",
  "ACCOMMODATION",
  "FOOD",
  "ACTIVITIES",
  "SHOPPING",
  "OTHER",
];

export const BUDGET_LABEL: Record<BudgetCategory, string> = {
  TRANSPORT: "Ulaşım",
  ACCOMMODATION: "Konaklama",
  FOOD: "Yeme-içme",
  ACTIVITIES: "Aktiviteler",
  SHOPPING: "Alışveriş",
  OTHER: "Diğer",
};

/** Kategori renkleri (CSS değişkenleri). */
export const BUDGET_COLOR: Record<BudgetCategory, string> = {
  TRANSPORT: "var(--brand)",
  ACCOMMODATION: "var(--accent)",
  FOOD: "var(--amber)",
  ACTIVITIES: "var(--mint)",
  SHOPPING: "var(--rose)",
  OTHER: "var(--ink-3)",
};

export function sumByCategory(
  lines: Array<{ category: BudgetCategory; amount: number }>
): Array<{ category: BudgetCategory; total: number }> {
  const totals = new Map<BudgetCategory, number>();
  for (const line of lines) {
    totals.set(line.category, (totals.get(line.category) ?? 0) + line.amount);
  }
  return BUDGET_CATEGORIES.filter((category) => totals.has(category)).map((category) => ({
    category,
    total: totals.get(category) ?? 0,
  }));
}

export const sumAmounts = (lines: Array<{ amount: number }>) => lines.reduce((sum, line) => sum + line.amount, 0);

/** Manuel planın bütçesini hesaplamak için gereken alanlar (form taslağı ve doğrulanmış istek ikisi de uyar). */
export interface ManualBudgetInput {
  startDate: string;
  endDate: string;
  transport?: { price: number } | null;
  /** `price` gecelik fiyattır. */
  accommodation?: { price: number } | null;
  days: Array<{ isFree: boolean; stops: Array<{ cost: number }> }>;
  foodPerDay: number;
  otherCost: number;
}

/**
 * Manuel planın bütçe dökümü. Planlayıcıdaki önizleme de, sunucudaki kayıt da bu
 * işlevi kullanır; kullanıcının gördüğü toplam ile kaydedilen toplam ayrışamaz.
 */
export function manualBudget(input: ManualBudgetInput) {
  const dayCount = tripDays(input.startDate, input.endDate);
  const nights = tripNights(input.startDate, input.endDate);
  const activities = input.days.reduce(
    (sum, day) => (day.isFree ? sum : sum + day.stops.reduce((total, stop) => total + stop.cost, 0)),
    0
  );

  const lines: Array<{ category: BudgetCategory; description: string; amount: number }> = [
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

/* --------------------- Eski (metin tabanlı) planlar ------------------- */
// Yapılandırılmış veriye geçmeden önce üretilen AI planları serbest metin olarak
// saklanıyordu. Aşağıdaki yardımcılar yalnızca o planları gösterebilmek içindir.

/** Bölüm kendi başlığıyla gösterileceği için metnin ilk satırındaki markdown başlığını atar. */
export function stripLeadingHeading(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return markdown.replace(/^\s*(?:#{1,6}\s+[^\n]*|\*\*[^*\n]+\*\*:?)\s*\n+/, "").trim();
}

export interface DaySection {
  day: number | null;
  title: string;
  body: string;
}

// "## 1. Gün: Tarihi Yarımada", "**Gün 2 – Boğaz**", "### 3. Gün (23 Ağustos)".
// Gün ifadesi başlığın başında aranır; gövdede geçen "2. gün için…" gibi
// cümleler yeni gün sayılmaz.
const DAY_HEADING =
  /^\s{0,3}(?:#{1,6}\s*|\*\*\s*)(.{0,24}?(?:(\d{1,2})\s*\.\s*g[üu]n(?!l[üu]k)|g[üu]n\s*(\d{1,2})).*)$/i;

function cleanHeading(text: string): string {
  return text
    .replace(/^[#\s*]+/, "")
    .replace(/\*\*/g, "")
    .replace(/[:\s]+$/, "")
    .trim();
}

/** Eski AI planlarının markdown günlük programını gün gün böler. */
export function splitMarkdownDays(markdown: string | null | undefined): DaySection[] {
  if (!markdown) return [];

  const sections: DaySection[] = [];
  let current: DaySection | null = null;

  for (const line of markdown.split("\n")) {
    if (/^\s*-{3,}\s*$/.test(line)) continue;

    const match = line.match(DAY_HEADING);
    if (match) {
      current = {
        day: parseInt(match[2] ?? match[3], 10),
        title: cleanHeading(match[1]),
        body: "",
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { day: null, title: "", body: "" };
      sections.push(current);
    }
    current.body += line + "\n";
  }

  const cleaned = sections
    .map((section) => ({ ...section, body: section.body.trim() }))
    // Gün başlığından önceki giriş bölümü yalnızca başlıktan ibaretse ("## Günlük Program") atılır.
    .filter((section) => section.day !== null || section.body.replace(/^\s*#{1,6}\s.*$/gm, "").trim() !== "");

  const hasDays = cleaned.some((section) => section.day !== null);
  if (!hasDays) return [{ day: null, title: "", body: markdown.trim() }];
  return cleaned;
}

const CATEGORY_KEYWORDS: Array<[BudgetCategory, RegExp]> = [
  ["ACCOMMODATION", /konakla|otel|hostel|pansiyon|apart|airbnb|gecelik/i],
  ["TRANSPORT", /ula[şs][ıi]m|u[çc]ak|u[çc]u[şs]|otob[üu]s|tren|taksi|transfer|metro|vapur|yak[ıi]t|ara[çc] kira/i],
  ["FOOD", /yeme|yemek|restoran|kahvalt[ıi]|i[çc]ecek|kafe|lokanta/i],
  ["ACTIVITIES", /aktivite|m[üu]ze|giri[şs]|bilet|tur\b|gezi|etkinlik|rehber/i],
  ["SHOPPING", /al[ıi][şs]veri[şs]|hediyelik|[çc]ar[şs][ıi]/i],
];

const AMOUNT =
  /(?:₺\s*(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?)|(?:(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?\s*(?:₺|TL\b|TRY\b|lira))/gi;

function categoryOf(text: string): BudgetCategory | null {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

/** Eski AI planlarının serbest metin bütçesinden kalem çıkarır (en iyi çaba). */
export function parseLegacyBudget(value: string | null | undefined): BudgetLine[] {
  if (!value) return [];

  const lines: BudgetLine[] = [];
  let heading: BudgetCategory | null = null;

  value.split("\n").forEach((raw, index) => {
    const text = raw
      .replace(/[*_`#>]/g, "")
      .replace(/^\s*[-•]\s*/, "")
      .trim();
    if (!text) return;

    const matches = [...text.matchAll(AMOUNT)];
    if (matches.length === 0) {
      const found = categoryOf(text);
      if (found && text.length < 60) heading = found;
      return;
    }
    if (/toplam|genel tahmin|ortalama/i.test(text)) return;

    const last = matches[matches.length - 1];
    const amount = parseInt((last[1] ?? last[2]).replace(/[.\s]/g, ""), 10) || 0;
    if (amount <= 0) return;

    const cells = text
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    const description = (cells.length > 1 ? cells[0] : text.replace(AMOUNT, ""))
      .replace(/[:\-–—~≈()\s]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    lines.push({
      id: `legacy-${index}`,
      category: categoryOf(text) ?? heading ?? "OTHER",
      description: description || "Tahmini gider",
      amount,
      isPaid: false,
    });
  });

  return lines;
}
