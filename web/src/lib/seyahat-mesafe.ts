/**
 * Şehirler arası mesafe, süre ve tahmini maliyet.
 *
 * NEDEN VAR: manuel planlayıcı ulaşım adımında rotadan BAĞIMSIZ üç sabit
 * seçenek gösteriyordu — İstanbul'dan Bolu'ya da, İstanbul'dan Kars'a da
 * "Otobüs · 8 saat · ₺150" yazıyordu. Süre ve fiyat artık gerçekten
 * seçilen iki şehir arasındaki mesafeden türetiliyor.
 *
 * TAHMİN OLDUĞU AÇIKÇA SÖYLENİR: burada sefer tarifesi ya da canlı bilet
 * fiyatı yok. Hesap; kuş uçuşu mesafe → karayolu düzeltmesi → moda göre
 * ortalama hız ve sabit ek süre şeklinde ilerliyor. Arayüz bu değerleri
 * "tahmini" etiketiyle gösterir.
 */

export interface Sehir {
  ad: string;
  enlem: number;
  boylam: number;
}

/**
 * 81 il, koordinatlarıyla.
 *
 * Kaynak: il merkezlerinin yaklaşık koordinatları. Mesafe hesabı için
 * merkez koordinatı yeterli — sokak seviyesinde doğruluk gerekmiyor.
 */
export const SEHIRLER: Sehir[] = [
  { ad: "Adana", enlem: 37.0, boylam: 35.321 },
  { ad: "Adıyaman", enlem: 37.764, boylam: 38.278 },
  { ad: "Afyonkarahisar", enlem: 38.756, boylam: 30.538 },
  { ad: "Ağrı", enlem: 39.719, boylam: 43.051 },
  { ad: "Aksaray", enlem: 38.373, boylam: 34.029 },
  { ad: "Amasya", enlem: 40.653, boylam: 35.833 },
  { ad: "Ankara", enlem: 39.933, boylam: 32.859 },
  { ad: "Antalya", enlem: 36.897, boylam: 30.713 },
  { ad: "Ardahan", enlem: 41.11, boylam: 42.702 },
  { ad: "Artvin", enlem: 41.183, boylam: 41.819 },
  { ad: "Aydın", enlem: 37.848, boylam: 27.845 },
  { ad: "Balıkesir", enlem: 39.649, boylam: 27.886 },
  { ad: "Bartın", enlem: 41.638, boylam: 32.337 },
  { ad: "Batman", enlem: 37.887, boylam: 41.132 },
  { ad: "Bayburt", enlem: 40.26, boylam: 40.228 },
  { ad: "Bilecik", enlem: 40.142, boylam: 29.979 },
  { ad: "Bingöl", enlem: 38.885, boylam: 40.498 },
  { ad: "Bitlis", enlem: 38.401, boylam: 42.108 },
  { ad: "Bolu", enlem: 40.736, boylam: 31.606 },
  { ad: "Burdur", enlem: 37.72, boylam: 30.29 },
  { ad: "Bursa", enlem: 40.183, boylam: 29.067 },
  { ad: "Çanakkale", enlem: 40.156, boylam: 26.414 },
  { ad: "Çankırı", enlem: 40.601, boylam: 33.616 },
  { ad: "Çorum", enlem: 40.55, boylam: 34.956 },
  { ad: "Denizli", enlem: 37.777, boylam: 29.086 },
  { ad: "Diyarbakır", enlem: 37.915, boylam: 40.224 },
  { ad: "Düzce", enlem: 40.844, boylam: 31.157 },
  { ad: "Edirne", enlem: 41.677, boylam: 26.556 },
  { ad: "Elazığ", enlem: 38.681, boylam: 39.226 },
  { ad: "Erzincan", enlem: 39.75, boylam: 39.492 },
  { ad: "Erzurum", enlem: 39.905, boylam: 41.265 },
  { ad: "Eskişehir", enlem: 39.776, boylam: 30.521 },
  { ad: "Gaziantep", enlem: 37.066, boylam: 37.383 },
  { ad: "Giresun", enlem: 40.913, boylam: 38.39 },
  { ad: "Gümüşhane", enlem: 40.46, boylam: 39.481 },
  { ad: "Hakkâri", enlem: 37.574, boylam: 43.741 },
  { ad: "Hatay", enlem: 36.202, boylam: 36.161 },
  { ad: "Iğdır", enlem: 39.923, boylam: 44.045 },
  { ad: "Isparta", enlem: 37.765, boylam: 30.554 },
  { ad: "İstanbul", enlem: 41.008, boylam: 28.978 },
  { ad: "İzmir", enlem: 38.424, boylam: 27.143 },
  { ad: "Kahramanmaraş", enlem: 37.578, boylam: 36.937 },
  { ad: "Karabük", enlem: 41.204, boylam: 32.628 },
  { ad: "Karaman", enlem: 37.181, boylam: 33.215 },
  { ad: "Kars", enlem: 40.602, boylam: 43.095 },
  { ad: "Kastamonu", enlem: 41.376, boylam: 33.776 },
  { ad: "Kayseri", enlem: 38.735, boylam: 35.48 },
  { ad: "Kırıkkale", enlem: 39.846, boylam: 33.515 },
  { ad: "Kırklareli", enlem: 41.735, boylam: 27.225 },
  { ad: "Kırşehir", enlem: 39.146, boylam: 34.161 },
  { ad: "Kilis", enlem: 36.716, boylam: 37.115 },
  { ad: "Kocaeli", enlem: 40.766, boylam: 29.916 },
  { ad: "Konya", enlem: 37.874, boylam: 32.493 },
  { ad: "Kütahya", enlem: 39.424, boylam: 29.983 },
  { ad: "Malatya", enlem: 38.355, boylam: 38.309 },
  { ad: "Manisa", enlem: 38.614, boylam: 27.429 },
  { ad: "Mardin", enlem: 37.312, boylam: 40.735 },
  { ad: "Mersin", enlem: 36.812, boylam: 34.641 },
  { ad: "Muğla", enlem: 37.215, boylam: 28.363 },
  { ad: "Muş", enlem: 38.735, boylam: 41.491 },
  { ad: "Nevşehir", enlem: 38.624, boylam: 34.723 },
  { ad: "Niğde", enlem: 37.966, boylam: 34.679 },
  { ad: "Ordu", enlem: 40.985, boylam: 37.879 },
  { ad: "Osmaniye", enlem: 37.075, boylam: 36.248 },
  { ad: "Rize", enlem: 41.02, boylam: 40.523 },
  { ad: "Sakarya", enlem: 40.774, boylam: 30.396 },
  { ad: "Samsun", enlem: 41.286, boylam: 36.33 },
  { ad: "Siirt", enlem: 37.933, boylam: 41.94 },
  { ad: "Sinop", enlem: 42.026, boylam: 35.153 },
  { ad: "Sivas", enlem: 39.748, boylam: 37.018 },
  { ad: "Şanlıurfa", enlem: 37.159, boylam: 38.796 },
  { ad: "Şırnak", enlem: 37.519, boylam: 42.454 },
  { ad: "Tekirdağ", enlem: 40.978, boylam: 27.511 },
  { ad: "Tokat", enlem: 40.314, boylam: 36.554 },
  { ad: "Trabzon", enlem: 41.005, boylam: 39.727 },
  { ad: "Tunceli", enlem: 39.107, boylam: 39.548 },
  { ad: "Uşak", enlem: 38.674, boylam: 29.406 },
  { ad: "Van", enlem: 38.494, boylam: 43.38 },
  { ad: "Yalova", enlem: 40.655, boylam: 29.276 },
  { ad: "Yozgat", enlem: 39.82, boylam: 34.804 },
  { ad: "Zonguldak", enlem: 41.456, boylam: 31.798 },
];

/** Ad → şehir; tam yazım (Türkçe küçük harfe indirgenmiş). */
const SEHIR_HARITASI = new Map(
  SEHIRLER.map((s) => [s.ad.toLocaleLowerCase("tr-TR"), s])
);

/**
 * Türkçe harfleri ASCII karşılığına indirger.
 *
 * NEDEN GEREKLİ: Türkçe küçültme kuralı "I" harfini "ı"ya çeviriyor, yani
 * `"Istanbul".toLocaleLowerCase("tr-TR")` → `"ıstanbul"`. Bu, kayıtlı
 * `"istanbul"` anahtarıyla EŞLEŞMİYOR. Sonuç: klavyesinde Türkçe karakter
 * olmayan biri ya da ASCII gönderen bir istemci "Istanbul", "Mugla",
 * "Eskisehir" yazdığında şehir bulunamıyordu — ölçüldü.
 */
function asciiye(metin: string): string {
  const esle: Record<string, string> = {
    ı: "i", İ: "i", I: "i", i: "i",
    ş: "s", Ş: "s",
    ğ: "g", Ğ: "g",
    ü: "u", Ü: "u",
    ö: "o", Ö: "o",
    ç: "c", Ç: "c",
    // Düzeltme imli ünlüler: "Hakkâri" listede â ile yazılı ama kullanıcı
    // "Hakkari" de yazabiliyor. î/û listede geçmiyor, yine de kullanıcı
    // girdisinde görülebildiği için eşleniyor.
    â: "a", Â: "a",
    î: "i", Î: "i",
    û: "u", Û: "u",
  };
  return Array.from(metin)
    .map((k) => esle[k] ?? k)
    .join("")
    .toLowerCase();
}

/** Ad → şehir; ASCII'ye indirgenmiş yazım. Yalnızca yedek olarak kullanılır. */
const ASCII_HARITASI = new Map(SEHIRLER.map((s) => [asciiye(s.ad), s]));

/**
 * Şehir araması.
 *
 * Önce tam yazımı dener, bulamazsa ASCII karşılığına düşer. İki aşamalı
 * olmasının sebebi: tam eşleşme belirsizlik taşımıyor, ASCII indirgeme ise
 * teorik olarak taşıyabilir (bu listede çakışma yok, test bunu koruyor).
 */
export function sehirBul(ad: string): Sehir | null {
  const ham = (ad ?? "").trim();
  if (!ham) return null;

  const tam = SEHIR_HARITASI.get(ham.toLocaleLowerCase("tr-TR"));
  if (tam) return tam;

  return ASCII_HARITASI.get(asciiye(ham)) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Mesafe                                                                     */
/* -------------------------------------------------------------------------- */

const DUNYA_YARICAPI_KM = 6371;

/** Kuş uçuşu (büyük daire) mesafe — haversine. */
export function kusUcusuKm(a: Sehir, b: Sehir): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dEnlem = rad(b.enlem - a.enlem);
  const dBoylam = rad(b.boylam - a.boylam);
  const h =
    Math.sin(dEnlem / 2) ** 2 +
    Math.cos(rad(a.enlem)) * Math.cos(rad(b.enlem)) * Math.sin(dBoylam / 2) ** 2;
  return 2 * DUNYA_YARICAPI_KM * Math.asin(Math.sqrt(h));
}

/**
 * Karayolu düzeltme katsayısı.
 *
 * Yollar kuş uçuşu gitmez. Türkiye'nin dağlık coğrafyasında karayolu
 * mesafesi kuş uçuşunun tipik olarak %25–30 üstünde çıkar; 1.27 ortalama
 * bir kabul. Bu bir ÖLÇÜM değil, kabul edilmiş bir katsayı.
 */
const KARAYOLU_KATSAYISI = 1.27;

export function karayoluKm(a: Sehir, b: Sehir): number {
  return Math.round(kusUcusuKm(a, b) * KARAYOLU_KATSAYISI);
}

/* -------------------------------------------------------------------------- */
/* Ulaşım modları                                                             */
/* -------------------------------------------------------------------------- */

export type UlasimTuru = "Uçak" | "Otobüs" | "Tren" | "Kendi aracı";

interface ModTanimi {
  tur: UlasimTuru;
  /** Yol üstündeki ortalama hız (km/sa). */
  hizKmSa: number;
  /**
   * Yolculuğa eklenen sabit süre (saat): havalimanına gidiş, güvenlik,
   * biniş, varışta şehre iniş; otobüste terminal ve molalar.
   */
  sabitSureSa: number;
  /** Kilometre başına tahmini maliyet (₺). */
  kmBasiTl: number;
  /** Yolculuk başına sabit maliyet (₺). */
  sabitTl: number;
  /** Maliyet kişi başına mı, araç başına mı? */
  maliyetBirimi: "kisi" | "arac";
  /** Bu modun anlamlı olduğu en kısa mesafe (km). */
  asgariKm: number;
  saglayici: string;
}

/**
 * Mod parametreleri.
 *
 * Değerler kaba ama tutarlı: uçak kısa mesafede kazanmaz (sabit süre onu
 * yer), otobüs her mesafede çalışır, kendi aracı yakıt + otoyol üzerinden
 * hesaplanır. Amaç gerçek bilet fiyatı vermek değil, iki şehir arasındaki
 * MERTEBEYİ doğru göstermek.
 */
const MODLAR: ModTanimi[] = [
  {
    tur: "Uçak",
    maliyetBirimi: "kisi",
    hizKmSa: 700,
    sabitSureSa: 2.5,
    kmBasiTl: 1.15,
    sabitTl: 650,
    asgariKm: 350,
    saglayici: "Tarifeli sefer",
  },
  {
    tur: "Otobüs",
    maliyetBirimi: "kisi",
    hizKmSa: 68,
    sabitSureSa: 0.6,
    kmBasiTl: 1.05,
    sabitTl: 60,
    asgariKm: 0,
    saglayici: "Karayolu firması",
  },
  {
    tur: "Tren",
    maliyetBirimi: "kisi",
    hizKmSa: 110,
    sabitSureSa: 0.7,
    kmBasiTl: 0.75,
    sabitTl: 40,
    asgariKm: 0,
    saglayici: "TCDD",
  },
  {
    tur: "Kendi aracı",
    maliyetBirimi: "arac",
    hizKmSa: 78,
    sabitSureSa: 0.3,
    // Yakıt + otoyol; ~7.5 L/100km ve güncel akaryakıt mertebesiyle.
    kmBasiTl: 3.4,
    sabitTl: 0,
    asgariKm: 0,
    saglayici: "Özel araç",
  },
];

/**
 * YÜKSEK HIZLI TREN ağındaki iller.
 *
 * İki şehir de bu kümedeyse yolculuk YHT hızıyla hesaplanıyor.
 */
const YHT_AGI = new Set([
  "İstanbul", "Kocaeli", "Sakarya", "Bilecik", "Eskişehir", "Ankara",
  "Konya", "Karaman", "Kırıkkale", "Yozgat", "Sivas",
]);

/**
 * KONVANSİYONEL demiryolu ağındaki iller.
 *
 * Türkiye'de her il çifti arasında tren yok; her rotaya tren seçeneği
 * koymak kullanıcıya var olmayan bir seçenek göstermek olurdu.
 *
 * HIZ AYRIMI NEDEN ŞART: bu iki ağ aynı hızda çalışmıyor. Tek bir 110 km/sa
 * varsayımıyla İstanbul–Van treni "15 saat" çıkıyordu; gerçek Van Gölü
 * Ekspresi 40 saatin üzerinde sürüyor. Konvansiyonel hat çok daha yavaş ve
 * çok daha dolambaçlı.
 */
const KONVANSIYONEL_AG = new Set([
  ...YHT_AGI,
  "Kayseri", "Malatya", "Elazığ", "Diyarbakır", "Batman", "Kars", "Erzurum",
  "Erzincan", "İzmir", "Manisa", "Uşak", "Afyonkarahisar", "Denizli",
  "Aydın", "Balıkesir", "Kütahya", "Adana", "Mersin", "Osmaniye",
  "Gaziantep", "Şanlıurfa", "Isparta", "Burdur", "Zonguldak", "Karabük",
  "Çankırı", "Amasya", "Tokat", "Samsun", "Niğde", "Adıyaman",
  // Van Gölü Ekspresi hattı: Tatvan (Bitlis) üzerinden Van.
  "Bitlis", "Van", "Muş",
]);

/** Konvansiyonel hattın ortalama hızı (km/sa) — duraklar ve tek hat dâhil. */
const KONVANSIYONEL_HIZ_KM_SA = 52;

export interface UlasimTahmini {
  tur: UlasimTuru;
  saglayici: string;
  /** Kapıdan kapıya tahmini süre (dakika). */
  sureDk: number;
  /** İnsan tarafından okunacak süre, örn. "5 sa 20 dk". */
  sureMetni: string;
  /** Kişi başı tahmini maliyet (₺). */
  tahminiTl: number;
  /** Bu modda kat edilen mesafe (km) — uçakta kuş uçuşu, diğerlerinde karayolu. */
  mesafeKm: number;
  /**
   * Maliyet kime ait?
   *
   * Bilette maliyet KİŞİ başınadır; kendi aracında yakıt ve otoyol ARAÇ
   * başınadır ve yolcu sayısına bölünür. İkisini "kişi başı" diye
   * etiketlemek kalabalık bir grupta araba maliyetini kat kat şişiriyordu.
   */
  maliyetBirimi: "kisi" | "arac";
}

export interface RotaOzeti {
  nereden: Sehir;
  nereye: Sehir;
  kusUcusuKm: number;
  karayoluKm: number;
  secenekler: UlasimTahmini[];
}

/** Dakikayı "5 sa 20 dk" biçimine çevirir. */
export function sureMetni(dakika: number): string {
  const saat = Math.floor(dakika / 60);
  const dk = Math.round(dakika % 60);
  if (saat === 0) return `${dk} dk`;
  if (dk === 0) return `${saat} sa`;
  return `${saat} sa ${dk} dk`;
}

/**
 * İki şehir arasındaki ulaşım seçeneklerini hesaplar.
 *
 * Aynı şehir seçilirse boş liste döner — çağıran taraf bunu bir doğrulama
 * hatası olarak gösterir.
 */
export function rotaHesapla(neredenAd: string, nereyeAd: string): RotaOzeti | null {
  const nereden = sehirBul(neredenAd);
  const nereye = sehirBul(nereyeAd);
  if (!nereden || !nereye) return null;

  const kus = Math.round(kusUcusuKm(nereden, nereye));
  const yol = karayoluKm(nereden, nereye);

  // Aynı şehir: yolculuk yok.
  if (kus < 5) {
    return { nereden, nereye, kusUcusuKm: kus, karayoluKm: yol, secenekler: [] };
  }

  const secenekler: UlasimTahmini[] = [];

  for (const mod of MODLAR) {
    if (yol < mod.asgariKm) continue;
    if (
      mod.tur === "Tren" &&
      !(KONVANSIYONEL_AG.has(nereden.ad) && KONVANSIYONEL_AG.has(nereye.ad))
    ) {
      continue;
    }

    // Uçak kuş uçuşu gider; diğerleri karayolunu izler.
    const mesafe = mod.tur === "Uçak" ? kus : yol;

    // Tren hızı hatta bağlı: iki uç da YHT ağındaysa hızlı, değilse
    // konvansiyonel. Tek hız varsaymak doğu hatlarını üç kat iyimser
    // gösteriyordu.
    const hiz =
      mod.tur === "Tren" && !(YHT_AGI.has(nereden.ad) && YHT_AGI.has(nereye.ad))
        ? KONVANSIYONEL_HIZ_KM_SA
        : mod.hizKmSa;

    const sureDk = Math.round((mesafe / hiz + mod.sabitSureSa) * 60);
    // 10 TL'ye yuvarla: bu bir tahmin, kuruşlu göstermek sahte bir
    // kesinlik izlenimi verir.
    const tahminiTl = Math.round((mod.sabitTl + mesafe * mod.kmBasiTl) / 10) * 10;

    secenekler.push({
      tur: mod.tur,
      saglayici: mod.saglayici,
      maliyetBirimi: mod.maliyetBirimi,
      sureDk,
      sureMetni: sureMetni(sureDk),
      tahminiTl,
      mesafeKm: Math.round(mesafe),
    });
  }

  // En hızlıdan yavaşa: kullanıcı ulaşım seçerken önce süreye bakıyor.
  secenekler.sort((a, b) => a.sureDk - b.sureDk);

  return { nereden, nereye, kusUcusuKm: kus, karayoluKm: yol, secenekler };
}
