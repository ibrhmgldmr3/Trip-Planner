import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  aktiviteButcesiniEsitle,
  arsivUstuneYazilacaklar,
  gunAktivitelerineYaz,
  iliskiselGunPlaniJson,
  toplamlariTazele,
} from "@/lib/iliskisel-plan-ozeti";

/**
 * B4 · Adım 5 — GERÇEK VERİTABANINA karşı doğrulama.
 *
 * Sahte Prisma istemcisi `undefined = filtre yok` semantiğini taklit
 * ediyor ama `@db.Date` sütununu taklit ETMİYOR. Bu projede tam olarak
 * orada bir hata çıktı (A19): `gunBasi()` yerel gece yarısını yazıyordu,
 * GMT+3'te sütuna bir önceki gün düşüyordu. Adım 5'te gün eşleştirmesi
 * yine TARİHE dayandığı için aynı tuzak yeniden kuruldu; bu dosya kapağı.
 */

const AD = "adim5-dogrulama";
const KULLANICI = `${AD}-kullanici`;
const GEZI = `${AD}-gezi`;
const PLAN = `${AD}-plan`;

const BASLANGIC = new Date(Date.UTC(2026, 10, 2));
const BITIS = new Date(Date.UTC(2026, 10, 4));

const veritabaniVar = Boolean(process.env.DATABASE_URL);

describe.skipIf(!veritabaniVar)("B4 Adım 5 — canlı", () => {
  beforeAll(async () => {
    await temizle();

    await prisma.user.create({
      data: { id: KULLANICI, email: `${AD}@ornek.test`, name: "Adım 5" },
    });

    await prisma.trip.create({
      data: {
        id: GEZI,
        userId: KULLANICI,
        title: "Roma Gezisi",
        city: "Roma",
        country: "İtalya",
        startDate: BASLANGIC,
        endDate: BITIS,
        budget: 12000,
      },
    });

    await prisma.tripPlan.create({
      data: {
        id: PLAN,
        userId: KULLANICI,
        tripId: GEZI,
        migratedAt: new Date(),
        city: "Roma",
        country: "İtalya",
        startDate: BASLANGIC,
        endDate: BITIS,
        // ARŞİVDE BAYAT DEĞER: doğru cevap 12.000 değil, kalemlerin toplamı.
        total_cost: 12000,
        daily_cost: 4000,
        butce_tahmini: JSON.stringify({
          categories: { "ulaşım": { items: [], total: 12000 } },
          currency: "TRY",
        }),
        gun_plani: JSON.stringify([
          { day: 1, date: "2026-11-02", activities: [], notes: "arşiv" },
        ]),
      },
    });

    await prisma.budgetItem.createMany({
      data: [
        {
          tripId: GEZI,
          category: "ulaşım",
          description: "Uçak",
          amount: 4000,
          isPaid: true,
        },
        { tripId: GEZI, category: "konaklama", description: "Otel", amount: 3000 },
      ],
    });

    await prisma.dailyPlan.createMany({
      data: [
        {
          tripId: GEZI,
          date: new Date(Date.UTC(2026, 10, 2)),
          notes: "ilk gün",
          activities: [{ id: "d1-a1", title: "Kolezyum", time: "09:00", cost: 500 }],
        },
        {
          tripId: GEZI,
          date: new Date(Date.UTC(2026, 10, 3)),
          notes: null,
          activities: [{ id: "d2-a1", title: "Vatikan", time: "10:00", cost: 300 }],
        },
      ],
    });
  });

  afterAll(async () => {
    await temizle();
    await prisma.$disconnect();
  });

  it("toplam ARŞİVDEN DEĞİL, kalemlerden geliyor", async () => {
    const planlar = await prisma.tripPlan.findMany({
      where: { userId: KULLANICI },
      select: { id: true, tripId: true, migratedAt: true, total_cost: true },
    });

    const [tazelenmis] = await toplamlariTazele(planlar);

    expect(planlar[0].total_cost).toBe(12000);
    expect(tazelenmis.total_cost).toBe(7000);
  });

  it("gün planı ilişkisel satırlardan üretiliyor ve TARİH KAYMASI yok", async () => {
    // A19'un tekrarını arıyoruz: `@db.Date` sütunu UTC gece yarısı tutuyor.
    const ham = await iliskiselGunPlaniJson(GEZI);
    const gunler = JSON.parse(ham as string);

    expect(gunler.map((g: { date: string }) => g.date)).toEqual([
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(gunler[0].activities[0].name).toBe("Kolezyum");
    expect(gunler[0].notes).toBe("ilk gün");
  });

  it("plan detayı arşiv sütunlarının üzerine yazıyor", async () => {
    const plan = await prisma.tripPlan.findUniqueOrThrow({
      where: { id: PLAN },
      select: { tripId: true, migratedAt: true, startDate: true, endDate: true },
    });

    const ustuneYaz = await arsivUstuneYazilacaklar(plan);
    const butce = JSON.parse(ustuneYaz.butce_tahmini as string);

    expect(ustuneYaz.total_cost).toBe(7000);
    // 2-4 Kasım = 3 gün (kapsayıcı).
    expect(ustuneYaz.daily_cost).toBe(2333);
    expect(butce.categories["ulaşım"].total).toBe(4000);
    expect(butce.categories["ulaşım"].items[0].isPaid).toBe(true);
    expect(ustuneYaz.gun_plani).toContain("Kolezyum");
  });

  it("aktivite eşitlemesi bütçeyi güncelliyor, diğer kategorilere dokunmuyor", async () => {
    const toplam = await aktiviteButcesiniEsitle(GEZI);

    const kalemler = await prisma.budgetItem.findMany({
      where: { tripId: GEZI },
      orderBy: { category: "asc" },
    });

    const aktiviteler = kalemler.filter((k) => k.category === "aktiviteler");

    expect(aktiviteler.map((k) => k.description)).toEqual([
      "1. gün — Kolezyum",
      "2. gün — Vatikan",
    ]);
    // 4000 + 3000 + 500 + 300
    expect(toplam).toBe(7800);

    const ucak = kalemler.find((k) => k.description === "Uçak");
    expect(ucak?.amount).toBe(4000);
    expect(ucak?.isPaid).toBe(true);
  });

  it("koordinat yazması DOĞRU GÜNE düşüyor", async () => {
    // Eşleştirme tarihe göre; bir gün kayması bütün rotayı bozardı.
    await gunAktivitelerineYaz(GEZI, [
      {
        date: "2026-11-03",
        day: 2,
        activities: [
          {
            id: "d2-a1",
            name: "Vatikan",
            startTime: "10:00",
            endTime: "",
            cost: 300,
            category: "aktiviteler",
            location: "Vatikan",
            coordinates: { lat: 41.9022, lng: 12.4539 },
          },
        ],
      },
    ]);

    const gunler = await prisma.dailyPlan.findMany({
      where: { tripId: GEZI },
      orderBy: { date: "asc" },
    });

    const ilk = gunler[0].activities as Array<Record<string, unknown>>;
    const ikinci = gunler[1].activities as Array<Record<string, unknown>>;

    expect(ilk[0].coordinates).toBeUndefined();
    expect(ikinci[0].coordinates).toEqual({ lat: 41.9022, lng: 12.4539 });
  });
});

/** Testin kendi satırlarını siler; mevcut verilere DOKUNMAZ. */
async function temizle() {
  await prisma.tripPlan.deleteMany({ where: { id: PLAN } });
  await prisma.trip.deleteMany({ where: { id: GEZI } });
  await prisma.user.deleteMany({ where: { id: KULLANICI } });
}
