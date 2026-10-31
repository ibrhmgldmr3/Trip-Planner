import { env } from "@/env";
import {
  hotelPricesToolArgsSchema,
  transportPricesToolArgsSchema,
  webSearchToolArgsSchema,
} from "@/lib/api-schemas";
import { truncate } from "@/lib/logger";
import {
  bosAracKaydi,
  type KaynakDefteri,
  type ToolDefinition,
  type ToolRegistry,
} from "@/lib/agent-tools";
import { logger } from "@/lib/logger";

/**
 * Web arama sağlayıcısı — Tavily.
 *
 * NEDEN SOYUTLANDI: sağlayıcıya özgü her şey (istek gövdesi, yanıt şekli,
 * hata kodları) bu dosyada kalıyor; `plan-generation.ts` yalnızca
 * `webAramaAracKaydi()`/`fiyatAraclariKaydi()`'nin döndürdüğü
 * `ToolRegistry`'yi biliyor. Sağlayıcı değiştirilmek istenirse (Bright
 * Data, SerpAPI) tek bu dosya yeniden yazılır.
 *
 * ANAHTAR YOKSA SESSİZCE DEVRE DIŞI: `TAVILY_API_KEY` tanımsızsa araç
 * kayıtları boş döner (araçlar modele hiç sunulmaz). Uygulama yeni bir
 * hesap açılmadan bugünkü haliyle çalışmaya devam eder — bu davranış test
 * ediliyor (bkz. web-search.test.ts).
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const VARSAYILAN_ZAMAN_ASIMI_MS = 8_000;
/** Modele geri verilen her sonucun snippet'i bu uzunlukta kırpılıyor. */
const SNIPPET_MAKS_KARAKTER = 300;

export interface AramaSonucu {
  title: string;
  url: string;
  snippet: string;
}

export function aramaYapilandirilmisMi(): boolean {
  return Boolean(env.TAVILY_API_KEY?.trim());
}

/**
 * Tavily üzerinden arama yapar.
 *
 * Hata durumunda ASLA fırlatmaz — boş dizi döner. Arama başarısız olduğunda
 * agentic döngü modele "sonuç bulunamadı" diye devam edebilsin diye; bir
 * arama sağlayıcısı kesintisi tüm plan üretimini düşürmemeli.
 */
export async function arama(sorgu: string, limit = 5): Promise<AramaSonucu[]> {
  if (!aramaYapilandirilmisMi()) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VARSAYILAN_ZAMAN_ASIMI_MS);

  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query: sorgu,
        max_results: Math.min(Math.max(limit, 1), 10),
        search_depth: "basic",
        include_answer: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const gövde = await response.text().catch(() => "");
      logger.warn("Tavily arama başarısız", undefined, {
        status: response.status,
        detay: truncate(gövde, 300),
      });
      return [];
    }

    const data = (await response.json()) as unknown;
    return ayristirTavilySonucu(data);
  } catch (error) {
    logger.warn("Tavily aramasına ulaşılamadı", error, { sorgu: truncate(sorgu, 100) });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function ayristirTavilySonucu(data: unknown): AramaSonucu[] {
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];

  return results
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      title: typeof r.title === "string" ? truncate(r.title, 120) : "",
      url: typeof r.url === "string" ? r.url : "",
      snippet: typeof r.content === "string" ? truncate(r.content, SNIPPET_MAKS_KARAKTER) : "",
    }))
    .filter((r) => r.url.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Araç kayıtları                                                             */
/* -------------------------------------------------------------------------- */

export const WEB_SEARCH_ARAC_ADI = "web_search";
export const OTEL_FIYAT_ARAC_ADI = "get_hotel_prices";
export const ULASIM_FIYAT_ARAC_ADI = "get_transport_prices";

/**
 * Fiyat araçlarının sonucuna eklenen uyarı.
 *
 * NEDEN: bu araçlar bir rezervasyon API'si DEĞİL, arama sonucu. Modelin
 * çıktısında bu tutarların kesin fiyat gibi görünmesi kullanıcıyı yanıltır.
 * Uyarı hem modeli tahmin dilinde konuşmaya itiyor hem de `source` alanını
 * doldurmasını istiyor — bütçe sayfası o alanı "harici kaynak" rozetiyle
 * gösteriyor.
 */
const FIYAT_UYARISI =
  "Bu tutarlar arama sonuçlarından derlenmiş TAHMİNLERDİR, kesin rezervasyon " +
  "fiyatı değildir. İlgili bütçe kaleminin 'source' alanına kullandığın " +
  "sonucun 'url' değerini yaz.";

type AracYurutucu = (argsJson: string) => Promise<string>;

const TURKCE_AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/**
 * Tarihi arama motorunun anlayacağı "Mayıs 2026" biçimine çevirir.
 *
 * NEDEN: gerçek Tavily sonuçlarıyla ölçüldü. Ham `"2026-05-15 - 2026-05-20"`
 * metni sorguyu bozuyor — arama motoru tarih aralığını anlamıyor, sonuçlar
 * konudan sapıyordu ("Roma otel fiyatları" yerine Türkiye'deki otel zamları
 * hakkında haberler dönüyordu). "Mayıs 2026" ile aynı sorgu doğrudan
 * trivago/momondo/hotels.com sonuçları veriyor.
 *
 * Ayrıştırılamayan değer OLDUĞU GİBİ bırakılıyor: model zaten "Mayıs 2026"
 * yazmış olabilir.
 */
function ayYilMetni(tarih: string | undefined): string {
  const ham = (tarih ?? "").trim();
  if (!ham) return "";

  const eslesme = ham.match(/^(\d{4})-(\d{1,2})/);
  if (!eslesme) return ham;

  const ay = Number(eslesme[2]);
  if (ay < 1 || ay > 12) return ham;

  return `${TURKCE_AYLAR[ay - 1]} ${eslesme[1]}`;
}

/**
 * Bütçe seviyesini sorguya girecek bir kelimeye çevirir.
 *
 * "orta" gibi genel sıfatlar sorguyu kirletiyor (ölçüldü: alakasız haber
 * sonuçları); karşılığı olmayan seviyeler sorgudan tamamen düşürülüyor.
 * Sade sorgu zaten ortalama fiyat sonuçları veriyor.
 */
function butceSeviyesiKelimesi(seviye: string | undefined): string {
  const normal = (seviye ?? "").trim().toLocaleLowerCase("tr");
  if (!normal) return "";
  if (normal.includes("ekonomik") || normal.includes("ucuz") || normal.includes("düşük")) {
    return "ucuz";
  }
  if (normal.includes("lüks") || normal.includes("luks") || normal.includes("yüksek")) {
    return "lüks";
  }
  return "";
}

/** Şema arayüzü: yalnızca `safeParse` gerekiyor, Zod tipine bağlanmıyoruz. */
interface ArgumanSemasi<T> {
  safeParse(deger: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ message: string }> } };
}

/**
 * Model argümanlarını çözer ve doğrular.
 *
 * Model argümanları HENÜZ DOĞRULANMAMIŞ dış girdi; şemaya uymayan bir çağrı
 * arama sağlayıcısına hiç gitmiyor. Fırlatmak yerine modele okunabilir bir
 * hata metni dönüyoruz ki döngü kendini düzeltebilsin.
 */
function argumanlariCoz<T>(
  sema: ArgumanSemasi<T>,
  argsJson: string
): { ok: true; data: T } | { ok: false; hata: string } {
  let ham: unknown;
  try {
    ham = JSON.parse(argsJson);
  } catch {
    return { ok: false, hata: JSON.stringify({ error: "Argümanlar geçerli JSON değil" }) };
  }

  const parsed = sema.safeParse(ham);
  if (!parsed.success) {
    return {
      ok: false,
      hata: JSON.stringify({
        error: `Argümanlar şemaya uymuyor: ${parsed.error.issues[0]?.message ?? "geçersiz"}`,
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Arama sonucunu modele verilecek JSON metnine çevirir.
 *
 * Sağlayıcıdan gelen her adres `defter`e yazılıyor. Bu, bütçe kalemlerinin
 * `source` alanı için beyaz liste oluşturuyor — modelin uydurduğu ya da
 * zehirli bir snippet metninden kopyaladığı adresler listeye GİRMİYOR
 * (bkz. agent-tools.ts `KaynakDefteri`).
 */
async function aramaSonucuMetni(
  sorgu: string,
  defter?: KaynakDefteri,
  not?: string
): Promise<string> {
  const sonuclar = await arama(sorgu);

  for (const sonuc of sonuclar) defter?.ekle(sonuc.url);

  if (sonuclar.length === 0) {
    return JSON.stringify({ query: sorgu, results: [], not: "Sonuç bulunamadı." });
  }
  return JSON.stringify({ query: sorgu, results: sonuclar, ...(not ? { not } : {}) });
}

/** İsimden yürütücüye eşleme tutan, ortak hata davranışlı bir kayıt üretir. */
function aracKaydiKur(
  tanimlar: ToolDefinition[],
  yurutucular: Record<string, AracYurutucu>
): ToolRegistry {
  return {
    definitions: tanimlar,
    async execute(name, argsJson) {
      const yurutucu = yurutucular[name];
      if (!yurutucu) {
        return JSON.stringify({ error: `Bilinmeyen araç: ${name}` });
      }
      return yurutucu(argsJson);
    },
  };
}

/**
 * `web_search` aracını `ToolRegistry` şekline sarar.
 *
 * Argümanlar YÜRÜTMEDEN ÖNCE `webSearchToolArgsSchema` ile doğrulanıyor —
 * model geçersiz/eksik argüman üretirse arama sağlayıcısına hiç gitmiyor,
 * modele anlamlı bir hata mesajı dönüyor ki döngü kendini düzeltebilsin.
 */
export function webAramaAracKaydi(defter?: KaynakDefteri): ToolRegistry {
  if (!aramaYapilandirilmisMi()) return bosAracKaydi();

  return aracKaydiKur(
    [
      {
        name: WEB_SEARCH_ARAC_ADI,
        description:
          "Güncel bilgi için interneti arar — açılış saatleri, güncel etkinlikler, " +
          "vize/ulaşım kuralları gibi eğitim verisinde bulunmayan bilgiler için kullan. " +
          "Otel ve ulaşım fiyatları için özel araçları (get_hotel_prices, " +
          "get_transport_prices) tercih et. En fazla 5 sonuç döner: başlık, bağlantı, kısa özet.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: 'Arama sorgusu, örn. "Roma Kolezyum açılış saatleri 2026".',
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    ],
    {
      async [WEB_SEARCH_ARAC_ADI](argsJson) {
        const cozum = argumanlariCoz(webSearchToolArgsSchema, argsJson);
        if (!cozum.ok) return cozum.hata;
        return aramaSonucuMetni(cozum.data.query, defter);
      },
    }
  );
}

/**
 * Otel ve ulaşım fiyat araçları.
 *
 * Bunlar bir rezervasyon API'si DEĞİL: `arama()`nın konuya özel sorgu
 * şablonlu sarmalayıcıları. Ayrı araç olmalarının iki sebebi var:
 * (1) model serbest metin yerine yapılandırılmış alanlar (şehir, tarih,
 * kalkış/varış) veriyor ve sorgu şablonu SUNUCUDA kuruluyor — daha tutarlı
 * sonuç, modelin sorgu yazma becerisine daha az bağımlılık; (2) sonuca
 * fiyatların TAHMİN olduğu uyarısı ekleniyor.
 *
 * Arama sağlayıcısı yapılandırılmamışsa boş kayıt döner — araçlar modele
 * hiç sunulmaz (bkz. `webAramaAracKaydi`).
 */
/**
 * Otel arama sorgusunu kurar.
 *
 * DIŞA AÇIK çünkü iki tüketicisi var: modele sunulan `get_hotel_prices`
 * aracı ve `GET /api/accommodation-options` ucu (konaklama ekranı). Sorgu
 * metni gerçek Tavily sonuçlarıyla AYARLANDI — kopyalanırsa iki taraf
 * zamanla ayrışır ve biri kötü sonuç vermeye başlar.
 *
 * Çıkış tarihi sorguya GİRMİYOR: aralık bilgisinin arama sonucuna katkısı
 * yok, sorguyu uzatıp isabeti düşürüyor.
 */
export function otelAramaSorgusu(
  city: string,
  checkIn?: string,
  budgetLevel?: string
): string {
  return [
    city,
    butceSeviyesiKelimesi(budgetLevel),
    "otel fiyatları gecelik ortalama",
    ayYilMetni(checkIn),
  ]
    .filter(Boolean)
    .join(" ");
}

export function fiyatAraclariKaydi(defter?: KaynakDefteri): ToolRegistry {
  if (!aramaYapilandirilmisMi()) return bosAracKaydi();

  return aracKaydiKur(
    [
      {
        name: OTEL_FIYAT_ARAC_ADI,
        description:
          "Bir şehirdeki güncel otel/konaklama fiyat aralıklarını arar. Konaklama " +
          "bütçesini tahmin ederken kullan. Dönen tutarlar tahmindir, kesin fiyat değildir.",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: 'Şehir adı, örn. "Roma".' },
            checkIn: { type: "string", description: 'Giriş tarihi, örn. "2026-05-15".' },
            checkOut: { type: "string", description: 'Çıkış tarihi, örn. "2026-05-20".' },
            budgetLevel: {
              type: "string",
              description: 'Bütçe seviyesi: "ekonomik", "orta" ya da "lüks".',
            },
          },
          required: ["city"],
          additionalProperties: false,
        },
      },
      {
        name: ULASIM_FIYAT_ARAC_ADI,
        description:
          "İki nokta arasındaki güncel ulaşım (uçak/otobüs/tren) bilet fiyatlarını arar. " +
          "Ulaşım bütçesini tahmin ederken kullan. Dönen tutarlar tahmindir.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string", description: 'Kalkış şehri, örn. "İstanbul".' },
            to: { type: "string", description: 'Varış şehri, örn. "Roma".' },
            date: { type: "string", description: 'Gidiş tarihi, örn. "2026-05-15".' },
            mode: {
              type: "string",
              description: 'Ulaşım türü: "uçak", "otobüs" ya da "tren".',
            },
          },
          required: ["from", "to"],
          additionalProperties: false,
        },
      },
    ],
    {
      async [OTEL_FIYAT_ARAC_ADI](argsJson) {
        const cozum = argumanlariCoz(hotelPricesToolArgsSchema, argsJson);
        if (!cozum.ok) return cozum.hata;

        const { city, checkIn, budgetLevel } = cozum.data;
        return aramaSonucuMetni(
          otelAramaSorgusu(city, checkIn, budgetLevel),
          defter,
          FIYAT_UYARISI
        );
      },

      async [ULASIM_FIYAT_ARAC_ADI](argsJson) {
        const cozum = argumanlariCoz(transportPricesToolArgsSchema, argsJson);
        if (!cozum.ok) return cozum.hata;

        const { from, to, date, mode } = cozum.data;
        const sorgu = [from, to, mode ?? "", "bilet fiyatı", ayYilMetni(date)]
          .filter(Boolean)
          .join(" ");

        return aramaSonucuMetni(sorgu, defter, FIYAT_UYARISI);
      },
    }
  );
}
