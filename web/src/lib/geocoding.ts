import { env } from "@/env";
import { logger, truncate } from "@/lib/logger";
import { koordinatCoz, type Koordinat, type PlanGunu } from "@/lib/plan-budget";

/**
 * Sunucu taraflı adres → koordinat çözümü (Google Geocoding API).
 *
 * NEDEN SUNUCUDA: harita sayfası bugün her açılışta Places araması
 * yapıyordu. Aynı plan her görüntülendiğinde aynı adresler yeniden
 * aranıyor, kota her seferinde yeniden harcanıyordu. Koordinat plana ait
 * bir veri — bir kez, üretim sırasında çözülüp `gun_plani` JSON'una
 * yazılıyor; sayfa yalnızca okuyor.
 *
 * ANAHTAR AYRI: `GOOGLE_MAPS_SERVER_API_KEY`, tarayıcıdaki
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` DEĞİL. Tarayıcı anahtarı HTTP referrer
 * kısıtlı; sunucudan gelen isteğin referrer'ı yok ve Google onu
 * REQUEST_DENIED ile reddediyor (bkz. src/env.ts).
 *
 * HİÇBİR FONKSİYON FIRLATMAZ. Geocoding bir plan üretiminin yan işi;
 * kotanın dolması ya da ağın kopması yüzünden dakikalar süren bir üretimin
 * çöpe gitmesi kabul edilemez. Çözülemeyen aktivite koordinatsız kalır.
 */

const GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

/** Tek bir adres isteğinin zaman aşımı. */
const ISTEK_ZAMAN_ASIMI_MS = 5_000;

/**
 * Tüm toplu işin üst sınırı.
 *
 * Üretim akışında plan DB'ye yazılmadan ÖNCE çalışıyor; buradaki her
 * saniye kullanıcının beklediği süreye ekleniyor. Süre dolduğunda kalan
 * aktiviteler koordinatsız bırakılıyor.
 */
const TOPLU_SURE_BUTCESI_MS = 20_000;

/**
 * Bir planda çözülecek en fazla BENZERSİZ adres sayısı.
 *
 * 30 günlük, günde 12 aktivitelik bir plan 360 istek demek. Sınır hem
 * maliyeti hem süreyi kapatıyor; kullanıcı için ilk günlerin rotası
 * çizilebiliyor olması yeterli.
 */
const MAKS_ADRES = 60;

/** Aynı anda kaç isteğin uçtuğu. Google saniyelik hız sınırı uyguluyor. */
const ES_ZAMANLI = 4;

export function geocodingYapilandirilmisMi(): boolean {
  return Boolean(env.GOOGLE_MAPS_SERVER_API_KEY?.trim());
}

/**
 * Tek bir adresi çözer.
 *
 * @returns Koordinat, ya da çözülemediyse `null`. ASLA fırlatmaz.
 */
export async function adresiCoz(adres: string): Promise<Koordinat | null> {
  if (!geocodingYapilandirilmisMi()) return null;

  const sorgu = adres.trim();
  if (!sorgu) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ISTEK_ZAMAN_ASIMI_MS);

  try {
    const url = new URL(GEOCODE_ENDPOINT);
    url.searchParams.set("address", sorgu);
    url.searchParams.set("key", env.GOOGLE_MAPS_SERVER_API_KEY as string);

    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      logger.warn("Geocoding isteği başarısız", undefined, { status: response.status });
      return null;
    }

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: unknown } }>;
    };

    // ZERO_RESULTS beklenen bir sonuç (belirsiz adres), uyarı basmıyoruz.
    // Diğer durumlar (REQUEST_DENIED, OVER_QUERY_LIMIT) yapılandırma
    // hatasına işaret ediyor ve loglanmalı.
    if (data.status !== "OK") {
      if (data.status !== "ZERO_RESULTS") {
        logger.warn("Geocoding beklenmeyen durum döndürdü", undefined, {
          status: data.status,
          adres: truncate(sorgu, 100),
        });
      }
      return null;
    }

    return koordinatCoz(data.results?.[0]?.geometry?.location) ?? null;
  } catch (error) {
    logger.warn("Geocoding'e ulaşılamadı", error, { adres: truncate(sorgu, 100) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Bir aktiviteden aranacak adres metnini kurar. */
function adresMetni(konum: string, sehir: string, ulke: string): string {
  const parcalar = [konum.trim(), sehir.trim(), ulke.trim()].filter(Boolean);
  return parcalar.join(", ");
}

export interface GunleriCozumleSonucu {
  gunler: PlanGunu[];
  /** Bu çağrıda YENİ çözülen aktivite sayısı. */
  cozulen: number;
  /** Koordinatı olmayan ve çözülemeyen aktivite sayısı. */
  cozulemeyen: number;
}

/**
 * Bir planın günlerindeki aktivitelere koordinat ekler.
 *
 * Girdiyi DEĞİŞTİRMEZ; yeni bir dizi döner. Zaten koordinatı olan
 * aktiviteler atlanır — hem tekrar üretimde hem eski planları güncelleyen
 * uçta aynı fonksiyon kullanılabilsin diye.
 *
 * Aynı adres bir planda defalarca geçiyor (otel her gün başlangıç noktası);
 * benzersiz adresler bir kez çözülüp önbellekten dağıtılıyor.
 */
export async function gunlereKoordinatEkle(
  gunler: PlanGunu[],
  konum: { city: string; country?: string | null },
  secenekler: { sureBitisi?: number } = {}
): Promise<GunleriCozumleSonucu> {
  if (!geocodingYapilandirilmisMi()) {
    return { gunler, cozulen: 0, cozulemeyen: 0 };
  }

  const sureBitisi = secenekler.sureBitisi ?? Date.now() + TOPLU_SURE_BUTCESI_MS;
  const sehir = konum.city ?? "";
  const ulke = konum.country ?? "";

  // 1) Çözülmesi gereken benzersiz adresleri topla.
  const adresler = new Set<string>();
  for (const gun of gunler) {
    for (const aktivite of gun.activities) {
      if (aktivite.coordinates) continue;
      const adres = adresMetni(aktivite.location, sehir, ulke);
      if (adres) adresler.add(adres);
    }
  }

  const sira = [...adresler].slice(0, MAKS_ADRES);
  if (sira.length < adresler.size) {
    logger.warn("Geocoding adres sınırına takıldı", undefined, {
      toplam: adresler.size,
      islenen: sira.length,
    });
  }

  // 2) Sınırlı eş zamanlılıkla çöz. `ES_ZAMANLI` kadar işçi aynı kuyruğu
  // tüketiyor; bir işçinin yavaş kalması diğerlerini bloklamıyor.
  const onbellek = new Map<string, Koordinat>();
  let indeks = 0;

  const isci = async () => {
    for (;;) {
      const i = indeks++;
      if (i >= sira.length) return;
      if (Date.now() >= sureBitisi) return;

      const adres = sira[i];
      const koordinat = await adresiCoz(adres);
      if (koordinat) onbellek.set(adres, koordinat);
    }
  };

  await Promise.all(Array.from({ length: Math.min(ES_ZAMANLI, sira.length) }, isci));

  // 3) Sonuçları günlere dağıt.
  let cozulen = 0;
  let cozulemeyen = 0;

  const yeniGunler = gunler.map((gun) => ({
    ...gun,
    activities: gun.activities.map((aktivite) => {
      if (aktivite.coordinates) return aktivite;

      const adres = adresMetni(aktivite.location, sehir, ulke);
      const koordinat = adres ? onbellek.get(adres) : undefined;

      if (!koordinat) {
        cozulemeyen += 1;
        return aktivite;
      }

      cozulen += 1;
      return { ...aktivite, coordinates: koordinat };
    }),
  }));

  logger.debug("Aktivite konumları çözüldü", {
    benzersizAdres: sira.length,
    cozulen,
    cozulemeyen,
  });

  return { gunler: yeniGunler, cozulen, cozulemeyen };
}
