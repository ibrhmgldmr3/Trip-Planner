import { z } from "zod";
import type { BudgetCategory, DaySlot } from "@/lib/plan";

// Dil modelinin döndürdüğü planın şeması. Modeller biçimde küçük sapmalar
// yaptığı için şema hoşgörülüdür: sayılar metinden çevrilir, tanınmayan
// değerler atılır, uzunluklar kırpılır. Yapı bozuksa plan reddedilir.

const clip = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z
      .string()
      .transform((value) => value.trim().slice(0, max))
  );

const optionalClip = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? undefined : typeof value === "number" ? String(value) : value),
    z
      .string()
      .transform((value) => value.trim().slice(0, max) || undefined)
      .optional()
  );

/** "1.250", "1250 TL", 1250 → 1250; anlaşılmazsa undefined. */
const looseNumber = z.preprocess((value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "");
    if (!cleaned) return undefined;
    // Türkçe yazım: nokta binlik, virgül ondalık.
    const normalized = /,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/[.,](?=\d{3}\b)/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}, z.number().optional());

const SLOTS: Record<string, DaySlot> = {
  morning: "MORNING",
  sabah: "MORNING",
  noon: "NOON",
  afternoon: "NOON",
  ogle: "NOON",
  öğle: "NOON",
  öğlen: "NOON",
  evening: "EVENING",
  night: "EVENING",
  aksam: "EVENING",
  akşam: "EVENING",
};

const slot = z.preprocess(
  (value) => (typeof value === "string" ? SLOTS[value.trim().toLocaleLowerCase("tr-TR")] : undefined),
  z.enum(["MORNING", "NOON", "EVENING"]).optional()
);

const CATEGORIES: Record<string, BudgetCategory> = {
  transport: "TRANSPORT",
  ulaşım: "TRANSPORT",
  accommodation: "ACCOMMODATION",
  konaklama: "ACCOMMODATION",
  food: "FOOD",
  yemek: "FOOD",
  "yeme-içme": "FOOD",
  activities: "ACTIVITIES",
  activity: "ACTIVITIES",
  aktiviteler: "ACTIVITIES",
  shopping: "SHOPPING",
  alışveriş: "SHOPPING",
  other: "OTHER",
  diğer: "OTHER",
};

const budgetCategory = z.preprocess(
  (value) => (typeof value === "string" ? (CATEGORIES[value.trim().toLocaleLowerCase("tr-TR")] ?? "OTHER") : "OTHER"),
  z.enum(["TRANSPORT", "ACCOMMODATION", "FOOD", "ACTIVITIES", "SHOPPING", "OTHER"])
);

const time = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}, z.string().optional());

const stopSchema = z.object({
  name: clip(120).pipe(z.string().min(1)),
  description: optionalClip(500),
  slot,
  time,
  category: optionalClip(40),
  estimatedCost: looseNumber,
  lat: looseNumber,
  lng: looseNumber,
});

const daySchema = z.object({
  day: looseNumber,
  title: optionalClip(120),
  // Bozuk duraklar günü geçersiz kılmasın: ayrıştırılamayanlar atılır.
  stops: z
    .array(z.unknown())
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = stopSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    )
    .transform((items) => items.slice(0, 8)),
});

const budgetSchema = z.object({
  category: budgetCategory,
  description: clip(160).pipe(z.string().min(1)),
  amount: looseNumber.pipe(z.number().positive().max(100_000_000)),
});

export const aiPlanSchema = z.object({
  cityGuide: optionalClip(6000),
  foodGuide: optionalClip(6000),
  practicalInfo: optionalClip(6000),
  days: z
    .array(daySchema)
    .transform((days) => days.filter((day) => day.stops.length > 0).slice(0, 31))
    .refine((days) => days.length > 0, "Planda en az bir günün durakları olmalı"),
  budget: z
    .array(z.unknown())
    .default([])
    .transform((items) =>
      items
        .flatMap((item) => {
          const parsed = budgetSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
        .slice(0, 24)
    ),
});

export type AiPlan = z.infer<typeof aiPlanSchema>;

/**
 * Model yanıtından JSON nesnesini ayıklar: düşünme bloklarını ve kod çitlerini
 * atar, ilk "{" ile son "}" arasını alır.
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Yanıtta JSON nesnesi bulunamadı");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Ham model çıktısını doğrulanmış plana çevirir; bozuksa hata fırlatır. */
export function parseAiPlan(text: string): AiPlan {
  return aiPlanSchema.parse(extractJson(text));
}
