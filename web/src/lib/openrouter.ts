import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * OpenRouter istemcisi ve model seçimi.
 *
 * Model kimliği eskiden route dosyasına sabit yazılıydı ve seçilen model
 * (`deepseek/deepseek-r1-0528-qwen3-8b:free`) katalogdan kalktığı için endpoint
 * 502 dönüyordu. Artık model env'den okunuyor (env.ts'te doğrulanıyor) ve bir
 * yedeği var.
 *
 * ÜCRETSİZ MODELLER KALICI DEĞİL — bu üçüncü kez yaşandı. 31 Ağustos 2026'da
 * yapılan gerçek çağrılarda ÖNCEKİ iki varsayılan da ölmüştü:
 *   openai/gpt-oss-20b:free        → 404 "unavailable for free"
 *   nvidia/nemotron-nano-9b-v2:free → 404 "No endpoints found"
 * Yani agentic yol devreye girmeden önce bu zincirin tamamı kırıktı.
 *
 * Aşağıdaki varsayılanlar aynı gün gerçek isteklerle doğrulandı (strict
 * `json_schema` ile geçerli JSON döndürdüler). Yine de KALICI ÇÖZÜM DEĞİL:
 * üretimde `OPENROUTER_MODEL` ile ücretli, kalıcı bir model tanımlayın.
 * Yeniden kontrol: `GET /api/v1/models` → `supported_parameters` içinde
 * "structured_outputs" olan `:free` modelleri süz, birer istek at.
 */

/** Varsayılan model: yapılandırılmış çıktı (structured outputs) destekliyor. */
const VARSAYILAN_MODEL = "dots-studio/dots-3-note-preview:free";
/** Yedek model: birincil model hata verirse denenir. */
const VARSAYILAN_YEDEK_MODEL = "z-ai/glm-5.2:free";

export function openRouterModels(): string[] {
  const birincil = env.OPENROUTER_MODEL?.trim() || VARSAYILAN_MODEL;
  const yedek = env.OPENROUTER_MODEL_FALLBACK?.trim() || VARSAYILAN_YEDEK_MODEL;

  // Aynı model iki kez denenmesin.
  return birincil === yedek ? [birincil] : [birincil, yedek];
}

/* -------------------------------------------------------------------------- */
/* Model sağlığı                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Model kimliği ücretsiz katmanı mı gösteriyor?
 *
 * OpenRouter ücretsiz varyantları `:free` sonekiyle ayırıyor. Sonek
 * kaldırılan bir model başka bir kimlik demek, yani "aynı modelin ücretli
 * hâline geçildi" varsayımı YAPILAMAZ — bu yüzden kod otomatik bir geçiş
 * denemiyor, yalnızca uyarıyor.
 */
export function ucretsizModelMi(model: string): boolean {
  return model.trim().endsWith(":free");
}

/**
 * Üretimde ücretsiz model kullanılıyorsa BİR KEZ uyarır.
 *
 * NEDEN VAR: bu hata modu üç kez yaşandı ve üçünde de SESSİZ oldu. Ücretsiz
 * bir model katalogdan kalktığında OpenRouter 404 dönüyor, plan üretimi
 * yedeğe düşüyor, yedek de aynı gün ölmüşse zincirin tamamı kırılıyor —
 * ve bunu ancak bir kullanıcı şikâyet ettiğinde öğreniyoruz.
 *
 * Uyarı log'a düşüyor, üretimi DURDURMUYOR: yerel geliştirmede ücretsiz
 * model tamamen makul, engellemek geliştiriciyi anahtar almaya zorlardı.
 * Yalnızca `NODE_ENV=production` altında ve modül başına bir kez basılıyor
 * ki her istekte log'u doldurmasın.
 */
let uyariBasildi = false;

export function ucretsizModelUyarisi(): void {
  if (uyariBasildi) return;
  if (process.env.NODE_ENV !== "production") return;

  const ucretsizler = openRouterModels().filter(ucretsizModelMi);
  if (ucretsizler.length === 0) return;

  uyariBasildi = true;
  logger.warn(
    "Üretimde ücretsiz OpenRouter modeli kullanılıyor; katalogdan kalkarsa plan üretimi sessizce durur",
    undefined,
    { modeller: ucretsizler }
  );
}

/** Tek bir modelin katalogdaki durumu. */
export interface ModelDurumu {
  model: string;
  /** Model OpenRouter kataloğunda hâlâ duruyor mu? */
  bulundu: boolean;
  ucretsiz: boolean;
}

export interface ModelYoklamasi {
  /** Katalog OKUNABİLDİ mi? Modellerin bulunup bulunmadığından bağımsız. */
  ok: boolean;
  /** HTTP durum kodu; ağ hatasında 0. */
  status: number;
  modeller: ModelDurumu[];
  /** Yapılandırılmış modellerden katalogda olmayanlar. */
  eksikler: string[];
  /** Yalnızca sunucu log'una yazılacak hata ayrıntısı. */
  detay: string;
}

/**
 * Yapılandırılmış modellerin katalogda hâlâ var olduğunu doğrular.
 *
 * NEDEN SOHBET ÇAĞRISI DEĞİL: `/api/v1/models` bir GET, ücretsiz ve token
 * harcamıyor. Sorulan soru zaten "model hâlâ var mı?" — sohbet çağrısı bunu
 * da doğrular ama her sağlık yoklamasında para harcar. Anahtarın geçerli
 * olduğunu ayrıca doğrulamak isteyen canlı test gerçek bir çağrı yapıyor
 * (tests/openrouter.canli.test.ts).
 *
 * ASLA FIRLATMAZ: sağlık ucundan çağrılıyor ve orada bir istisna
 * `/health`in kendisini düşürürdü.
 */
export async function modelleriYokla(timeoutMs = 5_000): Promise<ModelYoklamasi> {
  const modeller = openRouterModels();
  const bos = modeller.map((model) => ({
    model,
    bulundu: false,
    ucretsiz: ucretsizModelMi(model),
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      const govde = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        modeller: bos,
        eksikler: [],
        detay: govde.slice(0, 300),
      };
    }

    const govde = (await response.json()) as { data?: Array<{ id?: unknown }> };
    const kimlikler = new Set(
      (Array.isArray(govde.data) ? govde.data : [])
        .map((m) => (typeof m.id === "string" ? m.id : ""))
        .filter(Boolean)
    );

    // Katalog boş dönerse "hepsi eksik" demek yanlış olur; sağlayıcı
    // tarafında beklenmeyen bir yanıt şekli var demektir.
    if (kimlikler.size === 0) {
      return {
        ok: false,
        status: response.status,
        modeller: bos,
        eksikler: [],
        detay: "Katalog boş ya da beklenmeyen biçimde",
      };
    }

    const durumlar = modeller.map((model) => ({
      model,
      bulundu: kimlikler.has(model),
      ucretsiz: ucretsizModelMi(model),
    }));

    return {
      ok: true,
      status: response.status,
      modeller: durumlar,
      eksikler: durumlar.filter((d) => !d.bulundu).map((d) => d.model),
      detay: "",
    };
  } catch (error) {
    const iptal = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      modeller: bos,
      eksikler: [],
      detay: iptal ? `Zaman aşımı (${timeoutMs} ms)` : `Ağ hatası: ${String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** OpenRouter `response_format` gövdesi (json_schema ya da json_object). */
  responseFormat?: Record<string, unknown>;
  /** `json_schema` kullanılırken şemayı destekleyen sağlayıcıya yönlendirir. */
  requireParameters?: boolean;
  /** Tek çağrı için üst sınır (ms). Aşılırsa istek iptal edilir. */
  timeoutMs?: number;
  /** Dışarıdan gelen iptal sinyali; toplam bütçe dolduğunda tetiklenir. */
  signal?: AbortSignal;
}

/**
 * Tek bir OpenRouter çağrısının varsayılan zaman aşımı.
 *
 * NEDEN GEREKLİ: bu istemci `fetch`i zaman aşımsız çağırıyordu. Plan üretimi
 * en kötü durumda 2 model × 3 strateji + 1 onarım = 7 ardışık çağrı yapıyor;
 * sağlayıcı yanıt vermezse istek süresiz asılı kalıyor, Node tarafında
 * bağlantı, kullanıcı tarafında dönen spinner birikiyordu.
 */
export const VARSAYILAN_ZAMAN_ASIMI_MS = 60_000;

export interface ChatResult {
  ok: boolean;
  /** HTTP durum kodu; ağ hatasında 0. */
  status: number;
  content: string;
  /** "stop" | "length" | ... Kesilmiş JSON'u tespit etmek için gerekli. */
  finishReason: string;
  /** Yalnızca sunucu log'una yazılacak hata ayrıntısı. */
  detay: string;
}

/**
 * Tek bir OpenRouter sohbet çağrısı. Hata durumunda istisna fırlatmaz;
 * çağıran katman kademeli olarak bir sonraki stratejiye geçebilsin diye
 * her zaman bir `ChatResult` döner.
 */
export async function chatCompletion(request: ChatRequest): Promise<ChatResult> {
  // Üretimde ücretsiz model kullanılıyorsa bir kez uyarır; no-op sonrası.
  ucretsizModelUyarisi();

  // GÖNDERİLMEYEN PARAMETRELER: `frequency_penalty` ve `presence_penalty`.
  //
  // İkisi de 0, yani sağlayıcı varsayılanıyla aynı — davranışa hiçbir
  // katkıları yoktu. Ama `provider.require_parameters: true` ile
  // birleştiklerinde OpenRouter'ın yönlendirmesini DARALTIYORLAR: istek
  // yalnızca istenen TÜM parametreleri destekleyen sağlayıcılara gidebiliyor.
  //
  // Ölçüldü (2 Eylül 2026, gerçek çağrı): varsayılan birincil model
  // `dots-studio/dots-3-note-preview:free` bu iki parametreyi desteklemiyor
  // (`supported_parameters` listesinde yoklar) ve istek
  //   404 "No endpoints found that can handle the requested parameters"
  // dönüyordu. Aynı istek penalty'ler olmadan 200 dönüyor.
  //
  // ETKİSİ: `plan-generation.ts`'in BİRİNCİ ve en iyi stratejisi (strict
  // `json_schema`) her üretimde sessizce başarısız oluyor, zincir
  // `json_object`e düşüyordu. Plan yine üretiliyordu — bu yüzden hata
  // görünmüyordu — ama her istekte bir tur boşa gidiyor ve şema garantisi
  // kayboluyordu.
  //
  // KURAL: `require_parameters` ile birlikte YALNIZCA gerçekten ihtiyaç
  // duyulan parametreler gönderilmeli. Varsayılan değerli bir parametre
  // eklemek burada bedava değil.
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    // Yapılandırılmış çıktı markdown'dan daha uzun sürebiliyor.
    max_tokens: request.maxTokens ?? 16000,
    top_p: 1,
  };

  if (request.responseFormat) {
    body.response_format = request.responseFormat;
  }

  if (request.requireParameters) {
    body.provider = { require_parameters: true };
  }

  // Zaman aşımı ve dış iptal sinyali birleştiriliyor: hangisi önce
  // tetiklenirse istek düşüyor.
  const controller = new AbortController();
  const zamanAsimi = request.timeoutMs ?? VARSAYILAN_ZAMAN_ASIMI_MS;
  const timer = setTimeout(() => controller.abort(), zamanAsimi);
  const disIptal = () => controller.abort();
  request.signal?.addEventListener("abort", disIptal);

  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.APP_URL ?? "http://localhost:3000",
        "X-Title": "Trip Planner App",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (networkError) {
    const iptalEdildi =
      networkError instanceof Error && networkError.name === "AbortError";

    return {
      ok: false,
      status: 0,
      content: "",
      finishReason: "",
      detay: iptalEdildi
        ? `Zaman aşımı (${zamanAsimi} ms) ya da iptal`
        : `Ağ hatası: ${String(networkError)}`,
    };
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", disIptal);
  }

  const responseText = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      content: "",
      finishReason: "",
      detay: responseText.slice(0, 1000),
    };
  }

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      status: response.status,
      content: "",
      finishReason: "",
      detay: `Beklenmeyen içerik tipi: ${contentType} | ${responseText.slice(0, 500)}`,
    };
  }

  let apiData: unknown;
  try {
    apiData = JSON.parse(responseText);
  } catch (parseError) {
    return {
      ok: false,
      status: response.status,
      content: "",
      finishReason: "",
      detay: `JSON ayrıştırma hatası: ${String(parseError)}`,
    };
  }

  const choice = (apiData as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }> })
    ?.choices?.[0];
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : "";

  if (content.trim().length === 0) {
    return {
      ok: false,
      status: response.status,
      content: "",
      finishReason,
      detay: `Boş içerik: ${JSON.stringify(apiData).slice(0, 500)}`,
    };
  }

  return { ok: true, status: response.status, content, finishReason, detay: "" };
}

/**
 * Model çıktısından JSON gövdesini söker.
 *
 * Modeller `json_object` modunda bile ```json çiti ya da açıklama cümlesi
 * ekleyebiliyor; bu yüzden ilk dengeli `{...}` bloğunu arıyoruz.
 */
export function extractJsonObject(raw: string): unknown | null {
  const temiz = raw
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  const dogrudan = jsonParseSessiz(temiz);
  if (dogrudan !== null) return dogrudan;

  const start = temiz.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < temiz.length; i++) {
    const ch = temiz[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return jsonParseSessiz(temiz.slice(start, i + 1));
      }
    }
  }

  return null;
}

function jsonParseSessiz(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
