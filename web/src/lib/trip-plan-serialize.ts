import {
  BUTCE_KATEGORILERI,
  type TripPlanStructured,
} from "@/lib/trip-plan-schema";

/**
 * Yapılandırılmış planı, mevcut tüketicilerin (plan-detail, budget,
 * daily-planner sayfaları) bugün zaten desteklediği kolon biçimlerine çevirir.
 *
 * Kritik kural: BURADAKİ ŞEKİLLER SÖZLEŞMEDİR.
 *  - `gun_plani` KÖK SEVİYEDE DİZİ olmalı (tüketiciler `Array.isArray` şartı
 *    arıyor), her eleman `{day, date, activities[], notes, isEmpty}`.
 *  - `butce_tahmini` `{categories, extraItemsTotal, totalCostWithExtras,
 *    suggestedBudget}` anahtarlarını taşımalı.
 *  - `sehir_bilgisi` / `yemek_rehberi` / `pratik_bilgiler` markdown metin
 *    olmalı; sayfalar bunları markdown formatlayıcıdan geçiriyor.
 *
 * Böylece eski satırlar (markdown) ve yeni satırlar (JSON) yan yana yaşayabilir.
 */

/** daily-planner ve plan-detail'in beklediği aktivite şekli (birleşim). */
interface SerializedActivity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description: string;
  category: string;
  location: string;
}

interface SerializedDay {
  day: number;
  date: string;
  activities: SerializedActivity[];
  notes: string;
  isEmpty: boolean;
}

interface SerializedBudgetCategory {
  items: Array<{ description: string; amount: number; isPaid: boolean }>;
  total: number;
}

interface SerializedBudget {
  categories: Record<string, SerializedBudgetCategory>;
  currency: string;
  extraItemsTotal: number;
  totalCostWithExtras: number;
  suggestedBudget: number;
  dailyAverage: number;
}

export interface SerializedTripPlan {
  sehir_bilgisi: string;
  gun_plani: string;
  yemek_rehberi: string;
  pratik_bilgiler: string;
  butce_tahmini: string;
  raw_markdown: string;
  total_cost: number;
  daily_cost: number;
}

/** "9:5" gibi çıktıları "09:05"e çeker; ayrıştırılamazsa olduğu gibi bırakır. */
function saatiNormalizeEt(value: string): string {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return value.trim();

  const hour = Math.min(23, Number.parseInt(match[1], 10));
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

/** Gün numarasından ISO tarih üretir; başlangıç tarihi yoksa boş döner. */
function gunTarihi(startDate: string | undefined, dayIndex: number): string {
  if (!startDate) return "";

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "";

  const date = new Date(start.getTime());
  date.setDate(date.getDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

function paraFormatla(value: number): string {
  return `₺${Math.round(value).toLocaleString("tr-TR")}`;
}

/** Sadece dolu satırları listeye çevirir (boş madde işareti üretmemek için). */
function madde(lines: Array<string | undefined | null>): string {
  return lines
    .map((line) => (line ?? "").trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");
}

function sehirBilgisiMarkdown(plan: TripPlanStructured): string {
  const { cityInfo } = plan;
  const detaylar = madde([
    cityInfo.population ? `Nüfus: ${cityInfo.population}` : "",
    cityInfo.climate ? `İklim: ${cityInfo.climate}` : "",
    cityInfo.currency ? `Para birimi: ${cityInfo.currency}` : "",
    cityInfo.bestTimeToVisit ? `En iyi ziyaret zamanı: ${cityInfo.bestTimeToVisit}` : "",
  ]);

  return [`## ${plan.city} Hakkında`, cityInfo.summary.trim(), detaylar]
    .filter(Boolean)
    .join("\n\n");
}

function yemekRehberiMarkdown(plan: TripPlanStructured): string {
  const { foodGuide } = plan;
  const bolumler: string[] = ["## Yeme-İçme Rehberi"];

  if (foodGuide.restaurants.length > 0) {
    bolumler.push("### Popüler Restoranlar");
    bolumler.push(
      foodGuide.restaurants
        .map((r) => `- **${r.name}** (${r.cuisine}, ${r.priceRange})${r.note ? ` — ${r.note}` : ""}`)
        .join("\n")
    );
  }

  if (foodGuide.localDishes.length > 0) {
    bolumler.push("### Yerel Lezzetler");
    bolumler.push(madde(foodGuide.localDishes));
  }

  if (foodGuide.budgetTips.length > 0) {
    bolumler.push("### Bütçe Dostu Seçenekler");
    bolumler.push(madde(foodGuide.budgetTips));
  }

  return bolumler.filter(Boolean).join("\n\n");
}

function pratikBilgilerMarkdown(plan: TripPlanStructured): string {
  const { practicalInfo } = plan;
  const bolumler: string[] = ["## Pratik Bilgiler"];

  if (practicalInfo.transportation.length > 0) {
    bolumler.push("### Ulaşım Önerileri");
    bolumler.push(madde(practicalInfo.transportation));
  }

  if (practicalInfo.safety.length > 0) {
    bolumler.push("### Güvenlik İpuçları");
    bolumler.push(madde(practicalInfo.safety));
  }

  if (practicalInfo.notes.length > 0) {
    bolumler.push("### Önemli Notlar");
    bolumler.push(madde(practicalInfo.notes));
  }

  return bolumler.filter(Boolean).join("\n\n");
}

function gunlerMarkdown(days: SerializedDay[]): string {
  const bolumler: string[] = ["## Günlük Detaylı Program"];

  for (const day of days) {
    bolumler.push(`### ${day.day}. Gün${day.date ? ` (${day.date})` : ""}`);

    if (day.activities.length > 0) {
      bolumler.push(
        day.activities
          .map((a) => {
            const saat = a.startTime && a.endTime ? `${a.startTime} - ${a.endTime}` : a.startTime;
            const parcalar = [saat, a.name, a.location, a.cost > 0 ? paraFormatla(a.cost) : ""]
              .filter(Boolean)
              .join(" | ");
            return a.description ? `- **${parcalar}**\n  ${a.description}` : `- **${parcalar}**`;
          })
          .join("\n")
      );
    }

    if (day.notes) bolumler.push(`> ${day.notes}`);
  }

  return bolumler.filter(Boolean).join("\n\n");
}

function butceMarkdown(budget: SerializedBudget): string {
  const satirlar = Object.entries(budget.categories)
    .filter(([, details]) => details.total > 0 || details.items.length > 0)
    .map(([kategori, details]) => `- ${kategori}: ${paraFormatla(details.total)}`);

  return [
    "## Bütçe Tahmini",
    satirlar.join("\n"),
    `- **Toplam tahmini harcama: ${paraFormatla(budget.totalCostWithExtras)}**`,
    budget.dailyAverage > 0 ? `- Günlük ortalama: ${paraFormatla(budget.dailyAverage)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Modelden gelen günleri tüketicilerin beklediği şekle çevirir. */
function gunleriSerilestir(plan: TripPlanStructured, startDate?: string): SerializedDay[] {
  return plan.days.map((day, index) => {
    const gunNo = day.day > 0 ? day.day : index + 1;

    return {
      day: gunNo,
      date: gunTarihi(startDate, index),
      notes: day.notes.trim(),
      isEmpty: day.activities.length === 0,
      activities: day.activities.map((activity, activityIndex) => ({
        // id modelden istenmiyor; istemci anahtarı olarak burada üretiliyor.
        id: `d${gunNo}-a${activityIndex + 1}`,
        name: activity.name.trim(),
        startTime: saatiNormalizeEt(activity.startTime),
        endTime: saatiNormalizeEt(activity.endTime),
        cost: Math.max(0, Math.round(activity.cost)),
        description: activity.description.trim(),
        category: activity.category,
        location: activity.location.trim(),
      })),
    };
  });
}

/**
 * Bütçeyi serileştirir ve tutarlılık kontrolü yapar.
 * Modelin verdiği `total` kategori toplamlarıyla uyuşmuyorsa kategori
 * toplamı esas alınır (modeller toplamayı sık yanlış yapıyor).
 */
function butceyiSerilestir(plan: TripPlanStructured): SerializedBudget {
  const categories: Record<string, SerializedBudgetCategory> = {};
  let kategoriToplami = 0;

  for (const kategori of BUTCE_KATEGORILERI) {
    const details = plan.budget.categories[kategori];
    const items = details.items.map((item) => ({
      description: item.description.trim() || "Kalem",
      amount: Math.max(0, Math.round(item.amount)),
      // Tahmini kalemler ödenmemiş sayılır; budget sayfası bu alanı bekliyor.
      isPaid: false,
    }));

    const kalemToplami = items.reduce((sum, item) => sum + item.amount, 0);
    const total = Math.max(0, Math.round(details.total)) || kalemToplami;

    categories[kategori] = { items, total };
    kategoriToplami += total;
  }

  const modelToplami = Math.max(0, Math.round(plan.budget.total));
  // %10'dan fazla sapma varsa kategori toplamına güven.
  const sapmaBuyuk =
    kategoriToplami > 0 && Math.abs(modelToplami - kategoriToplami) > kategoriToplami * 0.1;
  const total = sapmaBuyuk || modelToplami === 0 ? kategoriToplami : modelToplami;

  const gunSayisi = Math.max(1, plan.days.length);
  const modelGunluk = Math.max(0, Math.round(plan.budget.dailyAverage));
  const dailyAverage = modelGunluk > 0 && modelGunluk <= total ? modelGunluk : Math.round(total / gunSayisi);

  return {
    categories,
    currency: "TRY",
    extraItemsTotal: 0,
    // plan-detail `totalCostWithExtras`a öncelik veriyor.
    totalCostWithExtras: total,
    // plan-detail'in kendi konvansiyonu: önerilen bütçe = toplam * 1.2
    suggestedBudget: Math.round(total * 1.2),
    dailyAverage,
  };
}

/** Yapılandırılmış planı DB kolonlarına ve tam markdown'a çevirir. */
export function serializeStructuredPlan(
  plan: TripPlanStructured,
  options: { startDate?: string; endDate?: string } = {}
): SerializedTripPlan {
  const days = gunleriSerilestir(plan, options.startDate);
  const budget = butceyiSerilestir(plan);

  const sehir_bilgisi = sehirBilgisiMarkdown(plan);
  const yemek_rehberi = yemekRehberiMarkdown(plan);
  const pratik_bilgiler = pratikBilgilerMarkdown(plan);

  const baslik = `# ${plan.city}${plan.country ? `, ${plan.country}` : ""} Seyahat Planı (${plan.durationDays} gün)`;
  const raw_markdown = [
    baslik,
    sehir_bilgisi,
    gunlerMarkdown(days),
    yemek_rehberi,
    pratik_bilgiler,
    butceMarkdown(budget),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    sehir_bilgisi,
    yemek_rehberi,
    pratik_bilgiler,
    // Tüketiciler önce JSON.parse deniyor; kök seviyede dizi/nesne şart.
    gun_plani: JSON.stringify(days),
    butce_tahmini: JSON.stringify(budget),
    raw_markdown,
    total_cost: budget.totalCostWithExtras,
    daily_cost: budget.dailyAverage,
  };
}
