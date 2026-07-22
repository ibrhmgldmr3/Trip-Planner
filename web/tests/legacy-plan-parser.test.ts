import { describe, expect, it } from "vitest";
import { extractBudgetInfo, parseTripPlanSections } from "@/lib/legacy-plan-parser";

/**
 * Eski markdown yolunun ayrıştırıcıları. Girdi LLM çıktısı olduğu için
 * testler "ideal markdown" değil, modelin gerçekte ürettiği dağınık biçimleri
 * taklit ediyor.
 */

/** Prompt'un istediği başlıklarla üretilmiş tipik bir model yanıtı. */
const TIPIK_YANIT = `
## 1. Şehir Hakkında Genel Bilgi
İstanbul iki kıtaya yayılan bir metropoldür.

## 2. Günlük Detaylı Program

### Gün 1: Sultanahmet
**Sabah (09:00 - 12:00):** Ayasofya
**Öğleden sonra:** Topkapı Sarayı

### Gün 2: Beyoğlu
**Sabah:** İstiklal Caddesi

## 3. Yeme-İçme Rehberi
Balık ekmek denemelisiniz.

## 4. Pratik Bilgiler
İstanbulkart alın.

## 5. Bütçe Tahmini
Konaklama: 6.000 TL
Toplam: 18.000 TL
Günlük ortalama: 3.000 TL
`.trim();

describe("parseTripPlanSections — bölüm dağıtımı", () => {
  it("beş bölümü de doğru anahtara yazar", () => {
    const s = parseTripPlanSections(TIPIK_YANIT);

    expect(s.sehir_bilgisi).toContain("iki kıtaya yayılan");
    expect(s.gun_plani).toContain("Ayasofya");
    expect(s.yemek_rehberi).toContain("Balık ekmek");
    expect(s.pratik_bilgiler).toContain("İstanbulkart");
    expect(s.butce_tahmini).toContain("18.000 TL");
  });

  it("K1: 'Pratik Bilgiler' başlığı sehir_bilgisi'ne sızmaz", () => {
    // Her iki dal da 'bilgi' kelimesine baktığı için sıralama kritik.
    const s = parseTripPlanSections("## Pratik Bilgiler\nİstanbulkart alın.");
    expect(s.pratik_bilgiler).toContain("İstanbulkart");
    expect(s.sehir_bilgisi).toBe("");
  });

  it("K1: 'Genel Bilgi' başlığı pratik_bilgiler'e sızmaz", () => {
    const s = parseTripPlanSections("## Şehir Hakkında Genel Bilgi\nMetropoldür.");
    expect(s.sehir_bilgisi).toContain("Metropoldür");
    expect(s.pratik_bilgiler).toBe("");
  });

  it("K2: '**' ile başlayan kalın satırlar bölüm sınırı sayılmaz", () => {
    const s = parseTripPlanSections(TIPIK_YANIT);
    // "**Sabah (09:00 - 12:00):**" bir başlık olsaydı gün blokları parçalanırdı.
    expect(s.gun_plani).toContain("Ayasofya");
    expect(s.gun_plani).toContain("Topkapı Sarayı");
    // Aynı gün içindeki iki aktivite arasında gün ayırıcı olmamalı.
    expect(s.gun_plani.split("\n---\n")).toHaveLength(2);
  });

  it("K3: aynı bölüme ikinci kez girilirse içerik ezilmez, eklenir", () => {
    const s = parseTripPlanSections(
      "## Pratik Bilgiler\nBirinci not.\n## Güvenlik\nİkinci not."
    );
    expect(s.pratik_bilgiler).toContain("Birinci not");
    expect(s.pratik_bilgiler).toContain("İkinci not");
  });

  it("K4: ilk başlıktan önceki metin atılmaz, sehir_bilgisi'ne düşer", () => {
    const s = parseTripPlanSections("Bu plan 3 günlüktür.\n\n## Bütçe Tahmini\n5.000 TL");
    expect(s.sehir_bilgisi).toContain("Bu plan 3 günlüktür");
    expect(s.butce_tahmini).toContain("5.000 TL");
  });

  it("tanınmayan başlık mevcut bölümü sürdürür, içeriği kaybetmez", () => {
    const s = parseTripPlanSections("## Bütçe Tahmini\nKonaklama 5.000 TL\n## Zzz\nEk kalem 200 TL");
    expect(s.butce_tahmini).toContain("Konaklama 5.000 TL");
    expect(s.butce_tahmini).toContain("Ek kalem 200 TL");
  });
});

describe("parseTripPlanSections — gün blokları", () => {
  it("her gün ayrı blok olur ve '---' ile birleştirilir", () => {
    const s = parseTripPlanSections(TIPIK_YANIT);
    const gunler = s.gun_plani.split("\n\n---\n\n");
    expect(gunler).toHaveLength(2);
    expect(gunler[0]).toContain("Gün 1");
    expect(gunler[1]).toContain("Gün 2");
  });

  it("yalnızca başlıktan ibaret gün bloğu sahte gün üretmez", () => {
    // "## Günlük Detaylı Program" tek başına bir gün değil.
    const s = parseTripPlanSections(
      "## Günlük Detaylı Program\n\n### Gün 1\nAyasofya gezisi.\n\n### Gün 2\nBoğaz turu."
    );
    const gunler = s.gun_plani.split("\n\n---\n\n");
    expect(gunler).toHaveLength(2);
    expect(s.gun_plani).not.toContain("Detaylı Program");
  });

  it("hiç gün bloğu yoksa gun_plani boş kalır", () => {
    const s = parseTripPlanSections("## Bütçe Tahmini\nToplam 1.000 TL");
    expect(s.gun_plani).toBe("");
  });
});

describe("parseTripPlanSections — sınır durumlar", () => {
  it("```markdown çiti soyulur", () => {
    const s = parseTripPlanSections("```markdown\n## Bütçe Tahmini\nToplam 9.000 TL\n```");
    expect(s.butce_tahmini).toContain("Toplam 9.000 TL");
    expect(s.butce_tahmini).not.toContain("```");
  });

  it("boş girdide tüm bölümler boş string döner", () => {
    const s = parseTripPlanSections("");
    expect(s).toEqual({
      sehir_bilgisi: "",
      gun_plani: "",
      yemek_rehberi: "",
      pratik_bilgiler: "",
      butce_tahmini: "",
    });
  });

  it("başlıksız düz metnin tamamı sehir_bilgisi olur", () => {
    const s = parseTripPlanSections("Sadece birkaç cümlelik plan.");
    expect(s.sehir_bilgisi).toBe("Sadece birkaç cümlelik plan.");
    expect(s.butce_tahmini).toBe("");
  });

  it("başlık satırı içeriğin başında korunur", () => {
    const s = parseTripPlanSections("## Bütçe Tahmini\n1.000 TL");
    expect(s.butce_tahmini.startsWith("## Bütçe Tahmini")).toBe(true);
  });
});

describe("extractBudgetInfo — tutar biçimleri", () => {
  it("B1: '₺' sembolü tanınır", () => {
    expect(extractBudgetInfo("Toplam: ₺18.000").totalCost).toBe(18000);
  });

  it("TL, TRY ve 'lira' yazımları tanınır", () => {
    expect(extractBudgetInfo("Toplam 18.000 TL").totalCost).toBe(18000);
    expect(extractBudgetInfo("Toplam 18.000 TRY").totalCost).toBe(18000);
    expect(extractBudgetInfo("Toplam 18.000 lira").totalCost).toBe(18000);
  });

  it("binlik nokta ve ondalık virgül birlikte çözülür", () => {
    expect(extractBudgetInfo("Toplam: 18.000,50 TL").totalCost).toBe(18000.5);
  });

  it("ayraçsız ve İngilizce ondalıklı biçimler çözülür", () => {
    expect(extractBudgetInfo("Toplam 18000 TL").totalCost).toBe(18000);
    expect(extractBudgetInfo("Toplam 1500.75 TL").totalCost).toBe(1500.75);
  });

  it("binlik nokta gruplu '1.500' 1500 olarak okunur, 1.5 değil", () => {
    expect(extractBudgetInfo("Toplam 1.500 TL").totalCost).toBe(1500);
  });

  it("para birimi tutardan önce de sonra da gelebilir", () => {
    expect(extractBudgetInfo("Toplam TL 7.500").totalCost).toBe(7500);
    expect(extractBudgetInfo("Toplam 7.500 TL").totalCost).toBe(7500);
  });

  it("para birimi olmayan sayılar tutar sayılmaz", () => {
    // "3 gün", "09:00" gibi değerler bütçeye karışmamalı.
    expect(extractBudgetInfo("3 günlük plan, 09:00'da başlıyor")).toEqual({
      totalCost: 0,
      dailyCost: 0,
    });
  });
});

describe("extractBudgetInfo — toplam seçimi", () => {
  it("B4: 'toplam' etiketli tutar, satırdaki daha büyük tutara tercih edilir", () => {
    const bilgi = extractBudgetInfo("Lüks seçenek: 45.000 TL, toplam: 18.000 TL");
    expect(bilgi.totalCost).toBe(18000);
  });

  it("'toplam' etiketi yoksa en büyük tutar toplam sayılır", () => {
    const bilgi = extractBudgetInfo("Konaklama 6.000 TL\nYemek 3.000 TL\nUlaşım 1.200 TL");
    expect(bilgi.totalCost).toBe(6000);
  });

  it("etiketli toplam, etiketsiz daha büyük kalemlere rağmen kazanır", () => {
    const bilgi = extractBudgetInfo("Alışveriş: 90.000 TL\nGenel toplam: 18.000 TL");
    expect(bilgi.totalCost).toBe(18000);
  });

  it("hiç tutar yoksa sıfır döner", () => {
    expect(extractBudgetInfo("Bütçe bilgisi verilmedi.")).toEqual({ totalCost: 0, dailyCost: 0 });
    expect(extractBudgetInfo("")).toEqual({ totalCost: 0, dailyCost: 0 });
  });
});

describe("extractBudgetInfo — günlük maliyet", () => {
  it("B2: 'günlük' etiketli satırdan günlük tutar okunur", () => {
    const bilgi = extractBudgetInfo("Toplam: 18.000 TL\nGünlük ortalama: 3.000 TL");
    expect(bilgi.totalCost).toBe(18000);
    // Bağlam eşleşmenin kendisinden okunsaydı bu değer daima 0 kalırdı.
    expect(bilgi.dailyCost).toBe(3000);
  });

  it("'gün başına' ve 'ortalama' kalıpları da tanınır", () => {
    expect(extractBudgetInfo("Toplam 18.000 TL\nGün başına 2.500 TL").dailyCost).toBe(2500);
    expect(extractBudgetInfo("Toplam 18.000 TL\nOrtalama 2.000 TL").dailyCost).toBe(2000);
  });

  it("her iki ucu da para birimli aralıkta alt sınır alınır", () => {
    const bilgi = extractBudgetInfo("Toplam 30.000 TL\nGünlük 2.000 TL - 3.000 TL");
    expect(bilgi.dailyCost).toBe(2000);
  });

  it("aralığın alt ucunda para birimi yoksa yalnızca üst uç okunur", () => {
    // "2.000" para birimi taşımadığı için tutar sayılmıyor; bu bilinçli bir
    // ödün (bkz. "para birimi olmayan sayılar tutar sayılmaz"). Sonuç günlük
    // maliyeti olduğundan yüksek gösterir — kabul edilen tarafta hata.
    const bilgi = extractBudgetInfo("Toplam 30.000 TL\nGünlük 2.000 - 3.000 TL");
    expect(bilgi.dailyCost).toBe(3000);
  });

  it("günlük tutar toplamdan büyükse güvenilmez sayılıp atılır", () => {
    const bilgi = extractBudgetInfo("Toplam: 2.000 TL\nGünlük: 9.000 TL");
    expect(bilgi.totalCost).toBe(2000);
    expect(bilgi.dailyCost).toBe(0);
  });

  it("toplam bilinmiyorsa günlük tutar yine de raporlanır", () => {
    const bilgi = extractBudgetInfo("Günlük ortalama 2.500 TL");
    // 'toplam' etiketi yok → en büyük tutar toplam olur, günlük ona eşit kalır.
    expect(bilgi.dailyCost).toBe(2500);
  });

  it("günlük bilgisi yoksa 0 döner", () => {
    expect(extractBudgetInfo("Toplam: 18.000 TL").dailyCost).toBe(0);
  });
});

describe("extractBudgetInfo — gerçek bir bütçe bölümü", () => {
  it("çok satırlı bütçe metnini uçtan uca çözer", () => {
    const bilgi = extractBudgetInfo(
      parseTripPlanSections(TIPIK_YANIT).butce_tahmini
    );
    expect(bilgi.totalCost).toBe(18000);
    expect(bilgi.dailyCost).toBe(3000);
  });
});
