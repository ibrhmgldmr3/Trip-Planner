/**
 * Eski (markdown tabanlı) LLM çıktısı için ayrıştırıcılar.
 *
 * Bu dosya `api/trip-plan-model/route.ts` içinden taşındı. Artık yalnızca
 * GERİYE DÜŞÜŞ (fallback) yolunda kullanılıyor: model yapılandırılmış JSON
 * üretemezse plan hâlâ markdown olarak kaydedilebilsin diye.
 *
 * Taşıma sırasında denetim raporunda tespit edilen hatalar düzeltildi:
 *  - K1: `pratik_bilgiler` kontrolü `sehir_bilgisi`'nden önce geliyor. Eskiden
 *        her iki dal da 'bilgi' kelimesine bakıyordu ve if/else sırası
 *        yüzünden "4. Pratik Bilgiler" başlığı `sehir_bilgisi`'ne düşüyordu.
 *  - K2: Yalnızca '#' ile başlayan satırlar başlık sayılıyor. Eskiden '**' ile
 *        başlayan her kalın satır (ör. "**Sabah (09:00 - 12:00):**") bölüm
 *        sınırı sayılıp günleri parçalıyordu.
 *  - K3: Aynı bölüme ikinci kez girilirse içerik eziliyordu; artık ekleniyor.
 *  - K4: İlk başlıktan önceki metin atılıyordu; artık `sehir_bilgisi`'ne gidiyor.
 *  - B1: Para regex'i bozuk kodlama yüzünden '₺' yerine '?' arıyordu.
 *  - B2: `dailyCost` bağlamı eşleşmenin kendisinden okunduğu için daima 0'dı.
 *  - B3/B4: Sayı biçimleri genişletildi, "toplam" etiketli tutar önceliklendi.
 */

export interface TripPlanSections {
  sehir_bilgisi: string;
  gun_plani: string;
  yemek_rehberi: string;
  pratik_bilgiler: string;
  butce_tahmini: string;
}

type SectionKey = keyof TripPlanSections;

/** ```markdown ... ``` çitlerini soyar; model çıktısında sık görülüyor. */
function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return content;

  const withoutOpen = trimmed.replace(/^```[a-zA-Z]*\s*\n?/, "");
  return withoutOpen.replace(/\n?```\s*$/, "");
}

/** Başlık satırındaki anahtar kelimeden bölümü belirler. */
function detectSection(lowerLine: string): SectionKey | null {
  // DİKKAT: 'pratik' dalı 'bilgi' kelimesini de kapsadığı için ÖNCE gelmeli.
  if (
    lowerLine.includes("pratik") ||
    lowerLine.includes("ulaşım") ||
    lowerLine.includes("güvenlik") ||
    lowerLine.includes("ipuçları")
  ) {
    return "pratik_bilgiler";
  }

  if (
    lowerLine.includes("bütçe") ||
    lowerLine.includes("maliyet") ||
    lowerLine.includes("fiyat") ||
    lowerLine.includes("harcama")
  ) {
    return "butce_tahmini";
  }

  if (
    lowerLine.includes("yeme") ||
    lowerLine.includes("restoran") ||
    lowerLine.includes("lezzet") ||
    lowerLine.includes("yemek") ||
    lowerLine.includes("gastron")
  ) {
    return "yemek_rehberi";
  }

  if (
    lowerLine.includes("gün") ||
    lowerLine.includes("program") ||
    lowerLine.includes("plan") ||
    lowerLine.includes("aktivite")
  ) {
    return "gun_plani";
  }

  if (
    lowerLine.includes("şehir") ||
    lowerLine.includes("genel") ||
    lowerLine.includes("hakkında") ||
    lowerLine.includes("bilgi")
  ) {
    return "sehir_bilgisi";
  }

  return null;
}

/** LLM yanıtını bölümlere ayırır. */
export function parseTripPlanSections(markdownContent: string): TripPlanSections {
  const sections: TripPlanSections = {
    sehir_bilgisi: "",
    gun_plani: "",
    yemek_rehberi: "",
    pratik_bilgiler: "",
    butce_tahmini: "",
  };

  // Günlük planlar ayrı ayrı biriktirilip sonda '---' ile birleştiriliyor;
  // plan-detail sayfası bu ayırıcıyı gün sınırı olarak tanıyor.
  const gunPlaniSections: string[] = [];
  const lines = stripCodeFence(markdownContent).split("\n");

  // İlk başlıktan önceki metin de korunsun diye varsayılan bölümle başlıyoruz.
  let currentSection: SectionKey = "sehir_bilgisi";
  let currentContent: string[] = [];

  const flush = () => {
    const content = currentContent.join("\n").trim();
    if (!content) return;

    if (currentSection === "gun_plani") {
      // Yalnızca başlıktan ibaret bloklar ("## Günlük Detaylı Program" gibi)
      // gün sayılmasın; aksi hâlde plan-detail sahte gün kartları üretiyor.
      const doluSatirSayisi = content.split("\n").filter((l) => l.trim()).length;
      if (doluSatirSayisi > 1) gunPlaniSections.push(content);
      return;
    }

    // Aynı bölüme ikinci kez girilirse ez değil, ekle.
    sections[currentSection] = sections[currentSection]
      ? `${sections[currentSection]}\n\n${content}`
      : content;
  };

  for (const line of lines) {
    if (!line.startsWith("#")) {
      currentContent.push(line);
      continue;
    }

    flush();
    currentSection = detectSection(line.toLowerCase()) ?? currentSection;
    currentContent = [line];
  }

  flush();

  if (gunPlaniSections.length > 0) {
    sections.gun_plani = gunPlaniSections.join("\n\n---\n\n");
  }

  return sections;
}

// Tutar biçimleri: "18.000,50" (binlik nokta), "18000", "1500.75", "1.500".
const TUTAR = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const PARA_BIRIMI = String.raw`₺|TL|TRY|lira`;
const paraRegex = new RegExp(
  String.raw`(?:(?:${PARA_BIRIMI})\s*(${TUTAR}))|(?:(${TUTAR})\s*(?:${PARA_BIRIMI}))`,
  "gi"
);

/** "18.000,50" / "1500.75" / "18000" biçimlerini sayıya çevirir. */
function tutariSayiyaCevir(raw: string): number {
  let normalized = raw;

  if (raw.includes(".") && raw.includes(",")) {
    // Türkçe biçim: nokta binlik, virgül ondalık.
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    // Yalnızca nokta var ve tam üçlü gruplar hâlinde: binlik ayracı.
    normalized = raw.replace(/\./g, "");
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Bir satırdaki tüm TL tutarlarını çıkarır. */
function satirdakiTutarlar(line: string): number[] {
  const amounts: number[] = [];
  paraRegex.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = paraRegex.exec(line)) !== null) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    const value = tutariSayiyaCevir(raw);
    if (value > 0) amounts.push(value);
  }

  return amounts;
}

export interface BudgetInfo {
  totalCost: number;
  dailyCost: number;
}

/**
 * Markdown bütçe metninden toplam ve günlük maliyeti tahmin eder.
 *
 * Bu bir tahmindir: yapılandırılmış yol çalıştığında bu fonksiyona hiç
 * ihtiyaç duyulmaz, çünkü tutarlar modelden sayısal alan olarak gelir.
 */
export function extractBudgetInfo(content: string): BudgetInfo {
  const toplamAdaylari: number[] = [];
  const gunlukAdaylari: number[] = [];
  const tumTutarlar: number[] = [];

  for (const line of content.split("\n")) {
    const amounts = satirdakiTutarlar(line);
    if (amounts.length === 0) continue;

    tumTutarlar.push(...amounts);

    // Bağlam, tutarın kendisinden değil satırın tamamından okunuyor.
    const lower = line.toLowerCase();
    const toplamIndex = lower.lastIndexOf("toplam");
    if (toplamIndex !== -1) {
      // Aynı satırda birden çok tutar olabilir ("Lüks: 45.000 TL, toplam:
      // 18.000 TL"); yalnızca "toplam" kelimesinden SONRAKİLER sayılıyor.
      const sonrasi = satirdakiTutarlar(line.slice(toplamIndex));
      toplamAdaylari.push(...(sonrasi.length > 0 ? sonrasi : amounts));
    }
    if (lower.includes("günlük") || lower.includes("gün başına") || lower.includes("ortalama")) {
      gunlukAdaylari.push(...amounts);
    }
  }

  // "Toplam" etiketli bir satır varsa onu tercih et; yoksa en büyük tutar.
  const totalCost = toplamAdaylari.length > 0
    ? Math.max(...toplamAdaylari)
    : Math.max(0, ...tumTutarlar);

  // Günlük tutar toplamdan büyük olamaz; olursa güvenilmez sayıp atıyoruz.
  const gunlukAday = gunlukAdaylari.length > 0 ? Math.min(...gunlukAdaylari) : 0;
  const dailyCost = gunlukAday > 0 && (totalCost === 0 || gunlukAday <= totalCost) ? gunlukAday : 0;

  return { totalCost, dailyCost };
}
