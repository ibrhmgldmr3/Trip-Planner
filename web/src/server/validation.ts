import { z } from "zod";

// İstek gövdeleri için şemalar. Tüm metin alanları kırpılır ve uzunlukları sınırlanır.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Geçersiz tarih");

const optionalDate = z.preprocess((value) => (value === "" || value === null ? undefined : value), isoDate.optional());

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z.preprocess((value) => (value === null ? undefined : value), text(max).optional()).transform((value) => value || undefined);

const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .default([])
  .transform((items) => [...new Set(items)]);

const money = z.coerce.number().finite().min(0).max(100_000_000);

const dateRange = <T extends { startDate?: string; endDate?: string }>(value: T, ctx: z.RefinementCtx) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    ctx.addIssue({ code: "custom", message: "Dönüş tarihi gidişten önce olamaz", path: ["endDate"] });
  }
};

export const MAX_AI_DAYS = 14;
export const MAX_PLAN_DAYS = 60;

/** AI plan isteği. */
export const generatePlanSchema = z
  .object({
    city: text(80).min(1, "Şehir bilgisi gerekli"),
    country: optionalText(80),
    startDate: optionalDate,
    endDate: optionalDate,
    travelers: z.coerce.number().int().min(1).max(10).default(1),
    budgetAmount: z.preprocess((value) => (value === "" || value === null ? undefined : value), money.optional()),
    budgetLevel: optionalText(40),
    travelStyle: optionalText(40),
    stayPreference: optionalText(40),
    transportPrefs: tagList,
    interests: tagList,
    specialRequests: optionalText(600),
  })
  .superRefine(dateRange);

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

const timeOfDay = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalı")
    .optional()
);

const manualStop = z.object({
  name: text(120).min(1, "Aktivite adı gerekli"),
  description: optionalText(500),
  startTime: timeOfDay,
  endTime: timeOfDay,
  cost: money.default(0),
});

const manualDay = z.object({
  notes: optionalText(1000),
  isFree: z.boolean().default(false),
  stops: z.array(manualStop).max(20).default([]),
});

/** Manuel plan kaydı. */
export const manualPlanSchema = z
  .object({
    city: text(80).min(1, "Şehir bilgisi gerekli"),
    country: optionalText(80),
    startDate: isoDate,
    endDate: isoDate,
    travelers: z.coerce.number().int().min(1).max(10).default(1),
    travelStyle: optionalText(40),
    transport: z
      .object({
        type: text(40).min(1),
        provider: optionalText(80),
        price: money.default(0),
        departure: timeOfDay,
        arrival: timeOfDay,
      })
      .nullish(),
    accommodation: z
      .object({
        type: text(40).min(1),
        name: optionalText(120),
        location: optionalText(120),
        /** Gecelik fiyat */
        price: money.default(0),
      })
      .nullish(),
    days: z.array(manualDay).max(MAX_PLAN_DAYS).default([]),
    foodPerDay: money.default(0),
    otherCost: money.default(0),
    targetBudget: z.preprocess((value) => (value === "" || value === null ? undefined : value), money.optional()),
  })
  .superRefine(dateRange);

export type ManualPlanInput = z.infer<typeof manualPlanSchema>;

export const statusPatchSchema = z.object({
  status: z.enum(["PLANNED", "CANCELLED", "DONE"], { message: "Geçersiz durum" }),
});

const budgetCategory = z.enum(["TRANSPORT", "ACCOMMODATION", "FOOD", "ACTIVITIES", "SHOPPING", "OTHER"], {
  message: "Geçersiz kategori",
});

export const expenseCreateSchema = z.object({
  category: budgetCategory,
  description: text(160).min(1, "Açıklama gerekli"),
  amount: z.coerce.number().finite().positive("Tutar sıfırdan büyük olmalı").max(100_000_000),
});

export const expensePatchSchema = z
  .object({
    category: budgetCategory.optional(),
    description: text(160).min(1).optional(),
    amount: z.coerce.number().finite().positive().max(100_000_000).optional(),
    isPaid: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Güncellenecek alan yok");

export const registerSchema = z.object({
  name: text(80).min(2, "İsim en az 2 karakter olmalı"),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta gir").max(254),
  // bcrypt 72 bayttan sonrasını yok sayar; daha uzun şifre yanıltıcı olur.
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(72, "Şifre en fazla 72 karakter olabilir"),
});

export const profileUpdateSchema = z.object({
  name: text(80).min(2, "İsim en az 2 karakter olmalı").optional(),
  preferredTransport: z.enum(["all", "plane", "bus", "train", "car"], { message: "Geçersiz ulaşım tercihi" }).optional(),
  preferredCurrency: z.enum(["TRY", "USD", "EUR", "GBP"], { message: "Geçersiz para birimi" }).optional(),
  interests: tagList.optional(),
});
