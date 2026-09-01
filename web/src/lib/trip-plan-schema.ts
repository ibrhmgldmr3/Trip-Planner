import { z } from "zod";

/**
 * Modelden beklenen yapılandırılmış seyahat planı.
 *
 * Tasarım kuralları:
 * - OpenRouter'ın `strict: true` modu şemadaki TÜM alanların `required` ve
 *   `additionalProperties: false` olmasını istiyor. Bu yüzden `.optional()`
 *   kullanmıyoruz. `.nullable()` da kullanmıyoruz: bazı sağlayıcılar
 *   `anyOf`/`type: [...]` üretimini reddediyor. Boş bırakılabilen alanlar
 *   boş string ya da 0 olarak isteniyor.
 * - Şemayı olabildiğince küçük tutuyoruz: `id`, `date`, `isEmpty`,
 *   `suggestedBudget` gibi türetilebilir alanları modelden istemiyoruz,
 *   sunucuda üretiyoruz (bkz. trip-plan-serialize.ts).
 * - Sıkı `regex` kısıtı koymuyoruz; şema doğrulaması bir plan reddetmenin
 *   maliyeti yüzünden bilerek hoşgörülü. Normalizasyon sunucuda yapılıyor.
 */

export const TRIP_PLAN_SCHEMA_VERSION = 1;

/** budget/page.tsx ve plan-detail'in tanıdığı kategori anahtarları. */
export const BUTCE_KATEGORILERI = ["ulaşım", "konaklama", "yemek", "aktiviteler", "diğer"] as const;

/** Aktivite kategorileri; daily-planner'daki seçim listesiyle uyumlu. */
export const AKTIVITE_KATEGORILERI = [
  "ulaşım",
  "konaklama",
  "yemek",
  "aktiviteler",
  "alışveriş",
  "eğlence",
  "kültür",
  "gezi",
  "diğer",
] as const;

export const activityInputSchema = z.object({
  name: z.string().max(160),
  // "09:00" bekleniyor ama biçim zorlanmıyor; normalizasyon sunucuda.
  startTime: z.string().max(16),
  endTime: z.string().max(16),
  description: z.string().max(600),
  location: z.string().max(200),
  category: z.enum(AKTIVITE_KATEGORILERI),
  /** TRY cinsinden tahmini maliyet. Ücretsizse 0. */
  cost: z.number().min(0).max(10_000_000),
});

export const dayPlanInputSchema = z.object({
  day: z.number().int().min(1).max(60),
  title: z.string().max(160),
  activities: z.array(activityInputSchema).max(12),
  notes: z.string().max(1000),
});

export const budgetItemInputSchema = z.object({
  description: z.string().max(200),
  amount: z.number().min(0).max(10_000_000),
  /**
   * Tutarın dayandığı kaynak bağlantısı (agentic yolda `get_hotel_prices` /
   * `get_transport_prices` sonuçlarından geliyor). Bilgi yoksa boş string.
   *
   * NEDEN `.default("")` ve `.url()` DEĞİL:
   *  - `.optional()` kullanılamıyor; strict modda tüm alanlar `required`
   *    olmalı (dosya başındaki tasarım kuralı). `.default("")` ise JSON
   *    Schema'da alanı `required` bırakıyor AMA Zod tarafında eksik gelen
   *    yanıtı da kabul ediyor — yani `json_object`/düz prompt
   *    stratejilerinde alanı atlayan modeller yüzünden plan reddedilmiyor.
   *  - `.url()` burada değil, serileştirmede uygulanıyor: geçersiz bir URL
   *    yüzünden koca bir planı çöpe atmak yerine o alan sessizce
   *    düşürülüyor (bkz. plan-budget.ts `guvenliKaynakUrl`).
   */
  source: z.string().max(300).default(""),
});

export const budgetCategoryInputSchema = z.object({
  items: z.array(budgetItemInputSchema).max(20),
  total: z.number().min(0).max(100_000_000),
});

export const budgetInputSchema = z.object({
  // Sabit anahtarlı object (record değil): strict modda modelin uydurma
  // kategori üretmesini engelliyor ve budget sayfasının anahtarlarıyla uyuşuyor.
  categories: z.object({
    "ulaşım": budgetCategoryInputSchema,
    "konaklama": budgetCategoryInputSchema,
    "yemek": budgetCategoryInputSchema,
    "aktiviteler": budgetCategoryInputSchema,
    "diğer": budgetCategoryInputSchema,
  }),
  total: z.number().min(0).max(100_000_000),
  dailyAverage: z.number().min(0).max(10_000_000),
});

export const cityInfoInputSchema = z.object({
  summary: z.string().max(1500),
  population: z.string().max(60),
  climate: z.string().max(200),
  currency: z.string().max(60),
  bestTimeToVisit: z.string().max(200),
});

export const restaurantInputSchema = z.object({
  name: z.string().max(120),
  cuisine: z.string().max(80),
  priceRange: z.enum(["ucuz", "orta", "pahalı"]),
  note: z.string().max(300),
});

export const foodGuideInputSchema = z.object({
  restaurants: z.array(restaurantInputSchema).max(12),
  localDishes: z.array(z.string().max(120)).max(12),
  budgetTips: z.array(z.string().max(200)).max(8),
});

export const practicalInfoInputSchema = z.object({
  transportation: z.array(z.string().max(300)).max(10),
  safety: z.array(z.string().max(300)).max(10),
  notes: z.array(z.string().max(300)).max(10),
});

export const tripPlanStructuredSchema = z.object({
  city: z.string().max(80),
  country: z.string().max(80),
  durationDays: z.number().int().min(1).max(60),
  cityInfo: cityInfoInputSchema,
  days: z.array(dayPlanInputSchema).min(1).max(30),
  foodGuide: foodGuideInputSchema,
  practicalInfo: practicalInfoInputSchema,
  budget: budgetInputSchema,
});

export type TripPlanStructured = z.infer<typeof tripPlanStructuredSchema>;
export type TripPlanDayInput = z.infer<typeof dayPlanInputSchema>;
export type TripPlanBudgetInput = z.infer<typeof budgetInputSchema>;

/**
 * OpenRouter `response_format.json_schema` için JSON Schema üretir.
 *
 * Zod 4 `required` listesini ve `additionalProperties: false`'ı kendisi
 * üretiyor. `$schema` anahtarını bazı sağlayıcılar reddettiği için siliyoruz.
 */
export function tripPlanJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(tripPlanStructuredSchema, {
    target: "draft-7",
  }) as Record<string, unknown>;

  delete schema.$schema;
  return schema;
}
