/**
 * Günlük planları ilişkisel modelle eşitlemek için şekil çevirisi ve fark
 * hesabı (B4 · Adım 3).
 *
 * İKİ AYRI SORUN ÇÖZÜLÜYOR:
 *
 * 1. **Alan adları farklı.** `TripPlan.gun_plani` JSON'unda aktivite
 *    `{ name, startTime }`, ilişkisel `DailyPlan.activities` içinde
 *    `{ title, time }`. Taşıma çalıştırıcısı (plan-migration.ts) ilişkisel
 *    tarafı esas alıyor; ekran ise JSON şeklini kullanıyor. Çeviri tek
 *    yerde olmazsa iki şekil zamanla birbirine karışır.
 *
 * 2. **Yazma birimi farklı.** Ekran bütün günleri TOPLU kaydediyor; uç ise
 *    GÜN BAZLI (POST bir gün yaratıyor, PUT birini güncelliyor, DELETE
 *    birini siliyor).
 *
 * EŞLEŞTİRME ANAHTARI TARİH, KİMLİK DEĞİL. Şemada `@@unique([tripId, date])`
 * var: bir seyahatte bir tarihe en fazla bir günlük plan düşüyor. Yani
 * tarih doğal anahtar. Kimlik üzerinden eşleştirmek, ekranın ürettiği
 * geçici id'lerle sunucu cuid'lerini karşılaştırmak demek olurdu ve her
 * kaydetme "hepsini sil, hepsini yeniden yarat"a dönerdi.
 *
 * Bu dosya saf: ağ ya da veritabanı bilmiyor, birim testten doğrudan
 * çağrılabiliyor. Yanlış hesaplanan bir fark kullanıcının gün planını
 * siler — testlenebilir olması isteğe bağlı değil.
 */

import { koordinatCoz, type Koordinat } from "@/lib/plan-budget";

/** `DailyPlan.activities` JSON sütununda saklanan aktivite şekli. */
export interface IliskiselAktivite {
  id?: string;
  title: string;
  description?: string;
  time?: string;
  endTime?: string;
  location?: string;
  cost?: number;
  category?: string;
  /**
   * Çözülmüş konum; harita sayfası rotayı bundan çiziyor.
   *
   * İKİ YÖNDE DE TAŞINIYOR: ekran bu alanı göstermiyor ama üzerinden
   * geçiyor. Çeviride düşseydi, günlük planlayıcıda yapılan HER kaydetme
   * planın haritasını sessizce silerdi.
   */
  coordinates?: Koordinat;
}

/** `GET /api/trip/daily-plans` satırının okuduğumuz alanları. */
export interface IliskiselGun {
  id: string;
  /** ISO damgası ya da "YYYY-MM-DD". */
  date: string;
  title?: string | null;
  notes?: string | null;
  activities?: unknown;
}

/**
 * Ekranın kullandığı aktivite şekli.
 *
 * `plan-budget.ts`'teki `PlanAktivitesi` YENİDEN KULLANILMIYOR: orada
 * `description` ZORUNLU, günlük planlayıcının kendi `Activity` tipinde ise
 * opsiyonel. İkisi de bu fonksiyonlara giriyor, o yüzden burada iki şekli
 * de kabul eden gevşek bir sözleşme tanımlı — dönüştürücüler eksik alanı
 * zaten boş string sayıyor.
 */
export interface EkranAktivitesi {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description?: string;
  category: string;
  location: string;
  /** Bkz. `IliskiselAktivite.coordinates` — ekran yalnızca taşıyıcı. */
  coordinates?: Koordinat;
}

/** Ekranın kullandığı gün şekli. */
export interface EkranGunu {
  day: number;
  date: string;
  activities: EkranAktivitesi[];
  notes: string;
  isEmpty: boolean;
}

/* -------------------------------------------------------------------------- */
/* Şekil çevirisi                                                             */
/* -------------------------------------------------------------------------- */

/** Ekran aktivitesini ilişkisel şekle çevirir. */
export function iliskiselAktiviteyeCevir(
  aktivite: EkranAktivitesi,
  gunNo: number,
  index: number
): IliskiselAktivite {
  // Alanlar opsiyonel olabiliyor (bkz. EkranAktivitesi notu); hepsi
  // güvenle metne indirgeniyor.
  const al = (v: string | undefined) => (typeof v === "string" ? v.trim() : "");

  const kayit: IliskiselAktivite = {
    id: aktivite.id || `d${gunNo}-a${index + 1}`,
    // `title` şemada zorunlu ve `.min(1)`; boş ad kaydı 400'e düşürürdü.
    title: al(aktivite.name) || "Aktivite",
  };

  // Alanlar yalnızca DOLUYSA ekleniyor: `dailyActivitySchema` boş string'i
  // kabul ediyor ama gereksiz alan JSON'u şişiriyor ve fark hesabında
  // "değişmiş" gibi görünen gürültü üretiyor.
  if (al(aktivite.description)) kayit.description = al(aktivite.description);
  if (al(aktivite.startTime)) kayit.time = al(aktivite.startTime);
  if (al(aktivite.endTime)) kayit.endTime = al(aktivite.endTime);
  if (al(aktivite.location)) kayit.location = al(aktivite.location);
  if (aktivite.cost > 0) kayit.cost = Math.round(aktivite.cost);
  if (al(aktivite.category)) kayit.category = al(aktivite.category);

  // Koordinat DOĞRULANARAK taşınıyor: bozuk bir çifti geri yazmak, ucun
  // Zod şemasına takılıp bütün günü kaydedilemez hale getirirdi.
  const koordinat = koordinatCoz(aktivite.coordinates);
  if (koordinat) kayit.coordinates = koordinat;

  return kayit;
}

function metin(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sayi(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** İlişkisel aktiviteyi ekran şekline çevirir. */
export function ekranAktivitesineCevir(
  ham: unknown,
  gunNo: number,
  index: number
): EkranAktivitesi {
  const a = (ham && typeof ham === "object" ? ham : {}) as Record<string, unknown>;

  const koordinat = koordinatCoz(a.coordinates);

  return {
    id: metin(a.id) || `d${gunNo}-a${index + 1}`,
    // Karşı yön: `title` -> `name`, `time` -> `startTime`.
    name: metin(a.title),
    startTime: metin(a.time),
    endTime: metin(a.endTime),
    cost: sayi(a.cost),
    description: metin(a.description),
    category: metin(a.category) || "aktiviteler",
    location: metin(a.location),
    // Yalnızca geçerliyse taşınıyor; bozuk değer aktiviteyi koordinatsız
    // bırakır, haritada o nokta atlanır (bkz. plan-budget.koordinatCoz).
    ...(koordinat ? { coordinates: koordinat } : {}),
  };
}

/**
 * Tarihi "YYYY-MM-DD"ye indirger.
 *
 * Sunucu ISO damgası döndürüyor (`2026-10-01T00:00:00.000Z`), ekran ise
 * düz tarih taşıyor. Karşılaştırmanın iki tarafı aynı çözünürlükte olmalı;
 * aksi halde her gün "değişmiş" görünürdü.
 */
export function gunAnahtari(value: string | null | undefined): string {
  const ham = (value ?? "").trim();
  if (!ham) return "";
  return ham.slice(0, 10);
}

/** `DailyPlan` satırını ekranın gün şekline çevirir. */
export function ekranGununeCevir(satir: IliskiselGun, gunNo: number): EkranGunu {
  const ham = Array.isArray(satir.activities) ? satir.activities : [];
  const activities = ham.map((a, i) => ekranAktivitesineCevir(a, gunNo, i));

  return {
    day: gunNo,
    date: gunAnahtari(satir.date),
    activities,
    notes: satir.notes ?? "",
    // `isEmpty` modelin iddiası değil, aktivite listesinin sonucu.
    isEmpty: activities.length === 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Fark                                                                       */
/* -------------------------------------------------------------------------- */

/** Sunucuya gönderilecek gün gövdesi (POST/PUT ortak alanları). */
export interface GunGovdesi {
  date: string;
  notes: string;
  activities: IliskiselAktivite[];
}

export interface GunlukPlanFarki {
  eklenecek: GunGovdesi[];
  guncellenecek: Array<GunGovdesi & { id: string }>;
  silinecek: string[];
  /**
   * Tarihi olmayan ve bu yüzden eşitlenemeyen günler.
   *
   * Uç `date` alanını ZORUNLU tutuyor. Tarihsiz bir günü sessizce atlamak
   * kullanıcıya "kaydedildi" deyip veriyi kaybetmek olurdu; çağıran bunu
   * uyarı olarak gösteriyor.
   */
  tarihsiz: number[];
}

/** İki gün gövdesi kullanıcıya görünen alanlar açısından aynı mı? */
function ayniMi(a: GunGovdesi, b: GunGovdesi): boolean {
  if (a.notes !== b.notes) return false;
  if (a.activities.length !== b.activities.length) return false;

  // Aktivite sırası anlamlı (gün içindeki akış), o yüzden sırayla
  // karşılaştırılıyor. JSON.stringify yeterli: iki taraf da aynı
  // çeviriden geçtiği için alan sırası da aynı.
  return JSON.stringify(a.activities) === JSON.stringify(b.activities);
}

/** Ekran gününü sunucu gövdesine çevirir. */
export function gunGovdesineCevir(gun: EkranGunu): GunGovdesi {
  return {
    date: gunAnahtari(gun.date),
    notes: gun.notes ?? "",
    activities: gun.activities.map((a, i) => iliskiselAktiviteyeCevir(a, gun.day, i)),
  };
}

/**
 * Ekrandaki günler ile sunucudaki satırlar arasındaki farkı çıkarır.
 *
 * Değişmeyen gün hiçbir listeye girmez: 7 günlük bir planda tek gün
 * düzenlendiğinde 7 istek atmak hem gereksiz hem de 7 ayrı başarısızlık
 * yüzeyi demek.
 */
export function gunlukPlanFarkiCikar(
  ekrandakiler: EkranGunu[],
  sunucudakiler: IliskiselGun[]
): GunlukPlanFarki {
  const sunucuHaritasi = new Map<string, IliskiselGun>();
  for (const satir of sunucudakiler) {
    const anahtar = gunAnahtari(satir.date);
    // Aynı tarih iki kez gelirse (şema kısıtı buna izin vermiyor ama
    // savunma) ilki kazanıyor; ikincisi fazlalık sayılıp siliniyor.
    if (anahtar && !sunucuHaritasi.has(anahtar)) sunucuHaritasi.set(anahtar, satir);
  }

  const eklenecek: GunGovdesi[] = [];
  const guncellenecek: Array<GunGovdesi & { id: string }> = [];
  const tarihsiz: number[] = [];
  const gorulen = new Set<string>();

  for (const gun of ekrandakiler) {
    const govde = gunGovdesineCevir(gun);

    if (!govde.date) {
      tarihsiz.push(gun.day);
      continue;
    }

    // Ekranda aynı tarih iki kez varsa ikincisi yok sayılıyor: POST
    // `@@unique([tripId, date])` yüzünden 409 dönerdi ve kaydetme yarıda
    // kalırdı.
    if (gorulen.has(govde.date)) continue;
    gorulen.add(govde.date);

    const sunucudaki = sunucuHaritasi.get(govde.date);

    if (!sunucudaki) {
      eklenecek.push(govde);
      continue;
    }

    const sunucuGovdesi: GunGovdesi = {
      date: gunAnahtari(sunucudaki.date),
      notes: sunucudaki.notes ?? "",
      activities: (Array.isArray(sunucudaki.activities) ? sunucudaki.activities : []).map(
        (a, i) => iliskiselAktiviteyeCevir(ekranAktivitesineCevir(a, gun.day, i), gun.day, i)
      ),
    };

    if (!ayniMi(govde, sunucuGovdesi)) {
      guncellenecek.push({ ...govde, id: sunucudaki.id });
    }
  }

  const silinecek = sunucudakiler
    .filter((satir) => {
      const anahtar = gunAnahtari(satir.date);
      return anahtar !== "" && !gorulen.has(anahtar);
    })
    .map((satir) => satir.id);

  return { eklenecek, guncellenecek, silinecek, tarihsiz };
}

/** Farkta gerçekten yapılacak bir yazma var mı? */
export function gunFarkiBosMu(fark: GunlukPlanFarki): boolean {
  return (
    fark.eklenecek.length === 0 &&
    fark.guncellenecek.length === 0 &&
    fark.silinecek.length === 0
  );
}
