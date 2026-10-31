import { describe, expect, it } from "vitest";
import {
  butceFarkiCikar,
  farkBosMu,
  type EsitlenecekKalem,
} from "@/lib/butce-esitleme";

/**
 * BÜTÇE EŞİTLEME (B4).
 *
 * Bu fonksiyonun yanlış hesaplaması kullanıcının bütçe kalemlerini SİLER.
 * Bütçe sayfası toplu kaydediyor, ilişkisel uç kalem bazlı çalışıyor;
 * aradaki çeviri burada ve yalnızca burada.
 */

function kalem(over: Partial<EsitlenecekKalem> = {}): EsitlenecekKalem {
  return {
    id: "k1",
    category: "ulaşım",
    description: "Uçak",
    amount: 4000,
    isPaid: false,
    ...over,
  };
}

describe("butceFarkiCikar", () => {
  it("hiçbir şey değişmediyse üç liste de boş", () => {
    const mevcut = [kalem(), kalem({ id: "k2", category: "konaklama", amount: 6000 })];
    const fark = butceFarkiCikar(mevcut, mevcut);

    expect(fark.eklenecek).toEqual([]);
    expect(fark.guncellenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
    expect(farkBosMu(fark)).toBe(true);
  });

  it("sunucuda olmayan kalemi 'eklenecek' sayar", () => {
    const sunucu = [kalem()];
    const ekran = [kalem(), kalem({ id: "gecici-123", description: "Taksi", amount: 300 })];

    const fark = butceFarkiCikar(ekran, sunucu);

    expect(fark.eklenecek.map((k) => k.description)).toEqual(["Taksi"]);
    expect(fark.guncellenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
  });

  it("ekrandan kaldırılan kalemi 'silinecek' sayar", () => {
    const sunucu = [kalem(), kalem({ id: "k2", description: "Otel" })];
    const ekran = [kalem()];

    const fark = butceFarkiCikar(ekran, sunucu);

    expect(fark.silinecek).toEqual(["k2"]);
    expect(fark.eklenecek).toEqual([]);
  });

  it("DEĞİŞMEYEN kalem güncellenecek listesine GİRMEZ", () => {
    // 20 kalemlik bir bütçede tek kalem düzenlendiğinde 20 istek atmak
    // hem gereksiz hem de 20 ayrı başarısızlık yüzeyi demek.
    const sunucu = [
      kalem({ id: "k1" }),
      kalem({ id: "k2", description: "Otel", amount: 6000 }),
      kalem({ id: "k3", description: "Yemek", amount: 1500 }),
    ];
    const ekran = [
      kalem({ id: "k1" }),
      kalem({ id: "k2", description: "Otel", amount: 6500 }),
      kalem({ id: "k3", description: "Yemek", amount: 1500 }),
    ];

    const fark = butceFarkiCikar(ekran, sunucu);

    expect(fark.guncellenecek).toHaveLength(1);
    expect(fark.guncellenecek[0].id).toBe("k2");
  });

  it.each([
    ["tutar", { amount: 9999 }],
    ["açıklama", { description: "Başka" }],
    ["kategori", { category: "yemek" }],
    ["ödeme durumu", { isPaid: true }],
    ["tahmin bayrağı", { isEstimate: false }],
    ["tarih", { date: "2026-05-01" }],
  ])("%s değişince güncellenecek sayılır", (_ad, degisiklik) => {
    const sunucu = [kalem({ isEstimate: true, date: "" })];
    const ekran = [kalem({ isEstimate: true, date: "", ...degisiklik })];

    expect(butceFarkiCikar(ekran, sunucu).guncellenecek).toHaveLength(1);
  });

  it("isEstimate ve date için varsayılanları eşitler", () => {
    // Sunucu `isEstimate: true` döndürüyor, ekran alanı hiç taşımıyor
    // olabilir. Bunu "değişmiş" saymak her kaydetmede gereksiz PUT üretirdi.
    const sunucu = [kalem({ isEstimate: true, date: "" })];
    const ekran = [kalem()];

    expect(butceFarkiCikar(ekran, sunucu).guncellenecek).toEqual([]);
  });

  it("ekleme, güncelleme ve silmeyi aynı anda ayırır", () => {
    const sunucu = [
      kalem({ id: "k1" }),
      kalem({ id: "k2", description: "Otel" }),
      kalem({ id: "k3", description: "Silinecek" }),
    ];
    const ekran = [
      kalem({ id: "k1" }),
      kalem({ id: "k2", description: "Otel", amount: 7000 }),
      kalem({ id: "yeni-1", description: "Müze", amount: 200 }),
    ];

    const fark = butceFarkiCikar(ekran, sunucu);

    expect(fark.eklenecek.map((k) => k.id)).toEqual(["yeni-1"]);
    expect(fark.guncellenecek.map((k) => k.id)).toEqual(["k2"]);
    expect(fark.silinecek).toEqual(["k3"]);
    expect(farkBosMu(fark)).toBe(false);
  });

  it("aynı sunucu kimliği ekranda iki kez varsa ikincisi YENİ sayılır", () => {
    // Kopyalama gibi bir hata sonucu oluşabiliyor. İkisini de güncelleme
    // saysaydık aynı kaydı iki kez yazıp birini sessizce kaybederdik.
    const sunucu = [kalem({ id: "k1", amount: 100 })];
    const ekran = [
      kalem({ id: "k1", amount: 100 }),
      kalem({ id: "k1", amount: 250 }),
    ];

    const fark = butceFarkiCikar(ekran, sunucu);

    expect(fark.guncellenecek).toEqual([]);
    expect(fark.eklenecek).toHaveLength(1);
    expect(fark.eklenecek[0].amount).toBe(250);
    // En önemlisi: kalem SİLİNMİYOR.
    expect(fark.silinecek).toEqual([]);
  });

  it("ekran boşaltılırsa hepsi silinecek olur", () => {
    const sunucu = [kalem({ id: "k1" }), kalem({ id: "k2" })];
    expect(butceFarkiCikar([], sunucu).silinecek).toEqual(["k1", "k2"]);
  });

  it("sunucu boşsa hepsi eklenecek olur", () => {
    const ekran = [kalem({ id: "a" }), kalem({ id: "b" })];
    const fark = butceFarkiCikar(ekran, []);

    expect(fark.eklenecek).toHaveLength(2);
    expect(fark.silinecek).toEqual([]);
  });
});
