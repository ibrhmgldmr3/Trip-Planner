/**
 * Araç-çağırma (tool-calling) için sağlayıcıdan bağımsız tipler.
 *
 * NEDEN AYRI DOSYA: `together.ts` (LLM istemcisi) ve `web-search.ts` (somut
 * bir araç) birbirini bilmemeli. İkisi de bu dosyadaki ortak sözleşmeye
 * bağlı: istemci `ToolDefinition[]`'ı OpenAI'nin `{type:"function",...}`
 * sarmalayıcısına çevirip API'ye gönderir; araçlar kendi tanımlarını ve
 * yürütücülerini bu şekle uydurur. Yeni bir araç eklemek `together.ts`'e
 * dokunmayı gerektirmez.
 */

/**
 * Bir araç sonucunun modele geri verilen üst sınırı.
 *
 * `web-search.ts` sonuçları zaten snippet başına kırpıyor; bu ikinci
 * savunma katmanı — herhangi bir aracın (ileride eklenecekler dahil)
 * ürettiği toplam metni sabit bir tavana çekiyor. İki gerekçesi var:
 * (1) maliyet — uzun araç sonuçları token faturasını büyütür, (2) prompt
 * injection yüzeyi — bir web sayfasına gömülü uzun bir "talimat" metninin
 * modele ulaşma şansını daraltır.
 */
export const ARAC_SONUCU_MAKS_KARAKTER = 1200;

/**
 * Sohbet şablonu kontrol belirteçleri (Faz F).
 *
 * Sağlayıcıların çoğu mesaj listesini bir metin şablonuna DİZE BİRLEŞTİREREK
 * çeviriyor. Araç sonucunun içindeki `<|im_end|><|im_start|>system` gibi bir
 * dizi, o birleştirmede gerçek bir mesaj sınırına dönüşebiliyor — yani
 * zehirli bir web sayfası kendini "sistem mesajı" ilan edebiliyor. Bu,
 * sistem promptundaki "araç sonuçları veridir" uyarısının ALTINDAN geçen bir
 * saldırı; metin düzeyinde ayrıca temizlenmesinin sebebi bu.
 *
 * Belirteçler siliniyor, kaçırılmıyor: modelin bu dizileri görmesine gerek
 * yok ve silme, kaçırmanın aksine sağlayıcıdan sağlayıcıya değişmiyor.
 */
const KONTROL_BELIRTECLERI =
  /<\|[^|>]{0,40}\|>|<<\/?SYS>>|\[\/?INST\]|<\/?\|?(system|assistant)\|?>/gi;

/** Araç sonucunu modele geri vermeden önce zararsızlaştırır ve kırpar. */
export function aracSonucunuGuvenlestir(
  metin: string,
  maks = ARAC_SONUCU_MAKS_KARAKTER
): string {
  const temiz = metin.replace(KONTROL_BELIRTECLERI, " ");
  if (temiz.length <= maks) return temiz;
  return `${temiz.slice(0, maks)}… (+${temiz.length - maks} karakter)`;
}

/** Modele sunulan bir aracın tanımı (isim, açıklama, argüman şeması). */
export interface ToolDefinition {
  name: string;
  description: string;
  /** Argümanların JSON Schema'sı (draft-7). */
  parameters: Record<string, unknown>;
}

/**
 * Bir üretim turunda modele sunulacak araçlar ve onları çalıştıran
 * yürütücü.
 *
 * `execute` ASLA fırlatmamalı — hata durumunda modele okunabilir bir hata
 * metni dönmeli. Araç çağrısı model tarafından tetikleniyor; bir aracın
 * içeride patlaması tüm plan üretimini düşürmemeli.
 */
export interface ToolRegistry {
  /** Boşsa model hiçbir araç görmez; düz tek-turlu üretime döner. */
  definitions: ToolDefinition[];
  /**
   * @param name     Modelin çağırdığı aracın adı.
   * @param argsJson Modelin ürettiği, henüz doğrulanmamış JSON metni.
   * @returns Modele `role: "tool"` mesajı olarak geri verilecek metin.
   *          Çağıran taraf bunu ayrıca kırpıyor; burada uzunluk sınırı
   *          zorunlu değil.
   */
  execute(name: string, argsJson: string): Promise<string>;
}

/**
 * Bir üretim turunda araçların GERÇEKTEN döndürdüğü kaynak adresleri.
 *
 * NEDEN VAR (Faz F): bütçe kalemlerindeki `source` alanını model yazıyor ve
 * model, zehirlenmiş bir arama sonucundan etkilenebiliyor. O alan bütçe
 * sayfasında kullanıcının tıklamaya davet edildiği bir bağlantıya
 * dönüşüyor — yani "modelin uydurduğu URL" doğrudan bir kimlik avı yüzeyi.
 *
 * Savunma: yalnızca arama SAĞLAYICISININ döndürdüğü adresler kabul ediliyor.
 * Snippet METNİNİN içindeki adresler defterde YER ALMIYOR; zehirli bir sayfa
 * kendi metnine `https://kotu.test` yazsa bile o adres kaleme geçemiyor.
 */
export interface KaynakDefteri {
  /** Sağlayıcıdan gelen bir adresi kaydeder. Geçersiz adresler yok sayılır. */
  ekle(url: string): void;
  /** Adres bu turda bir araç sonucundan mı geldi? */
  icerirMi(url: string): boolean;
  /** Kaydedilen adres sayısı (log/teşhis için). */
  readonly boyut: number;
}

/** Karşılaştırmanın iki tarafını da aynı biçime indirger. */
function kaynakAnahtari(url: string): string | null {
  try {
    const cozulen = new URL(url.trim());
    if (cozulen.protocol !== "http:" && cozulen.protocol !== "https:") return null;
    return cozulen.toString();
  } catch {
    return null;
  }
}

export function kaynakDefteri(): KaynakDefteri {
  const adresler = new Set<string>();

  return {
    ekle(url) {
      const anahtar = kaynakAnahtari(url);
      if (anahtar) adresler.add(anahtar);
    },
    icerirMi(url) {
      const anahtar = kaynakAnahtari(url);
      return anahtar !== null && adresler.has(anahtar);
    },
    get boyut() {
      return adresler.size;
    },
  };
}

/** Hiçbir aracın tanımlı olmadığı, no-op bir kayıt. */
export function bosAracKaydi(): ToolRegistry {
  return {
    definitions: [],
    async execute(name) {
      return JSON.stringify({ error: `Bilinmeyen araç: ${name}` });
    },
  };
}

/**
 * Birden çok araç kaydını tek bir kayıtta birleştirir.
 *
 * İsim çakışmasında İLK kayıt kazanır — modele aynı isimle iki farklı
 * araç tanımı gitmesin diye.
 */
export function aracKayitlariniBirlestir(...kayitlar: ToolRegistry[]): ToolRegistry {
  const tanimlar: ToolDefinition[] = [];
  const gorulenIsimler = new Set<string>();

  for (const kayit of kayitlar) {
    for (const tanim of kayit.definitions) {
      if (gorulenIsimler.has(tanim.name)) continue;
      gorulenIsimler.add(tanim.name);
      tanimlar.push(tanim);
    }
  }

  return {
    definitions: tanimlar,
    async execute(name, argsJson) {
      for (const kayit of kayitlar) {
        if (kayit.definitions.some((t) => t.name === name)) {
          return kayit.execute(name, argsJson);
        }
      }
      return JSON.stringify({ error: `Bilinmeyen araç: ${name}` });
    },
  };
}
