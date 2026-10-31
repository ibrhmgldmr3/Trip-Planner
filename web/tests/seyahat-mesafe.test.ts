import { describe, expect, it } from "vitest";
import {
  SEHIRLER,
  karayoluKm,
  kusUcusuKm,
  rotaHesapla,
  sehirBul,
  sureMetni,
} from "@/lib/seyahat-mesafe";

/**
 * Mesafe hesabı doğrulanabilir olmalı: gerçek şehirler arası bilinen
 * mesafelerle karşılaştırıyoruz. Tolerans geniş — bu bir tahmin motoru,
 * navigasyon değil — ama MERTEBE tutmalı.
 */
describe("şehir verisi", () => {
  it("81 il tanımlı ve koordinatlar Türkiye sınırları içinde", () => {
    expect(SEHIRLER).toHaveLength(81);
    for (const s of SEHIRLER) {
      expect(s.enlem, s.ad).toBeGreaterThan(35.5);
      expect(s.enlem, s.ad).toBeLessThan(42.5);
      expect(s.boylam, s.ad).toBeGreaterThan(25.5);
      expect(s.boylam, s.ad).toBeLessThan(45);
    }
  });

  it("il adları benzersiz", () => {
    const adlar = new Set(SEHIRLER.map((s) => s.ad));
    expect(adlar.size).toBe(SEHIRLER.length);
  });

  it("arama Türkçe karakter ve büyük/küçük harf duyarsız", () => {
    expect(sehirBul("istanbul")?.ad).toBe("İstanbul");
    expect(sehirBul("İSTANBUL")?.ad).toBe("İstanbul");
    expect(sehirBul("  Şanlıurfa ")?.ad).toBe("Şanlıurfa");
    expect(sehirBul("Atlantis")).toBeNull();
    expect(sehirBul("")).toBeNull();
  });

  it("ASCII yazımlar da bulunur", () => {
    // Türkçe küçültmede "I" → "ı" olduğu için bunlar eskiden BULUNAMIYORDU.
    expect(sehirBul("Istanbul")?.ad).toBe("İstanbul");
    expect(sehirBul("ISTANBUL")?.ad).toBe("İstanbul");
    expect(sehirBul("Sanliurfa")?.ad).toBe("Şanlıurfa");
    expect(sehirBul("Mugla")?.ad).toBe("Muğla");
    expect(sehirBul("Eskisehir")?.ad).toBe("Eskişehir");
    expect(sehirBul("Kahramanmaras")?.ad).toBe("Kahramanmaraş");
    expect(sehirBul("Agri")?.ad).toBe("Ağrı");
  });

  it("ASCII indirgemesi iki ili aynı anahtara düşürmüyor", () => {
    // Yedek arama ancak belirsizlik yoksa güvenli.
    const anahtarlar = SEHIRLER.map((s) =>
      Array.from(s.ad)
        .map((k) => (({ ı:"i", İ:"i", I:"i", i:"i", ş:"s", Ş:"s", ğ:"g", Ğ:"g",
                        ü:"u", Ü:"u", ö:"o", Ö:"o", ç:"c", Ç:"c", â:"a", Â:"a" } as Record<string,string>)[k] ?? k))
        .join("")
        .toLowerCase()
    );
    expect(new Set(anahtarlar).size).toBe(SEHIRLER.length);
  });
});

describe("mesafe", () => {
  const bul = (ad: string) => {
    const s = sehirBul(ad);
    if (!s) throw new Error(`şehir yok: ${ad}`);
    return s;
  };

  it("İstanbul–Ankara kuş uçuşu ~350 km", () => {
    const km = kusUcusuKm(bul("İstanbul"), bul("Ankara"));
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(370);
  });

  it("İstanbul–Ankara karayolu ~450 km (gerçek: ~450)", () => {
    const km = karayoluKm(bul("İstanbul"), bul("Ankara"));
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(500);
  });

  it("İstanbul–İzmir karayolu ~480 km (gerçek: ~480)", () => {
    const km = karayoluKm(bul("İstanbul"), bul("İzmir"));
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(560);
  });

  it("Ankara–Kars karayolu ~1050 km (gerçek: ~1070)", () => {
    const km = karayoluKm(bul("Ankara"), bul("Kars"));
    expect(km).toBeGreaterThan(900);
    expect(km).toBeLessThan(1200);
  });

  it("mesafe simetrik", () => {
    expect(karayoluKm(bul("Bolu"), bul("Van"))).toBe(karayoluKm(bul("Van"), bul("Bolu")));
  });
});

describe("rotaHesapla", () => {
  it("aynı şehir seçilirse seçenek üretmez", () => {
    const r = rotaHesapla("Ankara", "Ankara");
    expect(r).not.toBeNull();
    expect(r!.secenekler).toHaveLength(0);
  });

  it("tanınmayan şehirde null döner", () => {
    expect(rotaHesapla("Ankara", "Valyria")).toBeNull();
    expect(rotaHesapla("", "Ankara")).toBeNull();
  });

  it("KISA mesafede uçak sunulmaz — sabit süre onu anlamsız kılar", () => {
    // İstanbul–Bolu ~ 200 km karayolu; asgariKm 350'nin altında.
    const r = rotaHesapla("İstanbul", "Bolu")!;
    expect(r.secenekler.some((s) => s.tur === "Uçak")).toBe(false);
    expect(r.secenekler.some((s) => s.tur === "Otobüs")).toBe(true);
  });

  it("UZUN mesafede uçak sunulur ve en hızlı seçenektir", () => {
    const r = rotaHesapla("İstanbul", "Van")!;
    expect(r.secenekler[0].tur).toBe("Uçak");
    // Sıralama süreye göre artan olmalı.
    const sureler = r.secenekler.map((s) => s.sureDk);
    expect([...sureler].sort((a, b) => a - b)).toEqual(sureler);
  });

  it("YHT hattı konvansiyonel hattan belirgin biçimde hızlı", () => {
    // Ankara–Konya YHT; İstanbul–Van konvansiyonel (Van Gölü Ekspresi).
    // Tek hız varsayımıyla doğu hattı üç kat iyimser çıkıyordu.
    const yht = rotaHesapla("Ankara", "Konya")!.secenekler.find((s) => s.tur === "Tren")!;
    const konv = rotaHesapla("İstanbul", "Van")!.secenekler.find((s) => s.tur === "Tren")!;

    const hizYht = yht.mesafeKm / (yht.sureDk / 60);
    const hizKonv = konv.mesafeKm / (konv.sureDk / 60);
    expect(hizYht).toBeGreaterThan(hizKonv * 1.4);

    // Konvansiyonel tren otobüsten hızlı OLMAMALI.
    const otobus = rotaHesapla("İstanbul", "Van")!.secenekler.find((s) => s.tur === "Otobüs")!;
    expect(konv.sureDk).toBeGreaterThan(otobus.sureDk * 0.8);
  });

  it("tren YALNIZCA hattın geçtiği şehirler arasında sunulur", () => {
    // İkisi de ağda: Ankara–Konya (YHT hattı).
    const agda = rotaHesapla("Ankara", "Konya")!;
    expect(agda.secenekler.some((s) => s.tur === "Tren")).toBe(true);

    // Rize demiryolu ağında değil.
    const agdaDegil = rotaHesapla("Ankara", "Rize")!;
    expect(agdaDegil.secenekler.some((s) => s.tur === "Tren")).toBe(false);
  });

  it("süre mesafeyle birlikte artar", () => {
    const yakin = rotaHesapla("İstanbul", "Kocaeli")!;
    const uzak = rotaHesapla("İstanbul", "Antalya")!;
    const otobus = (r: typeof yakin) => r.secenekler.find((s) => s.tur === "Otobüs")!;
    expect(otobus(uzak).sureDk).toBeGreaterThan(otobus(yakin).sureDk);
    expect(otobus(uzak).tahminiTl).toBeGreaterThan(otobus(yakin).tahminiTl);
  });

  it("her seçenek pozitif süre ve maliyet taşır", () => {
    const r = rotaHesapla("Trabzon", "Muğla")!;
    expect(r.secenekler.length).toBeGreaterThan(0);
    for (const s of r.secenekler) {
      expect(s.sureDk, s.tur).toBeGreaterThan(0);
      expect(s.tahminiTl, s.tur).toBeGreaterThan(0);
      expect(s.mesafeKm, s.tur).toBeGreaterThan(0);
      expect(s.sureMetni, s.tur).toMatch(/\d/);
    }
  });
});

describe("maliyet birimi", () => {
  it("bilet kişi başı, kendi aracı araç başınadır", () => {
    const r = rotaHesapla("İstanbul", "Van")!;
    const bul = (t: string) => r.secenekler.find((s) => s.tur === t)!;
    expect(bul("Uçak").maliyetBirimi).toBe("kisi");
    expect(bul("Otobüs").maliyetBirimi).toBe("kisi");
    // Yakıt ve otoyol araca aittir, yolcuya değil; "kişi başı" demek
    // kalabalık bir grupta maliyeti kat kat şişirirdi.
    expect(bul("Kendi aracı").maliyetBirimi).toBe("arac");
  });
});

describe("sureMetni", () => {
  it("saat ve dakikayı okunur biçimde yazar", () => {
    expect(sureMetni(45)).toBe("45 dk");
    expect(sureMetni(60)).toBe("1 sa");
    expect(sureMetni(320)).toBe("5 sa 20 dk");
  });
});
