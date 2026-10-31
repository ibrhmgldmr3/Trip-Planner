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
/**
 * Şifre kuralı TEK YERDE.
 *
 * Kayıt ve şifre SIFIRLAMA aynı kuralı uygulamak zorunda; iki ayrı kopya,
 * sıfırlama yoluyla kayıtta kabul edilmeyecek bir şifrenin konabilmesi
 * demekti.
 */
export const sifreKurali = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalıdır")
  // bcrypt 72 byte'tan sonrasını sessizce yok sayar.
  .max(72, "Şifre en fazla 72 karakter olabilir")
  .regex(/[a-zA-Z]/, "Şifre en az bir harf içermelidir")
  .regex(/[0-9]/, "Şifre en az bir rakam içermelidir");

/** E-posta alanı; kayıt ve sıfırlama isteği aynı normalizasyonu paylaşıyor. */
export const epostaKurali = z
  .string()
  .trim()
  .toLowerCase()
  .email("Geçerli bir e-posta giriniz")
  .max(200);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "İsim en az 2 karakter olmalıdır").max(80),
  email: epostaKurali,
  password: sifreKurali,
});

/** `POST /api/auth/reset-request` gövdesi (B9). */
export const sifreSifirlamaIstegiSchema = z.object({
  email: epostaKurali,
});

/**
 * Jeton alanı: 32 bayt base64url, yani 43 karakter.
 *
 * Alt sınır 20 — daha kısa bir değerle veritabanına sorgu atmanın anlamı
 * yok. Üst sınır, uzun bir metinle boşuna özet hesaplatmayı engelliyor.
 */
const jetonKurali = z.string().trim().min(20, "Bağlantı geçersiz").max(200);

/** `POST /api/auth/reset` gövdesi (B9). */
export const sifreSifirlamaSchema = z.object({
  token: jetonKurali,
  password: sifreKurali,
});

/** `POST /api/auth/verify` gövdesi (B9). */
export const epostaDogrulamaSchema = z.object({
  token: jetonKurali,
});

/**
 * `DELETE /api/profile` gövdesi (B9).
 *
 * ONAY İSTENİYOR: hesap silme geri alınamaz ve kullanıcının bütün
 * planlarını da götürüyor. Açık kalmış bir oturumun tek tıkla her şeyi
 * silebilmesi kabul edilemez.
 *
 * TEK ALAN, İKİ ANLAM: şifreyle açılmış hesapta ŞİFRE, yalnızca Google
 * ile açılmış hesapta E-POSTA ADRESİ. İkincisinde doğrulanacak bir şifre
 * yok; adresi elle yazdırmak, kazara silmenin önüne geçen en yakın
 * karşılık. Hangisinin beklendiğine sunucu karar veriyor — istemcinin
 * "bu hesabın şifresi var mı" bilgisine göre dallanması, o bilgiyi
 * dışarıya taşımak olurdu.
 *
 * Şifre KURALI uygulanmıyor: mevcut şifre eski kurallara göre konmuş
 * olabilir ve doğrulama zaten bcrypt karşılaştırmasıyla yapılıyor.
 */
export const hesapSilmeSchema = z.object({
  onay: z.string().min(1, "Onay alanı boş bırakılamaz").max(200),
});

/**
 * `POST /api/trip-plan-model` gövdesi. Uzunluk sınırları hem prompt injection
 * yüzeyini hem de token maliyetini sınırlamak için var.
 */
export const planRequestSchema = z.object({
  city: z.string().trim().min(1, "Şehir bilgisi gereklidir").max(80),
  /**
   * Kalkış şehri (B6).
   *
   * OPSİYONEL: yurt dışı planlarında ve "zaten oradayım" senaryosunda
   * karşılığı yok. Doluysa `TripPlan.origin_city` sütununa yazılıyor ve
   * bütçeye şehirlerarası ulaşım kalemi ekleniyor.
   */
  originCity: z.string().trim().max(80).optional(),
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

/** Doğrulanmış plan isteği; üretim katmanı bu tipi alıyor. */
export type PlanRequestInput = z.infer<typeof planRequestSchema>;

/* -------------------------------------------------------------------------- */
/* Plan güncelleme                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `PATCH /api/plan-detail/[id]` gövdesi (bütçe güncellemesi).
 *
 * Eskiden gövde doğrudan `Number(body.total_cost)` ile okunuyordu; sayısal
 * olmayan bir değer NaN üretip Prisma'da yakalanmamış hataya dönüşüyordu.
 * `butce_tahmini` de sınırsızdı — JSON metni olarak megabaytlarca veri
 * yazılabiliyordu.
 */
export const planBudgetPatchSchema = z
  .object({
    total_cost: z.number().finite().min(0).max(100_000_000).optional(),
    daily_cost: z.number().finite().min(0).max(10_000_000).optional(),
    // Serileştirilmiş bütçe JSON'u. 200 KB'ın üstü veri değil, kaza demektir.
    butce_tahmini: z.string().max(200_000).optional(),
  })
  .refine(
    (v) =>
      v.total_cost !== undefined ||
      v.daily_cost !== undefined ||
      v.butce_tahmini !== undefined,
    { message: "Güncellenecek en az bir alan gönderilmelidir" }
  );

/** `PUT /api/plan-detail/[id]` gövdesi (günlük plan güncellemesi). */
export const planDailyPlansPutSchema = z.object({
  // İstemci `JSON.stringify(plans)` gönderiyor; içeriği ayrıca doğrulanıyor.
  daily_plans: z.string().min(2).max(500_000),
});

/** `PATCH /api/trip-plans/[id]/status` gövdesi. */
export const tripPlanStatusSchema = z.object({
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED", "DONE"]),
});

/* -------------------------------------------------------------------------- */
/* Manuel plan                                                                */
/* -------------------------------------------------------------------------- */

const manuelAktiviteSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().max(160).default(""),
  startTime: z.string().max(16).optional(),
  endTime: z.string().max(16).optional(),
  cost: z.number().finite().min(0).max(10_000_000).default(0),
  description: z.string().max(600).optional(),
  category: z.string().max(60).optional(),
  location: z.string().max(200).optional(),
});

/**
 * `POST /api/manual-travel-plan` gövdesi.
 *
 * Eskiden bu uç hiç doğrulama yapmıyordu: `planData.basicInfo.destination`
 * doğrudan okunuyordu, `basicInfo` yoksa TypeError fırlatıp 500 dönüyor ve
 * hata gövdesinde stack trace sızdırıyordu. Ayrıca oturum kontrolü yoktu.
 */
export const manualPlanSchema = z.object({
  basicInfo: z.object({
    /**
     * Kalkış şehri. Opsiyonel: bu alan sonradan eklendi ve daha eski
     * istemciler göndermiyor — zorunlu kılmak onları kırardı.
     */
    origin: z.string().trim().max(80).optional().default(""),
    destination: z.string().trim().min(1, "Hedef şehir gereklidir").max(80),
    country: z.string().trim().max(80).optional().default(""),
    startDate: z.string().min(1, "Başlangıç tarihi gereklidir").max(40),
    endDate: z.string().min(1, "Bitiş tarihi gereklidir").max(40),
    travelers: z.number().int().min(1).max(50).default(1),
    travelStyle: z.string().max(60).optional().default(""),
  }),
  transport: z
    .object({
      id: z.string().max(64).optional(),
      type: z.string().max(60).optional(),
      provider: z.string().max(120).optional(),
      price: z.number().finite().min(0).max(10_000_000).default(0),
      duration: z.string().max(60).optional(),
      departure: z.string().max(120).optional(),
      arrival: z.string().max(120).optional(),
    })
    .nullable()
    .optional(),
  accommodation: z
    .object({
      id: z.string().max(64).optional(),
      name: z.string().max(160).optional(),
      type: z.string().max(60).optional(),
      rating: z.number().finite().min(0).max(5).optional(),
      price: z.number().finite().min(0).max(10_000_000).default(0),
      location: z.string().max(200).optional(),
      amenities: z.array(z.string().max(60)).max(30).optional(),
    })
    .nullable()
    .optional(),
  dailyPlans: z
    .array(
      z.object({
        day: z.number().int().min(1).max(60),
        activities: z.array(manuelAktiviteSchema).max(20).default([]),
        notes: z.string().max(2000).optional().default(""),
        isEmpty: z.boolean().optional().default(false),
      })
    )
    .max(60)
    .default([]),
  budget: z.object({
    currentBudget: z.number().finite().min(0).max(100_000_000).default(0),
    estimatedTotal: z.number().finite().min(0).max(100_000_000).default(0),
    breakdown: z.object({
      transport: z.number().finite().min(0).max(100_000_000).default(0),
      accommodation: z.number().finite().min(0).max(100_000_000).default(0),
      activities: z.number().finite().min(0).max(100_000_000).default(0),
      food: z.number().finite().min(0).max(100_000_000).default(0),
      other: z.number().finite().min(0).max(100_000_000).default(0),
    }),
  }),
});

export type ManualPlanInput = z.infer<typeof manualPlanSchema>;

/**
 * Zod hatasından kullanıcıya gösterilecek TEK bir mesaj üretir.
 *
 * `error.format()._errors[0]` KULLANMAYIN: o dizi yalnızca kök seviyedeki
 * (alan adı olmayan) hataları taşır. Alan hataları `format().name._errors`
 * altındadır, dolayısıyla `_errors[0]` alan hatalarında daima `undefined`
 * olur ve kullanıcı şemadaki Türkçe mesaj yerine hep genel yedek metni
 * görürdü.
 */
export function ilkHataMesaji(error: z.ZodError, yedek = "Geçersiz istek"): string {
  const issue = error.issues[0];
  if (!issue) return yedek;

  const yol = issue.path.join(".");
  return yol ? `${yol}: ${issue.message}` : issue.message;
}

/* -------------------------------------------------------------------------- */
/* Trip (ilişkisel model) uçları                                              */
/* -------------------------------------------------------------------------- */

/**
 * `POST /api/trip` gövdesi.
 *
 * Bu uçlar eskiden gövdeyi hiç doğrulamıyordu: `parseFloat(budget)` sayısal
 * olmayan girdide NaN üretiyor, `new Date(startDate)` geçersiz tarihte
 * Invalid Date yazmaya çalışıyor ve Prisma'da yakalanmamış hataya dönüşüyordu.
 */
export const tripCreateSchema = z.object({
  title: z.string().trim().min(1, "Başlık gereklidir").max(160),
  description: z.string().trim().max(2000).optional(),
  startDate: z.string().min(1, "Başlangıç tarihi gereklidir").max(40),
  endDate: z.string().min(1, "Bitiş tarihi gereklidir").max(40),
  city: z.string().trim().min(1, "Şehir gereklidir").max(80),
  country: z.string().trim().max(80).optional(),
  budget: z.number().finite().min(0).max(100_000_000).optional(),
});

/** `PUT /api/trip` gövdesi; tüm alanlar opsiyonel, `id` zorunlu. */
export const tripUpdateSchema = z.object({
  id: z.string().min(1, "Seyahat kimliği gereklidir").max(64),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().max(80).optional(),
  budget: z.number().finite().min(0).max(100_000_000).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED", "DONE"]).optional(),
});

/** `POST /api/trip/budget` gövdesi. */
export const budgetItemCreateSchema = z.object({
  tripId: z.string().min(1, "Seyahat kimliği gereklidir").max(64),
  category: z.string().trim().min(1, "Kategori gereklidir").max(60),
  description: z.string().trim().min(1, "Açıklama gereklidir").max(200),
  amount: z.number().finite().min(0).max(10_000_000),
  date: z.string().max(40).optional(),
  isEstimate: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

/** `PUT /api/trip/budget` gövdesi. */
export const budgetItemUpdateSchema = z.object({
  id: z.string().min(1, "Kalem kimliği gereklidir").max(64),
  category: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  amount: z.number().finite().min(0).max(10_000_000).optional(),
  date: z.string().max(40).optional(),
  isEstimate: z.boolean().optional(),
  isPaid: z.boolean().optional(),
});

/* -------------------------------------------------------------------------- */
/* Trip alt kaynakları — günlük plan, konaklama, ulaşım                       */
/* -------------------------------------------------------------------------- */

/**
 * Günlük plan içindeki tek aktivite.
 *
 * `DailyPlan.activities` bir `Json` sütunu; şemasız bırakılırsa oraya her şey
 * yazılabilir ve okuyan sayfalar savunmasız kalır. Sütunun içeriğini de
 * doğruluyoruz — JSON sütunu "doğrulama yok" demek değil.
 */
export const dailyActivitySchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().trim().min(1, "Aktivite adı gereklidir").max(160),
  description: z.string().trim().max(600).optional(),
  time: z.string().trim().max(16).optional(),
  endTime: z.string().trim().max(16).optional(),
  location: z.string().trim().max(200).optional(),
  cost: z.number().finite().min(0).max(10_000_000).optional(),
  category: z.string().trim().max(60).optional(),
  /**
   * Aktivitenin çözülmüş konumu.
   *
   * NEDEN İLİŞKİSEL TARAFTA DA VAR (B4 · Adım 5): harita sayfası rotayı bu
   * koordinatlardan çiziyor ve taşınmış planlarda `gun_plani` artık
   * `DailyPlan` satırlarından türetiliyor. Alan burada olmasaydı, taşınan
   * her planın haritası — kullanıcı hiçbir şey yapmadan — boşalırdı.
   *
   * Sınırlar WGS84: geçersiz bir çift, rotayı okyanusun ortasına taşır.
   */
  coordinates: z
    .object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
    })
    .optional(),
});

/** `POST /api/trip/daily-plans` gövdesi. */
export const dailyPlanCreateSchema = z.object({
  tripId: z.string().min(1, "Seyahat kimliği gereklidir").max(64),
  date: z.string().min(1, "Tarih gereklidir").max(40),
  title: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  activities: z.array(dailyActivitySchema).max(30).default([]),
});

/** `PUT /api/trip/daily-plans` gövdesi. */
export const dailyPlanUpdateSchema = z.object({
  id: z.string().min(1, "Günlük plan kimliği gereklidir").max(64),
  date: z.string().max(40).optional(),
  title: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  activities: z.array(dailyActivitySchema).max(30).optional(),
});

/** Konaklama durumu; serbest metin yerine sabit küme. */
export const REZERVASYON_DURUMLARI = ["pending", "confirmed", "cancelled"] as const;

/** `POST /api/trip/accommodations` gövdesi. */
export const accommodationCreateSchema = z.object({
  tripId: z.string().min(1, "Seyahat kimliği gereklidir").max(64),
  name: z.string().trim().min(1, "Konaklama adı gereklidir").max(160),
  location: z.string().trim().max(200).optional(),
  checkIn: z.string().min(1, "Giriş tarihi gereklidir").max(40),
  checkOut: z.string().min(1, "Çıkış tarihi gereklidir").max(40),
  price: z.number().finite().min(0).max(10_000_000),
  priceUnit: z.enum(["total", "night"]).optional(),
  bookingUrl: z.string().url("Geçerli bir bağlantı giriniz").max(500).optional(),
  type: z.string().trim().max(60).optional(),
  amenities: z.array(z.string().trim().max(60)).max(30).optional(),
  address: z.string().trim().max(300).optional(),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  rating: z.number().finite().min(0).max(5).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(REZERVASYON_DURUMLARI).optional(),
  confirmation: z.string().trim().max(120).optional(),
});

/** `PUT /api/trip/accommodations` gövdesi. */
export const accommodationUpdateSchema = accommodationCreateSchema
  .partial()
  .extend({ id: z.string().min(1, "Konaklama kimliği gereklidir").max(64) })
  // tripId güncellenemez: bir konaklamayı başka bir seyahate taşımak,
  // sahiplik kontrolünü atlatmanın kestirme yolu olurdu.
  .omit({ tripId: true });

/** `POST /api/trip/transportations` gövdesi. */
export const transportationCreateSchema = z.object({
  tripId: z.string().min(1, "Seyahat kimliği gereklidir").max(64),
  type: z.string().trim().min(1, "Ulaşım türü gereklidir").max(60),
  provider: z.string().trim().max(120).optional(),
  departureTime: z.string().min(1, "Kalkış zamanı gereklidir").max(40),
  arrivalTime: z.string().min(1, "Varış zamanı gereklidir").max(40),
  departureLocation: z.string().trim().min(1, "Kalkış yeri gereklidir").max(200),
  arrivalLocation: z.string().trim().min(1, "Varış yeri gereklidir").max(200),
  price: z.number().finite().min(0).max(10_000_000),
  bookingReference: z.string().trim().max(120).optional(),
  bookingUrl: z.string().url("Geçerli bir bağlantı giriniz").max(500).optional(),
  seats: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(REZERVASYON_DURUMLARI).optional(),
});

/** `PUT /api/trip/transportations` gövdesi. */
export const transportationUpdateSchema = transportationCreateSchema
  .partial()
  .extend({ id: z.string().min(1, "Ulaşım kimliği gereklidir").max(64) })
  .omit({ tripId: true });

/* -------------------------------------------------------------------------- */
/* Agentic araç argümanları                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `web_search` aracının argüman şeması.
 *
 * Modelin ürettiği argümanlar HENÜZ DOĞRULANMAMIŞ dış girdi sayılıyor —
 * araç çalıştırılmadan önce buradan geçiyor. Uzunluk sınırı hem kötüye
 * kullanımı hem arama sağlayıcısına giden token/maliyeti sınırlıyor.
 */
export const webSearchToolArgsSchema = z.object({
  query: z.string().trim().min(1, "Sorgu boş olamaz").max(200),
});

export type WebSearchToolArgs = z.infer<typeof webSearchToolArgsSchema>;

/**
 * `get_hotel_prices` aracının argüman şeması.
 *
 * Alanlar arama sorgusu ŞABLONUNU dolduruyor; bir rezervasyon API'sine
 * gitmiyor. Tarihler serbest metin: model "15 Mayıs 2026" de "2026-05-15"
 * de üretebiliyor ve ikisi de arama sorgusunda aynı işi görüyor. Bu yüzden
 * burada tarih biçimi ZORLANMIYOR — reddedilen bir argüman modele bir tur
 * daha maliyet demek, oysa hatalı biçimin tek sonucu biraz daha zayıf bir
 * arama sorgusu.
 */
export const hotelPricesToolArgsSchema = z.object({
  city: z.string().trim().min(1, "Şehir boş olamaz").max(80),
  checkIn: z.string().trim().max(40).optional(),
  checkOut: z.string().trim().max(40).optional(),
  /** "ekonomik" | "orta" | "lüks" bekleniyor ama serbest metin kabul ediliyor. */
  budgetLevel: z.string().trim().max(40).optional(),
});

export type HotelPricesToolArgs = z.infer<typeof hotelPricesToolArgsSchema>;

/** `get_transport_prices` aracının argüman şeması. */
export const transportPricesToolArgsSchema = z.object({
  from: z.string().trim().min(1, "Kalkış noktası boş olamaz").max(80),
  to: z.string().trim().min(1, "Varış noktası boş olamaz").max(80),
  date: z.string().trim().max(40).optional(),
  /** "uçak" | "otobüs" | "tren" gibi; serbest metin. */
  mode: z.string().trim().max(40).optional(),
});

export type TransportPricesToolArgs = z.infer<typeof transportPricesToolArgsSchema>;

/**
 * `GET /api/transport-options` sorgu parametreleri.
 *
 * `web` bir sorgu dizesinden geliyor, yani her zaman METİN. Zod'un
 * `coerce.boolean()`u burada işe yaramaz: `Boolean("0")` true'dur ve
 * `?web=0` sessizce arama yapardı. Açıkça çeviriyoruz.
 */
export const transportOptionsQuerySchema = z.object({
  from: z.string().trim().min(1, "Kalkış şehri gereklidir").max(80),
  to: z.string().trim().min(1, "Varış şehri gereklidir").max(80),
  web: z
    .string()
    .optional()
    .transform((v) => v !== "0" && v !== "false"),
});

export type TransportOptionsQuery = z.infer<typeof transportOptionsQuerySchema>;

/**
 * `GET /api/accommodation-options` sorgu parametreleri.
 *
 * Tarihler serbest metin: sorgu şablonuna "Kasım 2026" gibi bir ay/yıl
 * olarak giriyorlar (bkz. web-search.ts `ayYilMetni`), biçim zorlamanın
 * bir karşılığı yok.
 */
export const accommodationOptionsQuerySchema = z.object({
  city: z.string().trim().min(1, "Şehir gereklidir").max(80),
  checkIn: z.string().trim().max(40).optional(),
  checkOut: z.string().trim().max(40).optional(),
  budgetLevel: z.string().trim().max(40).optional(),
});

export type AccommodationOptionsQuery = z.infer<typeof accommodationOptionsQuerySchema>;
