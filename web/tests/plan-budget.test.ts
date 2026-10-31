import { describe, expect, it } from "vitest";
import {
  AKTIVITE_KATEGORISI,
  REZERV_ORANI,
  aktiviteToplami,
  bosButce,
  butceyiCoz,
  butceyiGunlerleEsitle,
  butceyiYenidenHesapla,
  gunleriCoz,
  guvenliKaynakUrl,
  koordinatCoz,
  tutar,
  type PlanButcesi,
} from "@/lib/plan-budget";

function ornekButce(): string {
  return JSON.stringify({
    categories: {
      "ulaşım": {
        items: [{ description: "Uçak", amount: 4000, isPaid: true }],
        total: 4000,
      },
      konaklama: {
        items: [{ description: "Otel", amount: 6000, isPaid: false }],
        total: 6000,
      },
      aktiviteler: { items: [], total: 0 },
    },
    currency: "TRY",
    extraItemsTotal: 0,
    totalCostWithExtras: 10000,
    suggestedBudget: 12000,
    dailyAverage: 2000,
  });
}

describe("tutar", () => {
  it("sayıyı yuvarlar", () => {
    expect(tutar(1234.6)).toBe(1235);
  });

  it("sayısal metni çevirir", () => {
    expect(tutar("500")).toBe(500);
  });

  it("negatif, sıfır ve geçersiz değerlerde 0 döner", () => {
    expect(tutar(-10)).toBe(0);
    expect(tutar(0)).toBe(0);
    expect(tutar("abc")).toBe(0);
    expect(tutar(null)).toBe(0);
    expect(tutar(undefined)).toBe(0);
    expect(tutar(Number.NaN)).toBe(0);
    expect(tutar(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("butceyiCoz", () => {
  it("bilinen JSON şeklini çözer", () => {
    const butce = butceyiCoz(ornekButce());
    expect(butce).not.toBeNull();
    expect(Object.keys(butce!.categories)).toHaveLength(3);
    expect(butce!.totalCostWithExtras).toBe(10000);
    expect(butce!.currency).toBe("TRY");
  });

  it("ödeme durumunu KORUR", () => {
    // Bütçe sayfası bu alanı yüklerken sabit false yazıyordu; kullanıcının
    // "Ödendi" işareti hiçbir zaman geri okunmuyordu.
    const butce = butceyiCoz(ornekButce())!;
    expect(butce.categories["ulaşım"].items[0].isPaid).toBe(true);
    expect(butce.categories.konaklama.items[0].isPaid).toBe(false);
  });

  it("markdown metni için null döner", () => {
    expect(butceyiCoz("## Bütçe\n- Ulaşım: 4.000 TL")).toBeNull();
  });

  it("boş ve tanınmayan girdilerde null döner", () => {
    expect(butceyiCoz(null)).toBeNull();
    expect(butceyiCoz(undefined)).toBeNull();
    expect(butceyiCoz("")).toBeNull();
    expect(butceyiCoz("[]")).toBeNull();
    expect(butceyiCoz('{"toplam": 5}')).toBeNull();
  });

  it("büyük harfli Categories anahtarını da tanır", () => {
    const ham = JSON.stringify({ Categories: { yemek: { items: [], total: 900 } } });
    expect(butceyiCoz(ham)?.categories.yemek.total).toBe(900);
  });

  it("kategori toplamı yoksa kalemlerden türetir", () => {
    const ham = JSON.stringify({
      categories: { yemek: { items: [{ description: "Akşam", amount: 300 }] } },
    });
    expect(butceyiCoz(ham)?.categories.yemek.total).toBe(300);
  });

  it("toplam bildirilmemişse kategori toplamını kullanır", () => {
    const ham = JSON.stringify({
      categories: { yemek: { items: [], total: 300 }, "ulaşım": { items: [], total: 700 } },
    });
    expect(butceyiCoz(ham)?.totalCostWithExtras).toBe(1000);
  });

  it("toplam yoksa extraItemsTotal'a DÜŞMEZ", () => {
    // REGRESYON: plan detay sayfası kendi ayrıştırıcısında
    // `totalCostWithExtras ?? extraItemsTotal` yazıyordu. `extraItemsTotal`
    // bir toplam DEĞİL — kategori dışı kalemlerin tutarı. Toplam alanı boş
    // bir satırda ekranda "Toplam: ₺50" görünüyordu; doğrusu ₺1.000.
    const ham = JSON.stringify({
      categories: { yemek: { items: [], total: 300 }, "ulaşım": { items: [], total: 700 } },
      extraItemsTotal: 50,
    });

    const butce = butceyiCoz(ham)!;
    expect(butce.totalCostWithExtras).toBe(1000);
    // Alan okunuyor ama toplama KATILMIYOR; adına rağmen türetilmiş
    // alanların hiçbirine girmiyor (bkz. PlanButcesi.extraItemsTotal notu).
    expect(butce.extraItemsTotal).toBe(50);
  });

  it("bozuk kalemleri eler, sayfayı düşürmez", () => {
    const ham = JSON.stringify({
      categories: { yemek: { items: [null, 5, { description: "Ok", amount: 100 }], total: 100 } },
    });
    const butce = butceyiCoz(ham);
    expect(butce?.categories.yemek.items).toHaveLength(1);
  });
});

describe("gunleriCoz", () => {
  it("dizi JSON'unu normalize eder", () => {
    const ham = JSON.stringify([
      { day: 1, date: "2026-01-01", activities: [{ name: "Müze", cost: 200 }], notes: "not" },
      { day: 2, date: "2026-01-02", activities: [], notes: "" },
    ]);
    const gunler = gunleriCoz(ham)!;
    expect(gunler).toHaveLength(2);
    expect(gunler[0].activities[0].name).toBe("Müze");
    expect(gunler[0].activities[0].cost).toBe(200);
    expect(gunler[0].isEmpty).toBe(false);
    expect(gunler[1].isEmpty).toBe(true);
  });

  it("isEmpty iddiasını gerçek aktivite listesine göre düzeltir", () => {
    const ham = JSON.stringify([{ day: 1, activities: [{ name: "X" }], isEmpty: true }]);
    expect(gunleriCoz(ham)![0].isEmpty).toBe(false);
  });

  it("gün numarası yoksa sırayla numaralandırır", () => {
    const ham = JSON.stringify([{ activities: [] }, { activities: [] }]);
    const gunler = gunleriCoz(ham)!;
    expect(gunler.map((g) => g.day)).toEqual([1, 2]);
  });

  it("günleri sıralar", () => {
    const ham = JSON.stringify([{ day: 3, activities: [] }, { day: 1, activities: [] }]);
    expect(gunleriCoz(ham)!.map((g) => g.day)).toEqual([1, 3]);
  });

  it("markdown ve nesne kökü için null döner", () => {
    expect(gunleriCoz("### 1. Gün")).toBeNull();
    expect(gunleriCoz('{"day":1}')).toBeNull();
    expect(gunleriCoz(null)).toBeNull();
  });
});

describe("aktiviteToplami", () => {
  it("tüm günlerdeki maliyetleri toplar", () => {
    const gunler = gunleriCoz(
      JSON.stringify([
        { day: 1, activities: [{ name: "A", cost: 100 }, { name: "B", cost: 250 }] },
        { day: 2, activities: [{ name: "C", cost: 50 }] },
      ])
    )!;
    expect(aktiviteToplami(gunler)).toBe(400);
  });

  it("boş planda 0 döner", () => {
    expect(aktiviteToplami([])).toBe(0);
  });
});

describe("butceyiYenidenHesapla", () => {
  it("toplamı kategorilerden türetir ve bildirilen toplamı yok sayar", () => {
    const butce: PlanButcesi = {
      ...bosButce(),
      categories: {
        "ulaşım": { items: [{ description: "Uçak", amount: 4000, isPaid: false }], total: 999 },
        konaklama: { items: [], total: 6000 },
      },
      // Bilerek yanlış: model ve arayüz bu alanı tutarsız bırakabiliyordu.
      totalCostWithExtras: 123,
    };

    const sonuc = butceyiYenidenHesapla(butce, 5);

    // Kalemi olan kategori kalemlerden, olmayan kategori kendi toplamından.
    expect(sonuc.categories["ulaşım"].total).toBe(4000);
    expect(sonuc.categories.konaklama.total).toBe(6000);
    expect(sonuc.totalCostWithExtras).toBe(10000);
    expect(sonuc.dailyAverage).toBe(2000);
    expect(sonuc.suggestedBudget).toBe(Math.round(10000 * REZERV_ORANI));
  });

  it("gün sayısı 0 iken sıfıra bölmez", () => {
    const butce: PlanButcesi = {
      ...bosButce(),
      categories: { yemek: { items: [], total: 500 } },
    };
    expect(butceyiYenidenHesapla(butce, 0).dailyAverage).toBe(500);
  });
});

describe("butceyiGunlerleEsitle", () => {
  it("aktivite maliyetlerini bütçeye yansıtır", () => {
    const butce = butceyiCoz(ornekButce())!;
    const gunler = gunleriCoz(
      JSON.stringify([
        { day: 1, activities: [{ name: "Müze", cost: 300 }] },
        { day: 2, activities: [{ name: "Tekne", cost: 700 }] },
      ])
    )!;

    const sonuc = butceyiGunlerleEsitle(butce, gunler, 5);

    expect(sonuc.categories[AKTIVITE_KATEGORISI].total).toBe(1000);
    expect(sonuc.categories[AKTIVITE_KATEGORISI].items).toHaveLength(2);
    // 4000 + 6000 + 1000
    expect(sonuc.totalCostWithExtras).toBe(11000);
    expect(sonuc.dailyAverage).toBe(2200);
  });

  it("aktivite silindiğinde toplam DÜŞER", () => {
    const butce = butceyiCoz(ornekButce())!;
    const dolu = butceyiGunlerleEsitle(
      butce,
      gunleriCoz(JSON.stringify([{ day: 1, activities: [{ name: "Müze", cost: 300 }] }]))!,
      2
    );
    const bos = butceyiGunlerleEsitle(
      dolu,
      gunleriCoz(JSON.stringify([{ day: 1, activities: [] }]))!,
      2
    );

    expect(dolu.totalCostWithExtras).toBe(10300);
    expect(bos.totalCostWithExtras).toBe(10000);
  });

  it("ücretsiz aktiviteleri kalem olarak eklemez", () => {
    const gunler = gunleriCoz(
      JSON.stringify([{ day: 1, activities: [{ name: "Sahil yürüyüşü", cost: 0 }] }])
    )!;
    const sonuc = butceyiGunlerleEsitle(bosButce(), gunler, 1);
    expect(sonuc.categories[AKTIVITE_KATEGORISI].items).toHaveLength(0);
    expect(sonuc.totalCostWithExtras).toBe(0);
  });

  it("diğer kategorilere dokunmaz", () => {
    const butce = butceyiCoz(ornekButce())!;
    const sonuc = butceyiGunlerleEsitle(butce, [], 3);
    expect(sonuc.categories["ulaşım"].total).toBe(4000);
    expect(sonuc.categories.konaklama.items[0].isPaid).toBe(false);
  });

  it("çalıştırma tekrarlansa da sonuç değişmez (idempotent)", () => {
    const gunler = gunleriCoz(
      JSON.stringify([{ day: 1, activities: [{ name: "Müze", cost: 300 }] }])
    )!;
    const bir = butceyiGunlerleEsitle(butceyiCoz(ornekButce())!, gunler, 3);
    const iki = butceyiGunlerleEsitle(bir, gunler, 3);
    expect(iki).toEqual(bir);
  });
});

/* -------------------------------------------------------------------------- */
/* Faz C — bütçe kalemi kaynağı                                               */
/* -------------------------------------------------------------------------- */

describe("guvenliKaynakUrl", () => {
  it("http ve https adreslerini kabul eder", () => {
    expect(guvenliKaynakUrl("https://ornek.test/otel")).toBe("https://ornek.test/otel");
    expect(guvenliKaynakUrl("http://ornek.test/")).toBe("http://ornek.test/");
  });

  it("javascript: ve data: şemalarını reddeder", () => {
    // Bu değer bütçe sayfasında tıklanabilir bir <a href> oluyor; şema
    // filtresi olmadan XSS yüzeyi açılırdı.
    expect(guvenliKaynakUrl("javascript:alert(1)")).toBeUndefined();
    expect(guvenliKaynakUrl("data:text/html,<script>")).toBeUndefined();
  });

  it("ayrıştırılamayan, boş ve aşırı uzun değerleri reddeder", () => {
    expect(guvenliKaynakUrl("otel fiyatları")).toBeUndefined();
    expect(guvenliKaynakUrl("")).toBeUndefined();
    expect(guvenliKaynakUrl("   ")).toBeUndefined();
    expect(guvenliKaynakUrl(`https://ornek.test/${"a".repeat(400)}`)).toBeUndefined();
  });

  it("string olmayan değerlerde undefined döner", () => {
    expect(guvenliKaynakUrl(undefined)).toBeUndefined();
    expect(guvenliKaynakUrl(42)).toBeUndefined();
    expect(guvenliKaynakUrl({ url: "https://ornek.test" })).toBeUndefined();
  });
});

describe("butceyiCoz — kaynak alanı", () => {
  it("geçerli kaynağı kaleme taşır", () => {
    const butce = butceyiCoz(
      JSON.stringify({
        categories: {
          konaklama: {
            items: [
              { description: "Otel", amount: 6000, isPaid: false, source: "https://otel.test/x" },
            ],
            total: 6000,
          },
        },
      })
    );

    expect(butce?.categories.konaklama.items[0].source).toBe("https://otel.test/x");
  });

  it("geçersiz kaynağı sessizce düşürür ama kalemi korur", () => {
    const butce = butceyiCoz(
      JSON.stringify({
        categories: {
          konaklama: {
            items: [{ description: "Otel", amount: 6000, source: "javascript:alert(1)" }],
            total: 6000,
          },
        },
      })
    );

    expect(butce?.categories.konaklama.items[0]).toEqual({
      description: "Otel",
      amount: 6000,
      isPaid: false,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Faz D — aktivite koordinatları                                             */
/* -------------------------------------------------------------------------- */

describe("koordinatCoz", () => {
  it("geçerli çifti normalize eder", () => {
    expect(koordinatCoz({ lat: 41.9, lng: 12.5 })).toEqual({ lat: 41.9, lng: 12.5 });
  });

  it("metin olarak gelen sayıları çevirir", () => {
    // Bir JSON round-trip'inde ya da istemciden gelen gövdede sayılar
    // string olabiliyor.
    expect(koordinatCoz({ lat: "41.9", lng: "12.5" })).toEqual({ lat: 41.9, lng: 12.5 });
  });

  it("aralık dışı ve sonlu olmayan değerleri reddeder", () => {
    expect(koordinatCoz({ lat: 91, lng: 0 })).toBeUndefined();
    expect(koordinatCoz({ lat: 0, lng: 181 })).toBeUndefined();
    expect(koordinatCoz({ lat: Number.NaN, lng: 0 })).toBeUndefined();
    expect(koordinatCoz({ lat: 0 })).toBeUndefined();
  });

  it("nesne olmayan değerlerde undefined döner", () => {
    expect(koordinatCoz(null)).toBeUndefined();
    expect(koordinatCoz("41.9,12.5")).toBeUndefined();
  });
});

describe("gunleriCoz — koordinatlar", () => {
  it("geçerli koordinatı aktiviteye taşır", () => {
    const gunler = gunleriCoz(
      JSON.stringify([
        {
          day: 1,
          activities: [{ name: "Kolezyum", coordinates: { lat: 41.8902, lng: 12.4922 } }],
        },
      ])
    );

    expect(gunler?.[0].activities[0].coordinates).toEqual({ lat: 41.8902, lng: 12.4922 });
  });

  it("bozuk koordinatta aktiviteyi koordinatsız bırakır, düşürmez", () => {
    const gunler = gunleriCoz(
      JSON.stringify([
        { day: 1, activities: [{ name: "Kolezyum", coordinates: { lat: "abc", lng: 12 } }] },
      ])
    );

    expect(gunler?.[0].activities).toHaveLength(1);
    expect(gunler?.[0].activities[0].coordinates).toBeUndefined();
  });

  it("koordinatlar bir kaydet/oku turunda korunur", () => {
    // daily-planner ve /map bu sütunu okuyup geri yazıyor; round-trip'te
    // koordinat kaybolursa rota çizimi sessizce boşalır.
    const ilk = gunleriCoz(
      JSON.stringify([
        { day: 1, activities: [{ name: "Kolezyum", coordinates: { lat: 41.89, lng: 12.49 } }] },
      ])
    );

    const ikinci = gunleriCoz(JSON.stringify(ilk));
    expect(ikinci?.[0].activities[0].coordinates).toEqual({ lat: 41.89, lng: 12.49 });
  });
});
