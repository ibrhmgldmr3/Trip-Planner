import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AHMET,
  ikiKullanicili,
  istek,
  jsonIstek,
  oturum,
  params,
  yanit,
} from "../helpers/route-harness";
import { sahtePrismaKur, type SahteVeritabani } from "../helpers/fake-prisma";

/**
 * JSON SÜTUNLARI ARTIK SALT OKUNUR ARŞİV (B4 · Adım 5).
 *
 * Taşınan planın bütçesi `BudgetItem`, günleri `DailyPlan` tablosunda
 * yaşıyor. Ama üç ekran — planlar listesi, profil istatistikleri ve plan
 * detayı — `TripPlan`ın JSON sütunlarını okumaya devam ediyordu. O yüzden
 * bütçe ve günlük planlayıcı, ilişkisel tabloya yazdıktan sonra bir de o
 * sütunları güncelliyordu: "geçiş dönemi çift yazması".
 *
 * Çift yazma kaldırıldı ve türetme okuma tarafına taşındı. Bu dosya o
 * taşımanın sözleşmesini koruyor: **taşınmış bir planda hiçbir uç arşiv
 * sütununu OLDUĞU GİBİ döndürmemeli.** Aksi halde kullanıcı bütçesini
 * düzeltir, listede ve profilinde eski rakamı görmeye devam eder — hiçbir
 * hata üretmeden.
 *
 * Veri kurgusu her testte aynı: arşivde 10.000 TL yazıyor, ilişkisel
 * tarafta 4.000 TL'lik tek kalem var. Doğru cevap her yerde 4.000.
 */

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
  authMock: { requireUser: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

vi.mock("@/lib/auth-session", () => ({
  requireUser: authMock.requireUser,
}));

/**
 * Ahmet'in planı taşınmış, Burcu'nunki taşınmamış.
 *
 * İkisinin bir arada olması şart: testin asıl sorusu "taşınmış plan
 * türetiliyor mu" değil, "taşınmış olan türetilirken taşınmamış olan
 * BOZULMUYOR mu". Tek yol bırakan bir düzeltme, JSON sütunlarında yaşayan
 * eski planları sessizce sıfırlardı.
 */
function veri(): SahteVeritabani {
  const temel = ikiKullanicili() as unknown as SahteVeritabani;

  for (const kullanici of temel.user) {
    kullanici.createdAt = new Date(2026, 0, 1);
    kullanici.updatedAt = new Date(2026, 0, 1);
    kullanici.preferences = null;
    kullanici.interests = null;
  }

  // Ortak kurgu `createdAt` taşımıyor; /api/my-trips onu ISO metnine
  // çeviriyor. Testin kendi verisini eksiksiz kurması gerekiyor.
  for (const plan of temel.tripPlan) {
    plan.createdAt = new Date(2026, 3, 1);
    plan.updatedAt = new Date(2026, 3, 1);
  }

  const ahmetPlani = temel.tripPlan.find((p) => p.id === "plan-ahmet");
  if (ahmetPlani) {
    ahmetPlani.tripId = "gezi-ahmet";
    ahmetPlani.migratedAt = new Date(2026, 4, 10);
  }

  // Ahmet'e ikinci, TAŞINMAMIŞ bir plan: arşiv yolu hâlâ çalışmalı.
  temel.tripPlan.push({
    id: "plan-ahmet-eski",
    userId: AHMET,
    city: "Bodrum",
    country: "Türkiye",
    startDate: new Date(2026, 6, 1, 12),
    endDate: new Date(2026, 6, 3, 12),
    status: "PLANNED",
    total_cost: 2500,
    daily_cost: 833,
    butce_tahmini: null,
    gun_plani: null,
    sehir_bilgisi: null,
    pratik_bilgiler: null,
    tripId: null,
    migratedAt: null,
    completedAt: null,
    createdAt: new Date(2026, 5, 1),
    updatedAt: new Date(2026, 5, 1),
  });

  return temel;
}

function kur(baslangic: SahteVeritabani = veri()) {
  const { prisma, kayitlar } = sahtePrismaKur(baslangic);
  prismaMock.current = prisma;
  authMock.requireUser.mockResolvedValue(oturum(AHMET));
  return { kayitlar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ========================================================================== */
/* Planlar listesi                                                            */
/* ========================================================================== */

describe("GET /api/my-plans", () => {
  it("taşınmış planın toplamını İLİŞKİSEL modelden döndürür", async () => {
    kur();
    const { GET } = await import("@/app/api/my-plans/route");

    const { body } = await yanit(await GET());
    const planlar = body.plans as Array<{ id: string; total_cost: number }>;
    const tasinmis = planlar.find((p) => p.id === "plan-ahmet");

    // Arşivde 10.000 yazıyor; doğru cevap kalemlerin toplamı.
    expect(tasinmis?.total_cost).toBe(4000);
  });

  it("taşınmamış planın arşiv değerine DOKUNMAZ", async () => {
    kur();
    const { GET } = await import("@/app/api/my-plans/route");

    const { body } = await yanit(await GET());
    const planlar = body.plans as Array<{ id: string; total_cost: number }>;

    expect(planlar.find((p) => p.id === "plan-ahmet-eski")?.total_cost).toBe(2500);
  });

  it("başkasının planını döndürmez", async () => {
    kur();
    const { GET } = await import("@/app/api/my-plans/route");

    const { body } = await yanit(await GET());
    const planlar = body.plans as Array<{ id: string }>;

    expect(planlar.some((p) => p.id === "plan-burcu")).toBe(false);
  });
});

/* ========================================================================== */
/* Gezi listesi                                                               */
/* ========================================================================== */

describe("GET /api/my-trips", () => {
  it("taşınmış planın toplamını İLİŞKİSEL modelden döndürür", async () => {
    kur();
    const { GET } = await import("@/app/api/my-trips/route");

    const { body } = await yanit(await GET(istek("/api/my-trips")));
    const geziler = body.trips as Array<{ id: string; total_cost: number }>;

    expect(geziler.find((g) => g.id === "plan-ahmet")?.total_cost).toBe(4000);
    expect(geziler.find((g) => g.id === "plan-ahmet-eski")?.total_cost).toBe(2500);
  });
});

/* ========================================================================== */
/* Profil istatistikleri                                                      */
/* ========================================================================== */

describe("GET /api/profile", () => {
  it("toplam bütçeyi İLİŞKİSEL toplamla hesaplar", async () => {
    kur();
    const { GET } = await import("@/app/api/profile/route");

    const { status, body } = await yanit(await GET());
    const stats = body.stats as { totalTrips: number; totalBudget: number };

    expect(status).toBe(200);
    // 4.000 (taşınmış, ilişkisel) + 2.500 (taşınmamış, arşiv) = 6.500.
    // Eski `_sum: { total_cost: true }` 12.500 derdi.
    expect(stats.totalBudget).toBe(6500);
    expect(stats.totalTrips).toBe(2);
  });
});

/* ========================================================================== */
/* Plan detayı                                                                */
/* ========================================================================== */

describe("GET /api/plan-detail/[id]", () => {
  it("bütçe dökümünü ve toplamları ilişkisel modelden üretir", async () => {
    kur();
    const { GET } = await import("@/app/api/plan-detail/[id]/route");

    const { body } = await yanit(
      await GET(istek("/api/plan-detail/plan-ahmet"), params({ id: "plan-ahmet" }))
    );
    const plan = body.plan as { total_cost: number; butce_tahmini: string };

    expect(plan.total_cost).toBe(4000);

    // Arşivdeki döküm "ulaşım: 10.000" diyordu; dönen döküm kalemlerden.
    const butce = JSON.parse(plan.butce_tahmini);
    expect(butce.categories["ulaşım"].total).toBe(4000);
    expect(butce.categories["ulaşım"].items[0].description).toBe("Uçak");
  });

  it("gün planını ilişkisel modelden üretir", async () => {
    const baslangic = veri();
    const gun = baslangic.dailyPlan.find((g) => g.id === "gun-ahmet");
    if (gun) gun.activities = [{ title: "Kolezyum", time: "09:00", cost: 500 }];

    kur(baslangic);
    const { GET } = await import("@/app/api/plan-detail/[id]/route");

    const { body } = await yanit(
      await GET(istek("/api/plan-detail/plan-ahmet"), params({ id: "plan-ahmet" }))
    );
    const plan = body.plan as { gun_plani: string };

    // Alan adları ekran şekline çevrilmiş olmalı: title→name, time→startTime.
    const gunler = JSON.parse(plan.gun_plani);
    expect(gunler[0].activities[0]).toMatchObject({ name: "Kolezyum", startTime: "09:00" });
  });

  it("taşınmamış planda arşiv sütunları OLDUĞU GİBİ döner", async () => {
    kur();
    const { GET } = await import("@/app/api/plan-detail/[id]/route");

    const { body } = await yanit(
      await GET(istek("/api/plan-detail/plan-ahmet-eski"), params({ id: "plan-ahmet-eski" }))
    );

    expect((body.plan as { total_cost: number }).total_cost).toBe(2500);
  });
});

/* ========================================================================== */
/* Günlük plan yazması bütçeyi eşitliyor                                      */
/* ========================================================================== */

describe("PUT /api/trip/daily-plans", () => {
  it("aktivite maliyetini bütçeye yansıtır ve yeni toplamı döndürür", async () => {
    // ÇİFT YAZMANIN YERİNİ ALAN KURAL. Eskiden günlük planlayıcı, günleri
    // yazdıktan sonra bir de `PUT /api/plan-detail/[id]` çağırıyordu;
    // aktivite maliyeti bütçeye ancak öyle giriyordu. Artık burada.
    const { kayitlar } = kur();
    const { PUT } = await import("@/app/api/trip/daily-plans/route");

    const { status, body } = await yanit(
      await PUT(
        jsonIstek("/api/trip/daily-plans", "PUT", {
          id: "gun-ahmet",
          activities: [{ title: "Kolezyum", cost: 500 }],
        })
      )
    );

    expect(status).toBe(200);

    const aktiviteler = kayitlar("budgetItem").filter((k) => k.category === "aktiviteler");
    expect(aktiviteler).toHaveLength(1);
    expect(aktiviteler[0].amount).toBe(500);

    // 4.000 (ulaşım) + 500 (aktivite); 5 günlük gezide günlük 900.
    expect(body.ozet).toEqual({ total_cost: 4500, daily_cost: 900 });
  });

  it("aktivite silinince bütçeden de düşer", async () => {
    const baslangic = veri();
    baslangic.budgetItem.push({
      id: "k-aktivite",
      tripId: "gezi-ahmet",
      category: "aktiviteler",
      description: "1. gün — Kolezyum",
      amount: 500,
      currency: "TRY",
      isEstimate: true,
      isPaid: false,
      date: null,
    });

    const { kayitlar } = kur(baslangic);
    const { PUT } = await import("@/app/api/trip/daily-plans/route");

    const { body } = await yanit(
      await PUT(
        jsonIstek("/api/trip/daily-plans", "PUT", { id: "gun-ahmet", activities: [] })
      )
    );

    expect(kayitlar("budgetItem").filter((k) => k.category === "aktiviteler")).toHaveLength(0);
    expect(body.ozet).toEqual({ total_cost: 4000, daily_cost: 800 });
  });
});
