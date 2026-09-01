import { describe, expect, it } from "vitest";
import {
  geceSayisi,
  gunSayisi,
  gunlukOrtalama,
  isoGunTarihi,
  MAKS_GUN,
  tarihiCoz,
} from "@/lib/trip-dates";

describe("tarihiCoz", () => {
  it("YYYY-MM-DD biçimini yerel öğlene sabitler", () => {
    const d = tarihiCoz("2026-03-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(15);
    // Öğlen sabitlemesi: saat dilimi kaydırması günü değiştirmesin.
    expect(d!.getHours()).toBe(12);
  });

  it("Date nesnesini olduğu gibi döndürür", () => {
    const kaynak = new Date(2026, 0, 1, 8, 30);
    expect(tarihiCoz(kaynak)).toBe(kaynak);
  });

  it("boş ve geçersiz girdilerde null döner", () => {
    expect(tarihiCoz(null)).toBeNull();
    expect(tarihiCoz(undefined)).toBeNull();
    expect(tarihiCoz("")).toBeNull();
    expect(tarihiCoz("bugün")).toBeNull();
    expect(tarihiCoz(new Date("gecersiz"))).toBeNull();
  });

  it("ISO zaman damgasını da çözer", () => {
    const d = tarihiCoz("2026-03-15T10:20:30.000Z");
    expect(d).not.toBeNull();
    expect(Number.isNaN(d!.getTime())).toBe(false);
  });
});

describe("gunSayisi", () => {
  it("aralığı KAPSAYICI sayar", () => {
    // Asıl düzeltme: eski formül burada 4 dönüyordu.
    expect(gunSayisi("2026-01-01", "2026-01-05")).toBe(5);
  });

  it("aynı gün 1 gündür", () => {
    expect(gunSayisi("2026-01-01", "2026-01-01")).toBe(1);
  });

  it("ardışık iki gün 2 gündür", () => {
    expect(gunSayisi("2026-01-01", "2026-01-02")).toBe(2);
  });

  it("bitiş başlangıçtan önceyse 0 (bilinmiyor) döner", () => {
    expect(gunSayisi("2026-01-05", "2026-01-01")).toBe(0);
  });

  it("tarih eksikse 0 döner", () => {
    expect(gunSayisi(null, "2026-01-05")).toBe(0);
    expect(gunSayisi("2026-01-01", null)).toBe(0);
    expect(gunSayisi(undefined, undefined)).toBe(0);
  });

  it("geçersiz tarihte 0 döner", () => {
    expect(gunSayisi("yarın", "2026-01-05")).toBe(0);
  });

  it("üst sınırı aşmaz", () => {
    expect(gunSayisi("2026-01-01", "2030-01-01")).toBe(MAKS_GUN);
  });

  it("ay ve yıl sınırlarını doğru geçer", () => {
    expect(gunSayisi("2026-01-30", "2026-02-02")).toBe(4);
    expect(gunSayisi("2025-12-30", "2026-01-02")).toBe(4);
  });

  it("artık günü sayar", () => {
    // 2028 artık yıl: 28 → 29 Şubat = 2 gün.
    expect(gunSayisi("2028-02-28", "2028-02-29")).toBe(2);
  });

  it("saat bilgisini yok sayar", () => {
    const bas = new Date(2026, 0, 1, 23, 30);
    const bit = new Date(2026, 0, 2, 0, 30);
    // Aradaki fark bir saat olsa da iki AYRI gün.
    expect(gunSayisi(bas, bit)).toBe(2);
  });
});

describe("geceSayisi", () => {
  it("gün sayısının bir eksiğidir", () => {
    expect(geceSayisi("2026-01-01", "2026-01-05")).toBe(4);
    expect(geceSayisi("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("bilinmeyen aralıkta 0 döner", () => {
    expect(geceSayisi(null, null)).toBe(0);
    expect(geceSayisi("2026-01-05", "2026-01-01")).toBe(0);
  });
});

describe("isoGunTarihi", () => {
  it("başlangıçtan itibaren gün ekler", () => {
    expect(isoGunTarihi("2026-01-01", 0)).toBe("2026-01-01");
    expect(isoGunTarihi("2026-01-01", 4)).toBe("2026-01-05");
  });

  it("ay sınırını geçer", () => {
    expect(isoGunTarihi("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("başlangıç yoksa boş string döner", () => {
    expect(isoGunTarihi(null, 2)).toBe("");
    expect(isoGunTarihi("", 0)).toBe("");
  });

  it("yerel gün kaymaz (UTC'ye çevirmiyor)", () => {
    // toISOString kullanılsaydı negatif offset'li saat dilimlerinde
    // 2026-01-01 → "2025-12-31" çıkabilirdi.
    expect(isoGunTarihi("2026-01-01", 0)).toBe("2026-01-01");
  });
});

describe("gunlukOrtalama", () => {
  it("toplamı gün sayısına böler", () => {
    expect(gunlukOrtalama(1000, 4)).toBe(250);
  });

  it("yuvarlar", () => {
    expect(gunlukOrtalama(1000, 3)).toBe(333);
  });

  it("gün sayısı 0 ise toplamı döner (sıfıra bölme yok)", () => {
    expect(gunlukOrtalama(1000, 0)).toBe(1000);
  });

  it("toplam 0 veya geçersizse 0 döner", () => {
    expect(gunlukOrtalama(0, 5)).toBe(0);
    expect(gunlukOrtalama(-100, 5)).toBe(0);
    expect(gunlukOrtalama(Number.NaN, 5)).toBe(0);
    expect(gunlukOrtalama(Number.POSITIVE_INFINITY, 5)).toBe(0);
  });
});
