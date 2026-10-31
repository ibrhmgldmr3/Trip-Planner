import { beforeEach, describe, expect, it, vi } from "vitest";
import { sahtePrismaKur, type SahteVeritabani } from "./helpers/fake-prisma";

/**
 * İLİŞKİSEL MODELDEN ARŞİV ŞEKLİNE OKUMA (B4 · Adım 5).
 *
 * Bu modül, taşınmış bir planın `TripPlan` JSON sütunlarını SALT OKUNUR
 * arşive çeviren şeyin ta kendisi: toplamlar, bütçe dökümü ve gün planı
 * artık `BudgetItem` / `DailyPlan` tablolarından türetiliyor. Türetme
 * yanlışsa kullanıcı planlar listesinde, profilinde ve plan detayında
 * BAŞKA rakamlar görür — üstelik hiçbir hata üretmeden.
 *
 * En kritik iki kural burada test ediliyor:
 *
 *  1. "Kalemi yok" ile "toplamı sıfır" AYNI ŞEY DEĞİL. Taşıma, bütçesi
 *     markdown olan planlarda kalem üretmiyor; böyle bir planı 0 TL
 *     göstermek kullanıcıya verisi silinmiş gibi görünürdü.
 *  2. Aktivite maliyetleri bütçeye yansıtılmalı. Bu kural JSON modelinde
 *     `PUT /api/plan-detail/[id]` içindeydi; çift yazma kaldırıldığı için
 *     ilişkisel tarafta da işlemek zorunda.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

import {
  aktiviteButcesiniEsitle,
  arsivUstuneYazilacaklar,
  etkinToplam,
  gunSatirlarindanEkranGunleri,
  iliskiselToplamlariGetir,
  kalemlerdenButce,
  tasinmisTripId,
  toplamOzeti,
} from "@/lib/iliskisel-plan-ozeti";

const BASLANGIC = new Date(2026, 4, 1, 12);
const BITIS = new Date(2026, 4, 5, 12);

function kur(veri: SahteVeritabani) {
  const { prisma, kayitlar } = sahtePrismaKur(veri);
  prismaMock.current = prisma;
  return { kayitlar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ========================================================================== */
/* Taşınma damgası                                                            */
/* ========================================================================== */

describe("tasinmisTripId", () => {
  it("damga ve bağ birlikteyse seyahat kimliğini döndürür", () => {
    expect(tasinmisTripId({ tripId: "gezi-1", migratedAt: new Date() })).toBe("gezi-1");
  });

  it("taşınmamış planda null döndürür", () => {
    expect(tasinmisTripId({ tripId: null, migratedAt: null })).toBeNull();
  });

  it("BAĞ KOPMUŞSA null döndürür (onDelete: SetNull)", () => {
    // A1: `TripPlan.trip` ilişkisi SetNull. Kullanıcı türetilmiş geziyi
    // silerse `tripId` null olur ama `migratedAt` dolu kalır. Yalnızca
    // damgaya bakan bir kontrol, olmayan bir seyahatin kalemlerini
    // aramaya kalkardı.
    expect(tasinmisTripId({ tripId: null, migratedAt: new Date() })).toBeNull();
  });
});

/* ========================================================================== */
/* Bütçe çevirisi                                                             */
/* ========================================================================== */

describe("kalemlerdenButce", () => {
  const kalemler = [
    { category: "ulaşım", description: "Uçak", amount: 4000, isPaid: true, currency: "TRY" },
    { category: "konaklama", description: "Otel", amount: 3000, isPaid: false, currency: "TRY" },
    { category: "ulaşım", description: "Taksi", amount: 500, isPaid: false, currency: "TRY" },
  ];

  it("kalemleri kategoriye göre gruplar ve toplamları türetir", () => {
    const butce = kalemlerdenButce(kalemler, 5);

    expect(Object.keys(butce.categories).sort()).toEqual(["konaklama", "ulaşım"]);
    expect(butce.categories["ulaşım"].items).toHaveLength(2);
    expect(butce.categories["ulaşım"].total).toBe(4500);
    expect(butce.totalCostWithExtras).toBe(7500);
  });

  it("günlük ortalama ve önerilen bütçe AYNI FORMÜLDEN geliyor", () => {
    // Formülün ikinci bir kopyası, taşınmış ve taşınmamış planların farklı
    // rakamlar göstermesi demek olurdu; hesap `butceyiYenidenHesapla`da.
    const butce = kalemlerdenButce(kalemler, 5);

    expect(butce.dailyAverage).toBe(1500);
    expect(butce.suggestedBudget).toBe(9000);
  });

  it("ödeme durumunu korur", () => {
    const butce = kalemlerdenButce(kalemler, 5);
    const ucak = butce.categories["ulaşım"].items.find((k) => k.description === "Uçak");

    expect(ucak?.isPaid).toBe(true);
  });

  it("kalem yoksa geçerli ama boş bir bütçe üretir", () => {
    const butce = kalemlerdenButce([], 5);

    expect(butce.categories).toEqual({});
    expect(butce.totalCostWithExtras).toBe(0);
    expect(butce.currency).toBe("TRY");
  });
});

/* ========================================================================== */
/* Gün çevirisi                                                               */
/* ========================================================================== */

describe("gunSatirlarindanEkranGunleri", () => {
  it("gün numarasını TARİH SIRASINDAN üretir", () => {
    // İlişkisel tarafta "kaçıncı gün" sütunu yok; doğal anahtar tarih.
    // Satırlar sırasız geldiğinde numaralar veritabanının döndürme
    // sırasına bağlı kalmamalı.
    const gunler = gunSatirlarindanEkranGunleri([
      { id: "g3", date: new Date("2026-05-03"), notes: null, activities: [] },
      { id: "g1", date: new Date("2026-05-01"), notes: null, activities: [] },
      { id: "g2", date: new Date("2026-05-02"), notes: null, activities: [] },
    ]);

    expect(gunler.map((g) => g.day)).toEqual([1, 2, 3]);
    expect(gunler.map((g) => g.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });

  it("alan adlarını ekran şekline çevirir", () => {
    const [gun] = gunSatirlarindanEkranGunleri([
      {
        id: "g1",
        date: new Date("2026-05-01"),
        notes: "erken kalk",
        activities: [{ title: "Kolezyum", time: "09:00", cost: 500 }],
      },
    ]);

    expect(gun.notes).toBe("erken kalk");
    expect(gun.activities[0]).toMatchObject({
      name: "Kolezyum",
      startTime: "09:00",
      cost: 500,
    });
    expect(gun.isEmpty).toBe(false);
  });
});

/* ========================================================================== */
/* Toplamlar                                                                  */
/* ========================================================================== */

describe("iliskiselToplamlariGetir", () => {
  it("seyahat başına toplar", async () => {
    kur({
      budgetItem: [
        { id: "k1", tripId: "gezi-1", category: "ulaşım", amount: 4000 },
        { id: "k2", tripId: "gezi-1", category: "konaklama", amount: 3000 },
        { id: "k3", tripId: "gezi-2", category: "yemek", amount: 900 },
      ],
    });

    const toplamlar = await iliskiselToplamlariGetir(["gezi-1", "gezi-2"]);

    expect(toplamlar.get("gezi-1")).toBe(7000);
    expect(toplamlar.get("gezi-2")).toBe(900);
  });

  it("KALEMİ OLMAYAN seyahat haritaya girmez", async () => {
    // Ayrım kasıtlı: 0 ile "bilgi yok" farklı şeyler. Çağıran bu farka
    // bakarak arşiv değerine geri düşüyor.
    kur({ budgetItem: [{ id: "k1", tripId: "gezi-1", category: "ulaşım", amount: 4000 }] });

    const toplamlar = await iliskiselToplamlariGetir(["gezi-1", "gezi-bos"]);

    expect(toplamlar.has("gezi-bos")).toBe(false);
  });

  it("boş listede SORGU ATMAZ", async () => {
    const { prisma } = sahtePrismaKur({ budgetItem: [] });
    // Sahte istemci `never` tipinde dönüyor (gerçek Prisma tipini taklit
    // etmiyor); casusu kurmak için tablonun asgari şekli yeterli.
    const tablo = (prisma as unknown as {
      budgetItem: { findMany: (...args: unknown[]) => Promise<unknown> };
    }).budgetItem;
    const casus = vi.spyOn(tablo, "findMany");
    prismaMock.current = prisma;

    const toplamlar = await iliskiselToplamlariGetir([null, null]);

    expect(toplamlar.size).toBe(0);
    expect(casus).not.toHaveBeenCalled();
  });
});

describe("etkinToplam", () => {
  const tasinmis = { tripId: "gezi-1", migratedAt: new Date(), total_cost: 10000 };

  it("taşınmış planda İLİŞKİSEL toplamı kullanır", () => {
    expect(etkinToplam(tasinmis, new Map([["gezi-1", 7500]]))).toBe(7500);
  });

  it("ilişkisel toplam SIFIR ise sıfırı kullanır", () => {
    // Kullanıcı bütün kalemleri sildiyse doğru cevap 0; arşivdeki eski
    // rakama dönmek "silinen kalemler geri geldi" gibi görünürdü.
    expect(etkinToplam(tasinmis, new Map([["gezi-1", 0]]))).toBe(0);
  });

  it("KALEM YOKSA arşiv değerine geri düşer", () => {
    // Bütçesi markdown olan planlarda taşıma kalem üretmiyor; 0 göstermek
    // kullanıcıya verisi silinmiş gibi görünürdü.
    expect(etkinToplam(tasinmis, new Map())).toBe(10000);
  });

  it("taşınmamış planda arşiv değerini kullanır", () => {
    const plan = { tripId: null, migratedAt: null, total_cost: 8000 };
    expect(etkinToplam(plan, new Map([["gezi-1", 7500]]))).toBe(8000);
  });
});

describe("toplamOzeti", () => {
  it("gün sayısını KAPSAYICI hesaplar", () => {
    // 1-5 Mayıs = 5 gün (bkz. trip-dates.ts); 4 sayılsaydı günlük
    // ortalama olduğundan büyük çıkardı.
    expect(toplamOzeti(10000, BASLANGIC, BITIS)).toEqual({
      total_cost: 10000,
      daily_cost: 2000,
    });
  });

  it("tarihsiz planda toplamı bölmez", () => {
    expect(toplamOzeti(10000, null, null)).toEqual({
      total_cost: 10000,
      daily_cost: 10000,
    });
  });
});

/* ========================================================================== */
/* Arşiv sütunlarının üzerine yazma                                           */
/* ========================================================================== */

describe("arsivUstuneYazilacaklar", () => {
  const tasinmisPlan = {
    tripId: "gezi-1",
    migratedAt: new Date(),
    startDate: BASLANGIC,
    endDate: BITIS,
  };

  it("taşınmamış planda HİÇBİR ŞEY üretmez", async () => {
    kur({});
    const sonuc = await arsivUstuneYazilacaklar({
      tripId: null,
      migratedAt: null,
      startDate: BASLANGIC,
      endDate: BITIS,
    });

    expect(sonuc).toEqual({});
  });

  it("bütçeyi ve gün planını ilişkisel modelden üretir", async () => {
    kur({
      budgetItem: [
        {
          id: "k1",
          tripId: "gezi-1",
          category: "ulaşım",
          description: "Uçak",
          amount: 4000,
          isPaid: false,
          currency: "TRY",
        },
      ],
      dailyPlan: [
        {
          id: "g1",
          tripId: "gezi-1",
          date: new Date("2026-05-01"),
          notes: null,
          activities: [{ title: "Kolezyum", time: "09:00", cost: 500 }],
        },
      ],
    });

    const sonuc = await arsivUstuneYazilacaklar(tasinmisPlan);

    expect(sonuc.total_cost).toBe(4000);
    expect(sonuc.daily_cost).toBe(800);

    const butce = JSON.parse(sonuc.butce_tahmini as string);
    expect(butce.categories["ulaşım"].total).toBe(4000);

    const gunler = JSON.parse(sonuc.gun_plani as string);
    expect(gunler[0].activities[0].name).toBe("Kolezyum");
  });

  it("KISMİ olabilir: kalem yoksa yalnızca gün planı tazelenir", async () => {
    // Markdown bütçeli bir plan taşındığında kalem üretilmiyor ama günleri
    // taşınıyor. Bütçenin arşivde kalması, sayının kaybolmasını önlüyor.
    kur({
      budgetItem: [],
      dailyPlan: [
        { id: "g1", tripId: "gezi-1", date: new Date("2026-05-01"), notes: null, activities: [] },
      ],
    });

    const sonuc = await arsivUstuneYazilacaklar(tasinmisPlan);

    expect(sonuc.butce_tahmini).toBeUndefined();
    expect(sonuc.total_cost).toBeUndefined();
    expect(sonuc.gun_plani).toBeDefined();
  });
});

/* ========================================================================== */
/* Aktivite → bütçe eşitlemesi                                                */
/* ========================================================================== */

describe("aktiviteButcesiniEsitle", () => {
  function gunluVeri() {
    return {
      budgetItem: [
        {
          id: "k-ulasim",
          tripId: "gezi-1",
          category: "ulaşım",
          description: "Uçak",
          amount: 4000,
          isPaid: false,
          isEstimate: true,
          currency: "TRY",
        },
      ],
      dailyPlan: [
        {
          id: "g1",
          tripId: "gezi-1",
          date: new Date("2026-05-01"),
          notes: null,
          activities: [{ title: "Kolezyum", cost: 500 }],
        },
        {
          id: "g2",
          tripId: "gezi-1",
          date: new Date("2026-05-02"),
          notes: null,
          activities: [{ title: "Vatikan", cost: 300 }, { title: "Yürüyüş", cost: 0 }],
        },
      ],
    };
  }

  it("aktivite maliyetlerini bütçe kalemine çevirir", async () => {
    const { kayitlar } = kur(gunluVeri());

    const toplam = await aktiviteButcesiniEsitle("gezi-1");

    const aktiviteler = kayitlar("budgetItem").filter((k) => k.category === "aktiviteler");
    expect(aktiviteler.map((k) => k.description)).toEqual([
      "1. gün — Kolezyum",
      "2. gün — Vatikan",
    ]);
    expect(toplam).toBe(4800);
  });

  it("MALİYETSİZ aktivite kalem üretmez", async () => {
    const { kayitlar } = kur(gunluVeri());

    await aktiviteButcesiniEsitle("gezi-1");

    const aktiviteler = kayitlar("budgetItem").filter((k) => k.category === "aktiviteler");
    expect(aktiviteler.some((k) => String(k.description).includes("Yürüyüş"))).toBe(false);
  });

  it("DİĞER KATEGORİLERE dokunmaz", async () => {
    // Kategori yeniden yazılıyor; kullanıcının ulaşım/konaklama kalemleri
    // bu işlemin kapsamı dışında olmalı.
    const { kayitlar } = kur(gunluVeri());

    await aktiviteButcesiniEsitle("gezi-1");

    const ulasim = kayitlar("budgetItem").filter((k) => k.category === "ulaşım");
    expect(ulasim).toHaveLength(1);
    expect(ulasim[0].id).toBe("k-ulasim");
  });

  it("ÖDENDİ işaretini korur", async () => {
    // JSON modeli her eşitlemede `isPaid: false` yazıyordu. İlişkisel
    // tarafta kullanıcının işaretini gün kaydında silmek için sebep yok.
    const veri = gunluVeri();
    veri.budgetItem.push({
      id: "k-eski",
      tripId: "gezi-1",
      category: "aktiviteler",
      description: "1. gün — Kolezyum",
      amount: 500,
      isPaid: true,
      isEstimate: true,
      currency: "TRY",
    });

    const { kayitlar } = kur(veri);
    await aktiviteButcesiniEsitle("gezi-1");

    const kolezyum = kayitlar("budgetItem").find(
      (k) => k.description === "1. gün — Kolezyum"
    );
    expect(kolezyum?.isPaid).toBe(true);
    // Eski satır SİLİNMİŞ olmalı; yoksa maliyet iki kez sayılırdı.
    expect(kayitlar("budgetItem").filter((k) => k.category === "aktiviteler")).toHaveLength(2);
  });

  it("aktivite kalmayınca kategoriyi TEMİZLER", async () => {
    const veri = gunluVeri();
    veri.dailyPlan = [
      { id: "g1", tripId: "gezi-1", date: new Date("2026-05-01"), notes: null, activities: [] },
    ];
    veri.budgetItem.push({
      id: "k-eski",
      tripId: "gezi-1",
      category: "aktiviteler",
      description: "1. gün — Kolezyum",
      amount: 500,
      isPaid: false,
      isEstimate: true,
      currency: "TRY",
    });

    const { kayitlar } = kur(veri);
    const toplam = await aktiviteButcesiniEsitle("gezi-1");

    expect(kayitlar("budgetItem").filter((k) => k.category === "aktiviteler")).toHaveLength(0);
    expect(toplam).toBe(4000);
  });

  it("BAŞKA SEYAHATİN kalemlerine dokunmaz", async () => {
    const veri = gunluVeri();
    veri.budgetItem.push({
      id: "k-baska",
      tripId: "gezi-2",
      category: "aktiviteler",
      description: "1. gün — Louvre",
      amount: 700,
      isPaid: false,
      isEstimate: true,
      currency: "TRY",
    });

    const { kayitlar } = kur(veri);
    await aktiviteButcesiniEsitle("gezi-1");

    expect(kayitlar("budgetItem").some((k) => k.id === "k-baska")).toBe(true);
  });
});
