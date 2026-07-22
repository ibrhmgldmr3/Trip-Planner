import { z } from "zod";

/**
 * API istek gövdesi şemaları.
 *
 * Bu şemalar route handler'larının içinden buraya taşındı. Sebep: Next.js
 * bir `route.ts` dosyasından yalnızca HTTP metotlarının (ve birkaç config
 * sabitinin) export edilmesine izin veriyor; şemayı orada `export` etmek
 * build'i kırardı. Ayrı modülde durunca hem birim testten çağrılabiliyorlar
 * hem de route'lar tek satırlık bir import ile aynı davranışı koruyor.
 */

/** `POST /api/register` gövdesi. */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "İsim en az 2 karakter olmalıdır").max(80),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta giriniz").max(200),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    // bcrypt 72 byte'tan sonrasını sessizce yok sayar.
    .max(72, "Şifre en fazla 72 karakter olabilir")
    .regex(/[a-zA-Z]/, "Şifre en az bir harf içermelidir")
    .regex(/[0-9]/, "Şifre en az bir rakam içermelidir"),
});

/**
 * `POST /api/trip-plan-model` gövdesi. Uzunluk sınırları hem prompt injection
 * yüzeyini hem de token maliyetini sınırlamak için var.
 */
export const planRequestSchema = z.object({
  city: z.string().trim().min(1, "Şehir bilgisi gereklidir").max(80),
  country: z.string().trim().max(80).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  budget: z.string().max(60).optional(),
  transportation: z.union([z.array(z.string().max(60)).max(20), z.string().max(300)]).optional(),
  interests: z.union([z.array(z.string().max(60)).max(20), z.string().max(300)]).optional(),
  travelStyle: z.string().max(60).optional(),
  accommodation: z.string().max(60).optional(),
  specialRequirements: z.string().max(500).optional(),
});
