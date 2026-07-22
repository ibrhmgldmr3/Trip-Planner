import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * Bu dosya bir güvenlik testidir: girdinin LLM çıktısı olduğu ve dolayısıyla
 * güvenilmez sayıldığı varsayılıyor. Beklentiler "çıktı şuna eşit" değil,
 * "tehlikeli parça çıktıda YOK" biçiminde yazıldı; DOMPurify sürüm geçişinde
 * biçimsel farklar testi kırmasın, ama sızan bir yük mutlaka kırsın.
 */

describe("sanitizeHtml — script yürütme", () => {
  it("<script> etiketini ve içeriğini tamamen kaldırır", () => {
    const temiz = sanitizeHtml('<p>Merhaba</p><script>alert("xss")</script>');
    expect(temiz).toContain("<p>Merhaba</p>");
    expect(temiz).not.toContain("script");
    expect(temiz).not.toContain("alert");
  });

  it("büyük/küçük harf karışık <SCRIPT> de kaldırılır", () => {
    const temiz = sanitizeHtml("<p>a</p><ScRiPt>alert(1)</ScRiPt>");
    expect(temiz.toLowerCase()).not.toContain("script");
    expect(temiz).not.toContain("alert");
  });

  it("SVG içine gizlenmiş script kaldırılır", () => {
    const temiz = sanitizeHtml("<svg><script>alert(1)</script></svg>");
    expect(temiz).not.toContain("alert");
    expect(temiz.toLowerCase()).not.toContain("svg");
  });

  it("<iframe> ve <style> izinli etiket listesinde değildir", () => {
    expect(sanitizeHtml('<iframe src="https://kotu.test"></iframe>')).not.toContain("iframe");
    expect(sanitizeHtml("<style>body{display:none}</style><p>a</p>")).not.toContain("style");
  });
});

describe("sanitizeHtml — olay dinleyici attribute'ları", () => {
  it("onerror kaldırılır", () => {
    const temiz = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(temiz).not.toContain("onerror");
    expect(temiz).not.toContain("alert");
  });

  it("onclick kaldırılır ama etiketin kendisi ve metni kalır", () => {
    const temiz = sanitizeHtml('<p onclick="calistir()">Tıkla</p>');
    expect(temiz).not.toContain("onclick");
    expect(temiz).not.toContain("calistir");
    expect(temiz).toContain("Tıkla");
  });

  it("onload, onmouseover gibi diğer on* attribute'ları da kaldırılır", () => {
    for (const olay of ["onload", "onmouseover", "onfocus", "onanimationstart"]) {
      const temiz = sanitizeHtml(`<div ${olay}="alert(1)">x</div>`);
      expect(temiz, `${olay} temizlenmedi`).not.toContain(olay);
      expect(temiz, `${olay} yükü temizlenmedi`).not.toContain("alert");
    }
  });

  it("style attribute'u kaldırılır (izinli attribute listesinde yok)", () => {
    const temiz = sanitizeHtml('<p style="background:url(javascript:alert(1))">a</p>');
    expect(temiz).not.toContain("style");
    expect(temiz).not.toContain("javascript");
  });
});

describe("sanitizeHtml — URL şemaları", () => {
  it("javascript: şemalı href kaldırılır, bağlantı metni kalır", () => {
    const temiz = sanitizeHtml('<a href="javascript:alert(1)">tıkla</a>');
    expect(temiz).not.toContain("javascript:");
    expect(temiz).not.toContain("href");
    expect(temiz).toContain("tıkla");
  });

  it("harf karıştırma ve satır sonu ile şema gizleme işe yaramaz", () => {
    expect(sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).not.toContain("href");
    // ATTR_WHITESPACE temizliği: "java\nscript:" da javascript: sayılır.
    expect(sanitizeHtml('<a href="java\nscript:alert(1)">x</a>')).not.toContain("href");
    expect(sanitizeHtml('<a href="  javascript:alert(1)">x</a>')).not.toContain("href");
  });

  it("data: şemalı href kaldırılır", () => {
    const temiz = sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>');
    expect(temiz).not.toContain("data:");
    expect(temiz).not.toContain("href");
  });

  it("http, https, mailto ve çapa bağlantıları korunur", () => {
    expect(sanitizeHtml('<a href="https://ornek.test/yol">x</a>')).toContain(
      'href="https://ornek.test/yol"'
    );
    expect(sanitizeHtml('<a href="http://ornek.test">x</a>')).toContain('href="http://ornek.test"');
    expect(sanitizeHtml('<a href="mailto:bilgi@ornek.test">x</a>')).toContain(
      'href="mailto:bilgi@ornek.test"'
    );
    expect(sanitizeHtml('<a href="#butce">x</a>')).toContain('href="#butce"');
  });

  it("göreli bağlantılar da düşer — şema beyaz listesi mutlak URL istiyor", () => {
    // Bilinçli ödün: plan HTML'i dış kaynaklı, uygulama içi göreli link
    // üretmesi beklenmiyor. Bu davranış değişirse burası uyarmalı.
    expect(sanitizeHtml('<a href="/hakkinda">x</a>')).not.toContain("href");
  });
});

describe("sanitizeHtml — izin verilen içeriğin korunması", () => {
  it("başlık, liste ve metin biçimlendirme etiketleri korunur", () => {
    const girdi =
      "<h2>Gün 1</h2><ul><li><strong>Sabah</strong>: <em>müze</em></li></ul>" +
      "<blockquote>not</blockquote><pre><code>x</code></pre>";
    const temiz = sanitizeHtml(girdi);
    for (const etiket of ["h2", "ul", "li", "strong", "em", "blockquote", "pre", "code"]) {
      expect(temiz, `${etiket} korunmadı`).toContain(`<${etiket}>`);
    }
  });

  it("class attribute'u korunur (plan-detail Tailwind sınıfı basıyor)", () => {
    const temiz = sanitizeHtml(
      '<div class="bg-blue-100 p-4"><span class="font-bold">Bütçe</span></div>'
    );
    expect(temiz).toContain('class="bg-blue-100 p-4"');
    expect(temiz).toContain('class="font-bold"');
  });

  it("tablo yapısı ve hücre birleştirme attribute'ları korunur", () => {
    // REGRESYON: ALLOWED_URI_REGEXP, URL taşımayan attribute değerlerine de
    // uygulanıyor. ADD_URI_SAFE_ATTR olmadan colspan/rowspan/align sessizce
    // düşüyor ve bütçe tablosu tek sütuna çöküyordu.
    const temiz = sanitizeHtml(
      '<table><thead><tr><th colspan="2" align="center">Bütçe</th></tr></thead>' +
        '<tbody><tr><td rowspan="2">Konaklama</td><td align="right">1.500 TL</td></tr></tbody></table>'
    );
    expect(temiz).toContain('colspan="2"');
    expect(temiz).toContain('rowspan="2"');
    expect(temiz).toContain('align="center"');
    expect(temiz).toContain('align="right"');
    expect(temiz).toContain("1.500 TL");
  });

  it("güvenli bağlantıda target ve rel korunur", () => {
    const temiz = sanitizeHtml(
      '<a href="https://ornek.test" target="_blank" rel="noopener noreferrer">Site</a>'
    );
    expect(temiz).toContain('target="_blank"');
    expect(temiz).toContain('rel="noopener noreferrer"');
  });

  it("title attribute'u korunur", () => {
    expect(sanitizeHtml('<a href="https://ornek.test" title="Bilgi">x</a>')).toContain(
      'title="Bilgi"'
    );
  });

  it("Türkçe karakterler ve HTML varlıkları bozulmaz", () => {
    const temiz = sanitizeHtml("<p>Çığır açan güzellikler: İzmir, Şile, Ğ &amp; 5 &lt; 7</p>");
    expect(temiz).toContain("Çığır açan güzellikler: İzmir, Şile, Ğ");
    expect(temiz).toContain("&amp;");
    expect(temiz).toContain("&lt;");
  });
});

describe("sanitizeHtml — sınır durumlar", () => {
  it("boş girdi boş çıktı verir", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("etiketsiz düz metin aynen döner", () => {
    expect(sanitizeHtml("Üç günlük İstanbul planı")).toBe("Üç günlük İstanbul planı");
  });

  it("kapanmamış etiket kapatılır, içerik kaybolmaz", () => {
    const temiz = sanitizeHtml("<p>tamamlanmamış");
    expect(temiz).toContain("tamamlanmamış");
    expect(temiz).toContain("</p>");
  });

  it("iç içe geçmiş enjeksiyon denemesi çözülür", () => {
    // Naif bir "<script> ara ve sil" filtresi burada iç içe olanı kaçırır.
    const temiz = sanitizeHtml("<scr<script>ipt>alert(1)</script>");
    expect(temiz.toLowerCase()).not.toContain("<script");
    expect(temiz).not.toContain("alert(1)</");
  });

  it("aynı girdi iki kez temizlendiğinde sonuç değişmez (idempotent)", () => {
    const girdi = '<p onclick="x()">a</p><a href="javascript:1">b</a><h3>c</h3>';
    const birKez = sanitizeHtml(girdi);
    expect(sanitizeHtml(birKez)).toBe(birKez);
  });
});
