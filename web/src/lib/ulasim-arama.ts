import { arama, aramaYapilandirilmisMi, type AramaSonucu } from "@/lib/web-search";
import { logger, truncate } from "@/lib/logger";
import { rotaHesapla, type RotaOzeti, type UlasimTuru } from "@/lib/seyahat-mesafe";

/**
 * Ulaşım seçeneklerini web aramasıyla zenginleştirir.
 *
 * İKİ KATMAN, NET AYRIM:
 *
 *  1. **Tahmin** (`seyahat-mesafe.ts`) — çevrimdışı, anlık, her zaman var.
 *     İki şehrin koordinatından hesaplanıyor. Ağ yoksa da çalışır.
 *  2. **Web** (bu dosya) — Tavily araması. Gerçek satış sitelerinden
 *     (obilet, enuygun, THY…) güncel fiyat bilgisi taşıyan bağlantılar.
 *
 * İkinci katman BİRİNCİSİNİ EZMEZ, yanına eklenir. Kullanıcı hem mertebeyi
 * (tahmin) hem gerçek kaynağı (bağlantı) görüyor.
 *
 * ANAHTAR YOKSA SESSİZCE DEVRE DIŞI: `TAVILY_API_KEY` tanımsızsa `kaynaklar`
 * boş döner ve arayüz yalnızca tahminleri gösterir. Bu, `web-search.ts`'in
 * zaten uyguladığı davranışın aynısı.
 *
 * ASLA FIRLATMAZ: arama bir yan zenginleştirme; sağlayıcı kesintisi ulaşım
 * adımını çalışmaz hâle getirmemeli.
 */

/** Bir moda ait web kaynağı. */
export interface UlasimKaynagi {
  baslik: string;
  url: string;
  ozet: string;
}

export interface ZenginUlasimSecenegi {
  tur: UlasimTuru;
  saglayici: string;
  sureDk: number;
  sureMetni: string;
  tahminiTl: number;
  mesafeKm: number;
  maliyetBirimi: "kisi" | "arac";
  /** Bu mod için bulunan satış/karşılaştırma siteleri. Boş olabilir. */
  kaynaklar: UlasimKaynagi[];
}

export interface ZenginRota {
  nereden: string;
  nereye: string;
  kusUcusuKm: number;
  karayoluKm: number;
  secenekler: ZenginUlasimSecenegi[];
  /** Web araması gerçekten çalıştı mı? Arayüz buna göre metin gösteriyor. */
  webAramasiYapildi: boolean;
}

/** Arama sorgusuna girecek mod kelimesi. Kendi aracında arama yapılmıyor. */
const MOD_SORGU_KELIMESI: Partial<Record<UlasimTuru, string>> = {
  "Uçak": "uçak bileti fiyatı",
  "Otobüs": "otobüs bileti fiyatı",
  "Tren": "tren bileti fiyatı",
  // "Kendi aracı" bilinçli olarak YOK: satılan bir bilet değil, kendi
  // yakıtınız. Onun için arama yapmak kotayı boşa harcar.
};

/**
 * Sonucun ARANAN modla ilgili olup olmadığını URL'den denetler.
 *
 * NEDEN GEREKLİ: ölçüldü — "İstanbul Van tren bileti fiyatı" sorgusu
 * `obilet.com/otobus-bileti/istanbul-van` döndürüyor. Bu bağlantıyı "Tren"
 * seçeneğinin altında göstermek kullanıcıyı yanlış sayfaya yollar. Satış
 * siteleri modu URL yolunda taşıdığı için ucuz ve güvenilir bir denetim.
 *
 * Yolda mod bilgisi YOKSA sonuç elenmiyor: karşılaştırma siteleri ve haber
 * sayfaları da yararlı olabilir; yalnızca AÇIKÇA başka bir moda ait olanlar
 * düşüyor.
 */
const MOD_YOL_IZLERI: Record<string, string[]> = {
  "Uçak": ["ucak", "ucus", "flight", "havayolu"],
  "Otobüs": ["otobus", "bus"],
  "Tren": ["tren", "train", "demiryolu", "rail", "tcdd", "yht"],
};

function moduylaUyumluMu(url: string, tur: UlasimTuru): boolean {
  const izler = MOD_YOL_IZLERI[tur];
  if (!izler) return true;

  const yol = url.toLowerCase();
  // Başka bir modun izini taşıyor ve kendi modunun izini taşımıyorsa ele.
  const baskaMod = Object.entries(MOD_YOL_IZLERI)
    .filter(([ad]) => ad !== tur)
    .flatMap(([, i]) => i);

  const kendiVar = izler.some((i) => yol.includes(i));
  const baskaVar = baskaMod.some((i) => yol.includes(i));

  return kendiVar || !baskaVar;
}

/**
 * "Güncel fiyat" başlığı altında gösterilmeyecek alan adları.
 *
 * Ölçüldü: tren aramasında `instagram.com` sonucu döndü. Sosyal medya ve
 * video sitelerinden bilet alınmıyor; bu bağlantıyı fiyat kaynağı diye
 * sunmak kullanıcının zamanını harcar.
 */
const ELENEN_ALANLAR = [
  "instagram.com", "facebook.com", "x.com", "twitter.com", "tiktok.com",
  "youtube.com", "pinterest.com", "reddit.com", "linkedin.com",
];

function fiyatKaynagiOlabilirMi(url: string): boolean {
  const alan = alanAdi(url);
  return !ELENEN_ALANLAR.some((e) => alan === e || alan.endsWith("." + e));
}

/** Aynı alan adından birden fazla sonuç göstermenin faydası yok. */
function alanAdi(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function tekilAlanAdi(sonuclar: AramaSonucu[], limit: number): AramaSonucu[] {
  const gorulen = new Set<string>();
  const secilen: AramaSonucu[] = [];
  for (const s of sonuclar) {
    const alan = alanAdi(s.url);
    if (gorulen.has(alan)) continue;
    gorulen.add(alan);
    secilen.push(s);
    if (secilen.length >= limit) break;
  }
  return secilen;
}

/**
 * Rotayı hesaplar ve web kaynaklarıyla zenginleştirir.
 *
 * `webAra` false ise (ya da anahtar yoksa) yalnızca tahminler döner —
 * fonksiyon yine de başarılı sayılır.
 */
export async function zenginRotaHesapla(
  neredenAd: string,
  nereyeAd: string,
  secenekler: { webAra?: boolean; modBasinaKaynak?: number } = {}
): Promise<ZenginRota | null> {
  const { webAra = true, modBasinaKaynak = 3 } = secenekler;

  const rota: RotaOzeti | null = rotaHesapla(neredenAd, nereyeAd);
  if (!rota) return null;

  const temel: ZenginUlasimSecenegi[] = rota.secenekler.map((s) => ({
    tur: s.tur,
    saglayici: s.saglayici,
    sureDk: s.sureDk,
    sureMetni: s.sureMetni,
    tahminiTl: s.tahminiTl,
    mesafeKm: s.mesafeKm,
    maliyetBirimi: s.maliyetBirimi,
    kaynaklar: [],
  }));

  const aramaAcik = webAra && aramaYapilandirilmisMi() && temel.length > 0;
  if (!aramaAcik) {
    return {
      nereden: rota.nereden.ad,
      nereye: rota.nereye.ad,
      kusUcusuKm: rota.kusUcusuKm,
      karayoluKm: rota.karayoluKm,
      secenekler: temel,
      webAramasiYapildi: false,
    };
  }

  // Aranacak modlar; kendi aracı elenir.
  const aranacak = temel.filter((s) => MOD_SORGU_KELIMESI[s.tur]);

  // PARALEL: üç mod için sırayla arama yapmak kullanıcıyı üç kat bekletirdi.
  const sonuclar = await Promise.all(
    aranacak.map(async (secenek) => {
      const sorgu = `${rota.nereden.ad} ${rota.nereye.ad} ${MOD_SORGU_KELIMESI[secenek.tur]}`;
      try {
        const bulunan = await arama(sorgu, 8);
        return {
          tur: secenek.tur,
          bulunan: bulunan.filter(
            (b) => fiyatKaynagiOlabilirMi(b.url) && moduylaUyumluMu(b.url, secenek.tur)
          ),
        };
      } catch (error) {
        // `arama` zaten fırlatmıyor; yine de savunma.
        logger.warn("Ulaşım araması başarısız", error, { sorgu: truncate(sorgu, 80) });
        return { tur: secenek.tur, bulunan: [] as AramaSonucu[] };
      }
    })
  );

  const kaynakHaritasi = new Map<UlasimTuru, UlasimKaynagi[]>();
  for (const { tur, bulunan } of sonuclar) {
    kaynakHaritasi.set(
      tur,
      tekilAlanAdi(bulunan, modBasinaKaynak).map((s) => ({
        baslik: s.title || alanAdi(s.url),
        url: s.url,
        ozet: s.snippet,
      }))
    );
  }

  const zengin = temel.map((s) => ({ ...s, kaynaklar: kaynakHaritasi.get(s.tur) ?? [] }));
  const herhangiBiriDoldu = zengin.some((s) => s.kaynaklar.length > 0);

  return {
    nereden: rota.nereden.ad,
    nereye: rota.nereye.ad,
    kusUcusuKm: rota.kusUcusuKm,
    karayoluKm: rota.karayoluKm,
    secenekler: zengin,
    // Arama çalıştı ama hiçbir sonuç dönmediyse kullanıcıya "web'den
    // bulundu" demek yanlış olur.
    webAramasiYapildi: herhangiBiriDoldu,
  };
}
