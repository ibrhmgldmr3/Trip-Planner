/**
 * Bütçe kalemlerini ilişkisel modelle eşitlemek için fark hesabı (B4).
 *
 * NEDEN VAR: bütçe sayfası kalem listesini TOPLU kaydediyor — kullanıcı
 * birkaç kalem ekleyip birkaçını silip "Kaydet"e basıyor. İlişkisel uç
 * (`/api/trip/budget`) ise KALEM BAZLI: POST bir kalem yaratıyor, PUT
 * birini güncelliyor, DELETE birini siliyor. İki model arasındaki köprü bu
 * dosya.
 *
 * NEDEN AYRI VE SAF: fark hesabını sayfanın içine gömmek, onu yalnızca
 * gerçek bir veritabanı ve gerçek bir tarayıcı ile test edilebilir hâle
 * getirirdi. Burada saf bir fonksiyon: girdi iki liste, çıktı üç liste.
 * Yanlış hesaplanan bir fark kullanıcının kalemlerini SİLER, yani bu
 * mantığın testlenebilir olması isteğe bağlı değil.
 *
 * KİMLİK KURALI: sunucudan gelen kalemlerin `id`si veritabanı kimliği
 * (cuid). Kullanıcının ekranda yeni eklediği kalemlerin `id`si istemci
 * tarafında üretiliyor ve veritabanında karşılığı YOK. Ayrımı
 * `sunucudakiler` listesindeki kimlikler belirliyor — "id var mı" değil,
 * "bu id sunucuda var mı".
 */

/** Eşitlemeye giren asgari kalem şekli. */
export interface EsitlenecekKalem {
  id: string;
  category: string;
  description: string;
  amount: number;
  isPaid: boolean;
  isEstimate?: boolean;
  date?: string;
}

export interface ButceFarki {
  /** Sunucuda karşılığı olmayan, yaratılacak kalemler. */
  eklenecek: EsitlenecekKalem[];
  /** Sunucuda var ve EN AZ BİR ALANI değişmiş kalemler. */
  guncellenecek: EsitlenecekKalem[];
  /** Sunucuda var ama ekranda kalmamış kalemlerin kimlikleri. */
  silinecek: string[];
}

/** İki kalemin kullanıcıya görünen alanları aynı mı? */
function ayniMi(a: EsitlenecekKalem, b: EsitlenecekKalem): boolean {
  return (
    a.category === b.category &&
    a.description === b.description &&
    // Tutarlar kuruşsuz saklanıyor; yine de sayısal karşılaştırma yapılıyor.
    a.amount === b.amount &&
    a.isPaid === b.isPaid &&
    (a.isEstimate ?? true) === (b.isEstimate ?? true) &&
    (a.date ?? "") === (b.date ?? "")
  );
}

/**
 * Ekrandaki liste ile sunucudaki liste arasındaki farkı çıkarır.
 *
 * DEĞİŞMEYEN KALEMLER HİÇBİR LİSTEYE GİRMEZ: kullanıcı tek bir kalemi
 * düzenleyip kaydettiğinde 20 kalemlik bir bütçe için 20 istek atmak,
 * hem gereksiz hem de her birinin ayrı ayrı başarısız olabileceği bir
 * yüzey demek.
 *
 * @param ekrandakiler Kullanıcının gördüğü/düzenlediği güncel liste.
 * @param sunucudakiler `GET /api/trip/budget` ile okunan mevcut kayıtlar.
 */
export function butceFarkiCikar(
  ekrandakiler: EsitlenecekKalem[],
  sunucudakiler: EsitlenecekKalem[]
): ButceFarki {
  const sunucuHaritasi = new Map(sunucudakiler.map((k) => [k.id, k]));

  const eklenecek: EsitlenecekKalem[] = [];
  const guncellenecek: EsitlenecekKalem[] = [];

  // Ekranda aynı sunucu kimliği iki kez görünürse (kopyalama gibi bir
  // hatanın sonucu) ikincisini YENİ kalem sayıyoruz; aksi halde aynı
  // kaydı iki kez güncellemeye çalışıp birini sessizce kaybederdik.
  const gorulen = new Set<string>();

  for (const kalem of ekrandakiler) {
    const sunucudaki = sunucuHaritasi.get(kalem.id);

    if (!sunucudaki || gorulen.has(kalem.id)) {
      eklenecek.push(kalem);
      continue;
    }

    gorulen.add(kalem.id);
    if (!ayniMi(kalem, sunucudaki)) guncellenecek.push(kalem);
  }

  const silinecek = sunucudakiler
    .filter((k) => !gorulen.has(k.id))
    .map((k) => k.id);

  return { eklenecek, guncellenecek, silinecek };
}

/** Farkta gerçekten yapılacak bir iş var mı? */
export function farkBosMu(fark: ButceFarki): boolean {
  return (
    fark.eklenecek.length === 0 &&
    fark.guncellenecek.length === 0 &&
    fark.silinecek.length === 0
  );
}
