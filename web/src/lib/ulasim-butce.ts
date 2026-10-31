import {
  rotaHesapla,
  type RotaOzeti,
  type UlasimTahmini,
  type UlasimTuru,
} from "@/lib/seyahat-mesafe";
import {
  butceyiYenidenHesapla,
  type ButceKalemi,
  type ButceKategorisi,
  type PlanButcesi,
} from "@/lib/plan-budget";

/**
 * Şehirlerarası ulaşımı plan bütçesine ekler (B6).
 *
 * SORUN NEYDİ: AI planlayıcı kalkış şehrini hiç sormuyordu, dolayısıyla
 * `TripPlan.origin_city` daima null kalıyor ve üretilen bütçede
 * **şehirlerarası ulaşım hiç yer almıyordu.** Kullanıcı "İstanbul'dan
 * Kars'a" bir plan istiyor, bütçede uçak bileti görünmüyordu — model şehir
 * İÇİ ulaşımı yazıyordu, oraya nasıl gidileceğini değil. Toplam, gerçek
 * maliyetin belirgin biçimde altında çıkıyordu.
 *
 * NEDEN MODELE SORULMUYOR: mesafe ve süre fizik; `seyahat-mesafe.ts` bunu
 * 81 ilin koordinatından zaten hesaplıyor ve sonuç tekrarlanabilir. Aynı
 * soruyu LLM'e sormak, her üretimde başka bir rakam almak demekti.
 *
 * Bu dosya SAF: ağ ya da veritabanı bilmiyor.
 */

/** Bütçedeki ulaşım kategorisinin adı (`BUTCE_KATEGORILERI` ile aynı). */
export const ULASIM_KATEGORISI = "ulaşım";

/**
 * Formdaki ulaşım tercihlerini `UlasimTuru` değerlerine çevirir.
 *
 * Form "Araba" diyor, hesaplayıcı "Kendi aracı". Eşleşmeyen tercihler
 * ("Toplu Taşıma" gibi şehir içi seçenekler) düşüyor.
 *
 * TÜRKÇE KÜÇÜLTME: karşılaştırma `toLocaleLowerCase("tr")` ile yapılıyor.
 * Varsayılan küçültmede "I" harfi "i" oluyor ve "Uçak"/"UÇAK" gibi
 * yazımlar eşleşse de "ISPARTA" benzeri girdiler sessizce kayıyordu.
 */
const TERCIH_ESLESMESI: Record<string, UlasimTuru> = {
  "uçak": "Uçak",
  "ucak": "Uçak",
  "otobüs": "Otobüs",
  "otobus": "Otobüs",
  "tren": "Tren",
  "araba": "Kendi aracı",
  "kendi aracı": "Kendi aracı",
  "kendi araci": "Kendi aracı",
};

/** Tercih metnini ulaşım türüne çevirir; tanınmayan metin için null. */
export function tercihiTuruneCevir(tercih: string): UlasimTuru | null {
  return TERCIH_ESLESMESI[tercih.trim().toLocaleLowerCase("tr")] ?? null;
}

/**
 * Kullanıcının tercihine en uygun ulaşım seçeneğini seçer.
 *
 * SIRA: önce tercih edilen tür, yoksa EN UCUZ seçenek.
 *
 * En ucuz — en hızlı değil: bu kalem bütçeye giriyor ve amacı "bu gezi
 * en az neye mal olur" sorusuna dürüst bir taban vermek. En hızlıyı
 * seçmek, uçak tercihi belirtmemiş bir kullanıcının bütçesini sessizce
 * uçak biletine göre şişirirdi.
 */
export function ulasimSecenegiSec(
  rota: RotaOzeti,
  tercihler: string[] = []
): UlasimTahmini | null {
  if (rota.secenekler.length === 0) return null;

  for (const tercih of tercihler) {
    const tur = tercihiTuruneCevir(tercih);
    if (!tur) continue;

    const eslesen = rota.secenekler.find((s) => s.tur === tur);
    if (eslesen) return eslesen;
  }

  return rota.secenekler.reduce((enUcuz, aday) =>
    aday.tahminiTl < enUcuz.tahminiTl ? aday : enUcuz
  );
}

/**
 * Seçilen ulaşımı GİDİŞ-DÖNÜŞ bütçe kalemine çevirir.
 *
 * NEDEN GİDİŞ-DÖNÜŞ: bu bir seyahat planı, tek yön bilet değil. Tek yön
 * yazmak maliyeti yarı yarıya eksik gösterirdi ve kullanıcı bunu ancak
 * dönüş biletini alırken fark ederdi.
 *
 * "tahmini" ETİKETİ AÇIKLAMADA: bu rakam bir sağlayıcıdan değil, mesafe
 * ve mod ortalamalarından geliyor. Kullanıcı hangi kalemin gerçek bir
 * fiyata, hangisinin hesaba dayandığını görebilmeli.
 */
export function ulasimKalemi(rota: RotaOzeti, secenek: UlasimTahmini): ButceKalemi {
  const birim =
    secenek.maliyetBirimi === "arac" ? " · araç başına" : " · kişi başına";

  return {
    description:
      `${rota.nereden.ad} → ${rota.nereye.ad} gidiş-dönüş ` +
      `(${secenek.tur}, tahmini${birim})`,
    amount: secenek.tahminiTl * 2,
    isPaid: false,
  };
}

/**
 * Bütçenin ulaşım kategorisine kalemi ekler ve toplamları tazeler.
 *
 * KATEGORİ SIFIRLANMIYOR, EKLENİYOR: modelin yazdığı şehir içi ulaşım
 * kalemleri (metro, taksi) meşru ve gerekli. Şehirlerarası ulaşım onların
 * yerine değil, yanına giriyor.
 */
export function butceyeUlasimEkle(
  butce: PlanButcesi,
  kalem: ButceKalemi,
  gunSayisi: number
): PlanButcesi {
  const mevcut: ButceKategorisi = butce.categories[ULASIM_KATEGORISI] ?? {
    items: [],
    total: 0,
  };

  const categories: Record<string, ButceKategorisi> = {
    ...butce.categories,
    [ULASIM_KATEGORISI]: {
      items: [kalem, ...mevcut.items],
      // Toplam `butceyiYenidenHesapla` tarafından kalemlerden yeniden
      // üretiliyor; buradaki değer yalnızca ara durum.
      total: mevcut.total + kalem.amount,
    },
  };

  return butceyiYenidenHesapla({ ...butce, categories }, gunSayisi);
}

/** `butceyeSehirlerarasiUlasimEkle` sonucu. */
export interface UlasimEklemeSonucu {
  butce: PlanButcesi;
  kalem: ButceKalemi;
  secenek: UlasimTahmini;
}

/**
 * Kalkış şehri biliniyorsa bütçeye şehirlerarası ulaşımı ekler.
 *
 * `null` DÖNEN DURUMLAR — hepsi sessizce geçilmeli, üretim bunlar için
 * başarısız olmamalı:
 *  - Kalkış şehri girilmemiş (form alanı opsiyonel).
 *  - Şehirlerden biri 81 il listesinde yok (yurt dışı planları).
 *  - Kalkış ve varış aynı şehir (`rotaHesapla` boş seçenek listesi döner).
 */
export function butceyeSehirlerarasiUlasimEkle(
  butce: PlanButcesi,
  originCity: string | undefined | null,
  city: string,
  tercihler: string[],
  gunSayisi: number
): UlasimEklemeSonucu | null {
  const nereden = originCity?.trim();
  if (!nereden) return null;

  const rota = rotaHesapla(nereden, city);
  if (!rota) return null;

  const secenek = ulasimSecenegiSec(rota, tercihler);
  if (!secenek) return null;

  const kalem = ulasimKalemi(rota, secenek);

  return { butce: butceyeUlasimEkle(butce, kalem, gunSayisi), kalem, secenek };
}
