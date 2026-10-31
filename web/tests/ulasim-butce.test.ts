import { describe, expect, it } from "vitest";
import {
  butceyeSehirlerarasiUlasimEkle,
  butceyeUlasimEkle,
  tercihiTuruneCevir,
  ulasimKalemi,
  ulasimSecenegiSec,
  ULASIM_KATEGORISI,
} from "@/lib/ulasim-butce";
import { rotaHesapla } from "@/lib/seyahat-mesafe";
import { bosButce, butceyiYenidenHesapla, type PlanButcesi } from "@/lib/plan-budget";

/**
 * ŞEHİRLERARASI ULAŞIM BÜTÇEYE GİRİYOR (B6).
 *
 * SORUN NEYDİ: AI planlayıcı kalkış şehrini hiç sormuyordu; üretilen
 * bütçede şehir İÇİ ulaşım (metro, taksi) vardı ama oraya nasıl
 * gidileceği YOKTU. "İstanbul'dan Kars'a" planında uçak bileti bütçede
 * görünmüyor, toplam gerçeğin belirgin altında çıkıyordu.
 *
 * Buradaki testler üç şeyi koruyor: doğru seçeneğin seçilmesi, tutarın
 * GİDİŞ-DÖNÜŞ olması ve eklemenin modelin kendi kalemlerini EZMEMESİ.
 */

/** İçinde şehir içi ulaşım kalemi olan gerçekçi bir bütçe. */
function ornekButce(): PlanButcesi {
  return butceyiYenidenHesapla(
    {
      ...bosButce(),
      categories: {
        "ulaşım": {
          items: [{ description: "Şehir içi metro", amount: 300, isPaid: false }],
          total: 300,
        },
        konaklama: {
          items: [{ description: "Otel 3 gece", amount: 4500, isPaid: false }],
          total: 4500,
        },
      },
    },
    3
  );
}

describe("tercihiTuruneCevir", () => {
  it("form etiketlerini hesaplayıcı türlerine çevirir", () => {
    // Form "Araba" diyor, `seyahat-mesafe` "Kendi aracı".
    expect(tercihiTuruneCevir("Araba")).toBe("Kendi aracı");
    expect(tercihiTuruneCevir("Uçak")).toBe("Uçak");
    expect(tercihiTuruneCevir("Tren")).toBe("Tren");
  });

  it("şehir içi seçenekleri tanımaz", () => {
    // "Toplu Taşıma" şehirlerarası bir mod değil; kalem üretilmemeli.
    expect(tercihiTuruneCevir("Toplu Taşıma")).toBeNull();
  });

  it("BÜYÜK HARFLİ yazımı da tanır", () => {
    // Türkçe küçültme tuzağı: varsayılan `toLowerCase` ile "UÇAK" da
    // eşleşir ama "I" taşıyan girdilerde eşleşme bozulur; karşılaştırma
    // `toLocaleLowerCase("tr")` ile yapılıyor.
    expect(tercihiTuruneCevir("UÇAK")).toBe("Uçak");
    expect(tercihiTuruneCevir("  otobüs  ")).toBe("Otobüs");
  });
});

describe("ulasimSecenegiSec", () => {
  const rota = rotaHesapla("İstanbul", "Kars");

  it("kullanıcının tercihini önceler", () => {
    const secenek = ulasimSecenegiSec(rota!, ["Uçak"]);
    expect(secenek?.tur).toBe("Uçak");
  });

  it("tercih yoksa EN UCUZ seçeneği alır", () => {
    // En hızlıyı seçmek, uçak tercihi belirtmemiş kullanıcının bütçesini
    // sessizce uçak biletine göre şişirirdi.
    const secenek = ulasimSecenegiSec(rota!, []);
    const enUcuz = [...rota!.secenekler].sort((a, b) => a.tahminiTl - b.tahminiTl)[0];

    expect(secenek?.tur).toBe(enUcuz.tur);
  });

  it("tanınmayan tercihi atlayıp en ucuza düşer", () => {
    const secenek = ulasimSecenegiSec(rota!, ["Toplu Taşıma"]);
    expect(secenek).not.toBeNull();
  });

  it("seçenek yoksa null döner", () => {
    // Aynı şehir: yolculuk yok.
    const ayni = rotaHesapla("Ankara", "Ankara");
    expect(ulasimSecenegiSec(ayni!, ["Uçak"])).toBeNull();
  });
});

describe("ulasimKalemi", () => {
  const rota = rotaHesapla("İstanbul", "Ankara")!;

  it("tutarı GİDİŞ-DÖNÜŞ olarak yazar", () => {
    // Tek yön yazmak maliyeti yarı yarıya eksik gösterirdi ve kullanıcı
    // bunu ancak dönüş biletini alırken fark ederdi.
    const secenek = rota.secenekler.find((s) => s.tur === "Otobüs")!;
    const kalem = ulasimKalemi(rota, secenek);

    expect(kalem.amount).toBe(secenek.tahminiTl * 2);
  });

  it("açıklamada güzergâh, mod ve TAHMİN olduğu geçiyor", () => {
    const secenek = rota.secenekler[0];
    const kalem = ulasimKalemi(rota, secenek);

    expect(kalem.description).toContain("İstanbul → Ankara");
    expect(kalem.description).toContain("gidiş-dönüş");
    expect(kalem.description).toContain("tahmini");
  });

  it("araç başına maliyeti kişi başından AYIRIR", () => {
    const araba = rota.secenekler.find((s) => s.tur === "Kendi aracı");
    const ucak = rota.secenekler.find((s) => s.tur === "Uçak");

    if (araba) expect(ulasimKalemi(rota, araba).description).toContain("araç başına");
    if (ucak) expect(ulasimKalemi(rota, ucak).description).toContain("kişi başına");
  });

  it("kalem ödenmemiş başlar", () => {
    const kalem = ulasimKalemi(rota, rota.secenekler[0]);
    expect(kalem.isPaid).toBe(false);
  });
});

describe("butceyeUlasimEkle", () => {
  it("modelin kendi ulaşım kalemlerini EZMEZ", () => {
    // Şehir içi metro/taksi kalemleri meşru; şehirlerarası ulaşım onların
    // yerine değil, yanına giriyor.
    const sonuc = butceyeUlasimEkle(
      ornekButce(),
      { description: "İstanbul → Ankara gidiş-dönüş", amount: 1000, isPaid: false },
      3
    );

    const kalemler = sonuc.categories[ULASIM_KATEGORISI].items;
    expect(kalemler).toHaveLength(2);
    expect(kalemler.some((k) => k.description === "Şehir içi metro")).toBe(true);
  });

  it("toplamları yeniden hesaplar", () => {
    const sonuc = butceyeUlasimEkle(
      ornekButce(),
      { description: "gidiş-dönüş", amount: 1000, isPaid: false },
      3
    );

    // 300 (metro) + 1000 (şehirlerarası) + 4500 (otel)
    expect(sonuc.categories[ULASIM_KATEGORISI].total).toBe(1300);
    expect(sonuc.totalCostWithExtras).toBe(5800);
    expect(sonuc.dailyAverage).toBe(1933);
  });

  it("ulaşım kategorisi HİÇ YOKSA açar", () => {
    const sonuc = butceyeUlasimEkle(
      bosButce(),
      { description: "gidiş-dönüş", amount: 1000, isPaid: false },
      2
    );

    expect(sonuc.categories[ULASIM_KATEGORISI].total).toBe(1000);
    expect(sonuc.totalCostWithExtras).toBe(1000);
  });
});

describe("butceyeSehirlerarasiUlasimEkle", () => {
  it("kalkış şehri varsa kalemi ekler", () => {
    const sonuc = butceyeSehirlerarasiUlasimEkle(
      ornekButce(),
      "İstanbul",
      "Ankara",
      ["Otobüs"],
      3
    );

    expect(sonuc).not.toBeNull();
    expect(sonuc!.secenek.tur).toBe("Otobüs");
    expect(sonuc!.butce.totalCostWithExtras).toBeGreaterThan(4800);
  });

  /**
   * Aşağıdaki üç durumun hepsi SESSİZCE geçilmeli. Plan üretimi bunlar
   * için başarısız olmamalı: kullanıcı 4 dakikalık bir LLM zincirinin
   * sonunda "kalkış şehrinizi tanımadım" diye plan kaybetmemeli.
   */
  it("kalkış şehri yoksa null döner", () => {
    expect(butceyeSehirlerarasiUlasimEkle(ornekButce(), "", "Ankara", [], 3)).toBeNull();
    expect(
      butceyeSehirlerarasiUlasimEkle(ornekButce(), undefined, "Ankara", [], 3)
    ).toBeNull();
  });

  it("şehir 81 il listesinde yoksa null döner", () => {
    // Yurt dışı planları: mesafe hesabı yalnızca Türkiye illerini biliyor.
    expect(
      butceyeSehirlerarasiUlasimEkle(ornekButce(), "İstanbul", "Roma", [], 3)
    ).toBeNull();
  });

  it("kalkış ve varış aynıysa null döner", () => {
    expect(
      butceyeSehirlerarasiUlasimEkle(ornekButce(), "Ankara", "Ankara", [], 3)
    ).toBeNull();
  });

  it("girdi bütçesini DEĞİŞTİRMEZ", () => {
    // Saf fonksiyon sözleşmesi: çağıran, ekleme başarısız olduğunda elindeki
    // bütçeyle devam edebilmeli.
    const girdi = ornekButce();
    const oncekiToplam = girdi.totalCostWithExtras;

    butceyeSehirlerarasiUlasimEkle(girdi, "İstanbul", "Ankara", ["Uçak"], 3);

    expect(girdi.totalCostWithExtras).toBe(oncekiToplam);
    expect(girdi.categories[ULASIM_KATEGORISI].items).toHaveLength(1);
  });
});
