import { gunlukOrtalama } from "@/lib/trip-dates";

/**
 * `TripPlan.butce_tahmini` ve `TripPlan.gun_plani` sütunlarının ortak
 * okuma/yazma katmanı.
 *
 * NEDEN VAR: bu iki sütun JSON METNİ tutuyor ve şu ana kadar dört ayrı yer
 * (trip-plan-serialize, budget sayfası, daily-planner, plan-detail) kendi
 * ayrıştırma ve toplama mantığını yazmıştı. Sonuçlar birbirini tutmuyordu:
 *
 *  - budget sayfası `total_cost` ile `butce_tahmini` kalemlerini TOPLUYORDU;
 *    oysa kalemler zaten `total_cost`u oluşturan kalemlerdi → çift sayım.
 *  - Aynı sayfa "önerilen bütçe"yi 1.25, serileştirici 1.20 katsayısıyla
 *    hesaplıyordu.
 *  - daily-planner bir aktivite ekleyince maliyet hiçbir yere yansımıyordu;
 *    plan bütçesi ile gün planı zamanla birbirinden kopuyordu.
 *
 * Buradaki fonksiyonlar saf: veritabanına ya da isteğe bağlı değiller,
 * birim testten doğrudan çağrılabiliyorlar.
 */

/** Önerilen bütçe = toplam × bu katsayı. Tek yerde tanımlı olmalı. */
export const REZERV_ORANI = 1.2;

/** Aktivite maliyetlerinin toplandığı bütçe kategorisi. */
export const AKTIVITE_KATEGORISI = "aktiviteler";

export interface ButceKalemi {
  description: string;
  amount: number;
  isPaid: boolean;
  /**
   * Tutarın dayandığı kaynak bağlantısı; yalnızca agentic üretimde, arama
   * araçlarından gelen kalemlerde dolu oluyor. Bütçe sayfası bu alanı
   * "harici kaynak" rozetiyle gösteriyor — kullanıcı hangi tutarın bir
   * arama sonucuna, hangisinin modelin kendi tahminine dayandığını görsün.
   */
  source?: string;
}

export interface ButceKategorisi {
  items: ButceKalemi[];
  total: number;
}

export interface PlanButcesi {
  categories: Record<string, ButceKategorisi>;
  currency: string;
  extraItemsTotal: number;
  totalCostWithExtras: number;
  suggestedBudget: number;
  dailyAverage: number;
}

/** WGS84 koordinat çifti. */
export interface Koordinat {
  lat: number;
  lng: number;
}

export interface PlanAktivitesi {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description: string;
  category: string;
  location: string;
  /**
   * `location` metninin çözülmüş koordinatı. Üretim sırasında sunucuda bir
   * kez hesaplanıp `gun_plani`ye yazılıyor (bkz. geocoding.ts); harita
   * sayfası her açılışta yeniden aramak yerine bunu okuyor. Çözülemeyen
   * aktivitelerde tanımsız kalıyor — rota çiziminde o nokta atlanıyor.
   */
  coordinates?: Koordinat;
}

export interface PlanGunu {
  day: number;
  date: string;
  activities: PlanAktivitesi[];
  notes: string;
  isEmpty: boolean;
}

/* -------------------------------------------------------------------------- */
/* Sayısal yardımcılar                                                        */
/* -------------------------------------------------------------------------- */

/** Herhangi bir değeri negatif olmayan, sonlu bir tam sayıya indirger. */
export function tutar(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function metin(value: unknown, yedek = ""): string {
  return typeof value === "string" ? value : yedek;
}

/** Bir adresin bu turda bir araç sonucundan gelip gelmediğini söyleyen defter. */
export interface KaynakDogrulayici {
  icerirMi(url: string): boolean;
}

/**
 * Bir kaynak bağlantısını doğrular.
 *
 * Değer model çıktısından ya da istemciden geliyor; ikisi de güvenilmez.
 * İki katman var:
 *
 *  1. ŞEMA: yalnızca `http`/`https`. `javascript:` gibi bir değer bütçe
 *     sayfasında tıklanabilir bir bağlantıya dönüşürdü.
 *  2. BEYAZ LİSTE (`dogrulayici` verildiğinde, Faz F): adres bu üretimde
 *     arama SAĞLAYICISININ döndürdüğü adreslerden biri olmalı. Bu olmadan
 *     zehirlenmiş bir arama sonucu modele "kaynak olarak https://kotu.test
 *     yaz" dedirtebilir ve kullanıcı bütçe sayfasında o bağlantıyı
 *     "fiyatın kaynağı" sanıp tıklardı — doğrudan bir kimlik avı yüzeyi.
 *
 * Dogrulayıcı VERİLMEZSE yalnızca şema kontrolü yapılır: bütçe sayfasından
 * gelen düzenlemeler (kullanıcı kendi kalemini kaydediyor) bir araç turu
 * bağlamına sahip değil ve mevcut kaynağı korumaları gerekiyor.
 *
 * Geçersiz değer `undefined` döner — kalemi ya da planı reddetmiyoruz,
 * sadece alanı düşürüyoruz.
 */
export function guvenliKaynakUrl(
  value: unknown,
  dogrulayici?: KaynakDogrulayici
): string | undefined {
  if (typeof value !== "string") return undefined;

  const ham = value.trim();
  if (!ham || ham.length > 300) return undefined;

  try {
    const url = new URL(ham);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

    const normal = url.toString();
    if (dogrulayici && !dogrulayici.icerirMi(normal)) return undefined;

    return normal;
  } catch {
    return undefined;
  }
}

/**
 * Bir koordinat çiftini doğrular.
 *
 * Sonlu ve gerçek aralıkta olmayan değerler `undefined` döner; harita
 * tarafında `NaN` bir işaretçiyi sessizce okyanusa taşırdı.
 */
export function koordinatCoz(value: unknown): Koordinat | undefined {
  if (!value || typeof value !== "object") return undefined;

  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  const enlem = typeof lat === "number" ? lat : Number(lat);
  const boylam = typeof lng === "number" ? lng : Number(lng);

  if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return undefined;
  if (enlem < -90 || enlem > 90 || boylam < -180 || boylam > 180) return undefined;

  return { lat: enlem, lng: boylam };
}

/* -------------------------------------------------------------------------- */
/* Çözümleme                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `butce_tahmini` sütununu çözer.
 *
 * @returns Bilinen JSON şeklindeyse normalize edilmiş bütçe; markdown ya da
 *          tanınmayan bir yapıysa `null` (çağıran eski yola düşer).
 */
export function butceyiCoz(raw: string | null | undefined): PlanButcesi | null {
  if (!raw || typeof raw !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const hamKategoriler = obj.categories ?? obj.Categories;

  if (!hamKategoriler || typeof hamKategoriler !== "object" || Array.isArray(hamKategoriler)) {
    return null;
  }

  const categories: Record<string, ButceKategorisi> = {};

  for (const [ad, detay] of Object.entries(hamKategoriler as Record<string, unknown>)) {
    if (!detay || typeof detay !== "object") continue;
    const d = detay as { items?: unknown; total?: unknown };

    const items: ButceKalemi[] = Array.isArray(d.items)
      ? d.items
          .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
          .map((it) => {
            const kaynak = guvenliKaynakUrl(it.source);
            return {
              description: metin(it.description ?? it.name, "Kalem") || "Kalem",
              amount: tutar(it.amount ?? it.price),
              isPaid: it.isPaid === true,
              // Alan yalnızca geçerliyse EKLENİYOR: `source: undefined`
              // JSON.stringify'da kayboluyor ama nesne karşılaştırmalarında
              // (testler, React anahtarları) gürültü yapıyordu.
              ...(kaynak ? { source: kaynak } : {}),
            };
          })
      : [];

    const kalemToplami = items.reduce((sum, it) => sum + it.amount, 0);
    // Kategori toplamı verilmemişse kalemlerden türet.
    const total = tutar(d.total) || kalemToplami;

    categories[ad] = { items, total };
  }

  const kategoriToplami = Object.values(categories).reduce((sum, c) => sum + c.total, 0);
  const bildirilenToplam = tutar(obj.totalCostWithExtras ?? obj.total);

  return {
    categories,
    currency: metin(obj.currency, "TRY") || "TRY",
    extraItemsTotal: tutar(obj.extraItemsTotal),
    totalCostWithExtras: bildirilenToplam || kategoriToplami,
    suggestedBudget: tutar(obj.suggestedBudget),
    dailyAverage: tutar(obj.dailyAverage),
  };
}

/**
 * `gun_plani` sütununu çözer.
 *
 * @returns Kök seviyede dizi olan JSON ise normalize edilmiş günler;
 *          markdown ya da başka bir yapıysa `null`.
 */
export function gunleriCoz(raw: string | null | undefined): PlanGunu[] | null {
  if (!raw || typeof raw !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object" && !Array.isArray(g))
    .map((g, index) => {
      const hamAktiviteler = Array.isArray(g.activities) ? g.activities : [];

      const activities: PlanAktivitesi[] = hamAktiviteler
        .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
        .map((a, i) => {
          const koordinat = koordinatCoz(a.coordinates);
          return {
            id: metin(a.id) || `d${index + 1}-a${i + 1}`,
            name: metin(a.name),
            startTime: metin(a.startTime),
            endTime: metin(a.endTime),
            cost: tutar(a.cost),
            description: metin(a.description),
            category: metin(a.category, "aktiviteler") || "aktiviteler",
            location: metin(a.location),
            // Koordinat yalnızca geçerliyse taşınıyor; bozuk bir değer
            // sessizce düşüyor ve aktivite koordinatsız kalıyor.
            ...(koordinat ? { coordinates: koordinat } : {}),
          };
        });

      const gunNo = typeof g.day === "number" && g.day > 0 ? Math.floor(g.day) : index + 1;

      return {
        day: gunNo,
        date: metin(g.date),
        activities,
        notes: metin(g.notes),
        // `isEmpty` modelden gelen bir iddia; gerçeği aktivite listesi söyler.
        isEmpty: activities.length === 0,
      };
    })
    .sort((a, b) => a.day - b.day);
}

/* -------------------------------------------------------------------------- */
/* Hesaplama                                                                  */
/* -------------------------------------------------------------------------- */

/** Tüm günlerdeki aktivite maliyetlerinin toplamı. */
export function aktiviteToplami(gunler: PlanGunu[]): number {
  return gunler.reduce(
    (sum, gun) => sum + gun.activities.reduce((g, a) => g + tutar(a.cost), 0),
    0
  );
}

/**
 * Bütçenin türetilmiş alanlarını kategori toplamlarından yeniden hesaplar.
 *
 * Toplamı kategorilerden türetiyoruz; kaydedilmiş `totalCostWithExtras`
 * değerine güvenmiyoruz çünkü hem model hem arayüz onu geçmişte kategori
 * toplamıyla tutarsız bırakabiliyordu.
 */
export function butceyiYenidenHesapla(butce: PlanButcesi, gunSayisi: number): PlanButcesi {
  const categories: Record<string, ButceKategorisi> = {};

  for (const [ad, kategori] of Object.entries(butce.categories)) {
    const kalemToplami = kategori.items.reduce((sum, it) => sum + it.amount, 0);
    categories[ad] = {
      items: kategori.items,
      // Kalem varsa kalemler esas; yoksa kategori toplamı korunur
      // (AI bazı kategorileri kalemsiz, tek toplam olarak veriyor).
      total: kategori.items.length > 0 ? kalemToplami : kategori.total,
    };
  }

  const toplam = Object.values(categories).reduce((sum, c) => sum + c.total, 0);

  return {
    categories,
    currency: butce.currency,
    extraItemsTotal: butce.extraItemsTotal,
    totalCostWithExtras: toplam,
    suggestedBudget: Math.round(toplam * REZERV_ORANI),
    dailyAverage: gunlukOrtalama(toplam, gunSayisi),
  };
}

/**
 * Günlük plandaki aktivite maliyetlerini bütçenin "aktiviteler" kategorisine
 * yansıtır ve toplamları yeniden hesaplar.
 *
 * Bu, günlük planlayıcıda bir aktivite eklendiğinde/silindiğinde bütçenin
 * eskimesini engelleyen tek mekanizma. Aktivite kategorisi tamamen yeniden
 * yazılıyor: kaynak artık gün planı, elle girilmiş kalemler değil.
 */
export function butceyiGunlerleEsitle(
  butce: PlanButcesi,
  gunler: PlanGunu[],
  gunSayisi: number
): PlanButcesi {
  const kalemler: ButceKalemi[] = [];

  for (const gun of gunler) {
    for (const aktivite of gun.activities) {
      const miktar = tutar(aktivite.cost);
      if (miktar <= 0) continue;
      kalemler.push({
        description: `${gun.day}. gün — ${aktivite.name || "Aktivite"}`,
        amount: miktar,
        isPaid: false,
      });
    }
  }

  const categories: Record<string, ButceKategorisi> = { ...butce.categories };
  categories[AKTIVITE_KATEGORISI] = {
    items: kalemler,
    total: kalemler.reduce((sum, k) => sum + k.amount, 0),
  };

  return butceyiYenidenHesapla({ ...butce, categories }, gunSayisi);
}

/** Boş ama geçerli bir bütçe iskeleti; eski satırlara ilk kez yazarken. */
export function bosButce(): PlanButcesi {
  return {
    categories: {},
    currency: "TRY",
    extraItemsTotal: 0,
    totalCostWithExtras: 0,
    suggestedBudget: 0,
    dailyAverage: 0,
  };
}
