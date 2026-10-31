import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ButceDokumu, tl } from "@/components/ButceDokumu";

/**
 * BÜTÇE DÖKÜMÜ BİLEŞENİ (B3).
 *
 * Bu blok eskiden bir HTML STRING üreticisiydi ve `butce_tahmini` sütununu
 * kendi `JSON.parse`ı ile okuyordu. Bileşene çevrilirken üç şeyin
 * korunması gerekiyordu: aynı sınıf adları (CSS `globals.css`te
 * `.plan-govde .butce-*` altında tanımlı), aynı sayılar, ve markdown
 * satırları için yedek yol.
 *
 * NEDEN `renderToStaticMarkup`: projede jsdom ya da Testing Library yok ve
 * bu bileşen için gerekli de değil — hiç etkileşimi yok, tek yaptığı
 * veriyi biçimlendirmek. Statik markup, iddia edilecek her şeyi içeriyor
 * ve test `environment: "node"` altında koşuyor.
 */

function butceJson(govde: Record<string, unknown>): string {
  return JSON.stringify(govde);
}

describe("tl", () => {
  it("tutarı Türkçe biçimde yazar ve yuvarlar", () => {
    expect(tl(12500)).toBe("₺12.500");
    expect(tl(999.6)).toBe("₺1.000");
    expect(tl(0)).toBe("₺0");
  });
});

describe("ButceDokumu", () => {
  it("kategori ve kalemleri beklenen sınıflarla basar", () => {
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: {
            "ulaşım": {
              items: [{ description: "Uçak", amount: 4000, isPaid: true }],
              total: 4000,
            },
            konaklama: {
              items: [{ description: "Otel", amount: 6000, isPaid: false }],
              total: 6000,
            },
          },
          totalCostWithExtras: 10000,
          suggestedBudget: 12000,
        })}
      />
    );

    // CSS `.plan-govde` altında kapsanmış; sarmalayıcı düşerse stiller gider.
    expect(html).toContain('class="plan-govde"');
    expect(html).toContain('class="butce-kategori-ad"');
    expect(html).toContain('class="butce-kalem-tutar"');

    expect(html).toContain("ulaşım");
    expect(html).toContain("konaklama");
    expect(html).toContain("Uçak");
    expect(html).toContain("₺10.000");
    expect(html).toContain("₺12.000");
  });

  it("REGRESYON: toplam yoksa extraItemsTotal'ı 'Toplam' diye göstermez", () => {
    // Eski string üreticisi `totalCostWithExtras ?? extraItemsTotal` yazıyordu.
    // Doğru yedek kategori toplamı: 300 + 700 = 1000.
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: {
            yemek: { items: [], total: 300 },
            "ulaşım": { items: [], total: 700 },
          },
          extraItemsTotal: 50,
        })}
      />
    );

    expect(html).toContain("₺1.000");
    expect(html).not.toContain("₺50");
  });

  it("önerilen bütçe kaydedilmemişse REZERV_ORANI ile türetilir", () => {
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: { yemek: { items: [], total: 1000 } },
        })}
      />
    );

    // 1000 × 1.2
    expect(html).toContain("₺1.200");
  });

  it("kaynaklı kalemde güvenli bağlantı gösterir", () => {
    // Agentic üretimde bir arama sonucuna dayanan tutarların kaynağı
    // kullanıcıya gösterilmeliydi; eski blok bu alanı hiç okumuyordu.
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: {
            konaklama: {
              items: [
                { description: "Otel", amount: 6000, source: "https://otel.test/oda" },
              ],
              total: 6000,
            },
          },
        })}
      />
    );

    expect(html).toContain('href="https://otel.test/oda"');
    // Yeni sekmede açılan bağlantıda `opener` sızıntısına karşı zorunlu.
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("tehlikeli şemalı kaynak hiç basılmaz", () => {
    // `butceyiCoz` → `guvenliKaynakUrl` yalnızca http/https geçiriyor.
    // Bu iddia o zincirin bileşene kadar tuttuğunu doğruluyor.
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: {
            konaklama: {
              items: [
                { description: "Otel", amount: 6000, source: "javascript:alert(1)" },
              ],
              total: 6000,
            },
          },
        })}
      />
    );

    expect(html).toContain("Otel");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("butce-kalem-kaynak");
  });

  it("kalem açıklaması HTML olarak YORUMLANMAZ", () => {
    // Açıklama LLM çıktısı, yani güvenilmez girdi. Eski blok string
    // birleştirmesi yapıyordu ve yalnızca sondaki `sanitizeHtml`e
    // güveniyordu; React metni zaten kaçırıyor.
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw={butceJson({
          categories: {
            yemek: {
              items: [{ description: "<img src=x onerror=alert(1)>", amount: 100 }],
              total: 100,
            },
          },
        })}
      />
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("markdown satırlarında yedek HTML'e düşer", () => {
    const html = renderToStaticMarkup(
      <ButceDokumu
        raw="## Bütçe\n- Ulaşım: 4.000 TL"
        yedekHtml="<p>eski bicim</p>"
      />
    );

    expect(html).toContain("eski bicim");
    expect(html).not.toContain("butce-ozet");
  });

  it("yedek verilmezse markdown satırında boş basar, patlamaz", () => {
    const html = renderToStaticMarkup(<ButceDokumu raw="## Bütçe" />);
    expect(html).toBe('<div class="plan-govde"></div>');
  });
});
