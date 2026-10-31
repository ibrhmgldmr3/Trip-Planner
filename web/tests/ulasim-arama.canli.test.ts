import { describe, expect, it } from "vitest";
import { zenginRotaHesapla } from "@/lib/ulasim-arama";

/**
 * CANLI TEST — gerçek Tavily çağrısı yapar.
 *
 * Mock'lu bir test bu katmanın çalıştığını KANITLAMAZ: sorgunun gerçekten
 * satış sitesi döndürüp döndürmediği ancak canlı çağrıyla görülür.
 * Anahtar yoksa test kendini atlar.
 */
const anahtarVar = Boolean(process.env.TAVILY_API_KEY);

describe.skipIf(!anahtarVar)("zenginRotaHesapla — canlı", () => {
  it("gerçek satış siteleri döndürür ve tahminleri korur", async () => {
    const r = await zenginRotaHesapla("İstanbul", "Van");
    expect(r).not.toBeNull();
    expect(r!.karayoluKm).toBeGreaterThan(1000);
    expect(r!.secenekler.length).toBeGreaterThan(0);

    const ucak = r!.secenekler.find((s) => s.tur === "Uçak")!;
    expect(ucak.tahminiTl).toBeGreaterThan(0);
    expect(ucak.kaynaklar.length).toBeGreaterThan(0);
    for (const k of ucak.kaynaklar) {
      expect(k.url).toMatch(/^https?:\/\//);
    }

    // Kendi aracı için arama YAPILMAZ: satılan bir bilet değil.
    const arac = r!.secenekler.find((s) => s.tur === "Kendi aracı");
    if (arac) expect(arac.kaynaklar).toHaveLength(0);
  }, 30_000);
}, 40_000);
