import { env } from "@/env";
import type { ToolDefinition } from "@/lib/agent-tools";

/**
 * Together.ai istemcisi — yalnızca AGENTIC (araç çağıran) plan üretim yolu
 * için kullanılıyor.
 *
 * NEDEN AYRI BİR İSTEMCİ, `openrouter.ts` DEĞİL: mevcut yapılandırılmış/
 * markdown üretim zinciri çalışıyor ve test edilmiş durumda; onu yeni bir
 * sağlayıcıya taşımak riski büyütür. Bunun yerine `openrouter.ts`'in
 * `ChatRequest`/`ChatResult` şeklini BİREBİR taşıyan, ayrı ve izole bir
 * istemci yazıldı. `plan-generation.ts`'teki agentic yol Together
 * kullanılamadığında (anahtar yok, hata) sessizce mevcut OpenRouter
 * zincirine düşüyor — bu dosya yalnızca EKLENEN bir yol, var olanın
 * yerine geçmiyor.
 *
 * Neden Together: araç çağırma güvenilirliği ücretsiz OpenRouter
 * modellerinden çok daha yüksek ve Llama 3.3 70B Turbo karma
 * ~$0.88–1.04/1M token gibi düşük bir maliyetle function calling +
 * JSON mode destekliyor.
 */

const TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions";

/**
 * Varsayılan model: ücretli, hız sınırsız Turbo sürümü.
 *
 * Yerel geliştirmede bakiyeye dokunmadan çalışmak için env'den ücretsiz
 * sürüme (`...-Turbo-Free`) çevrilebilir — Together panelinizdeki tam
 * model kimliğini kullanın, model adları sağlayıcı tarafında değişebilir.
 */
const VARSAYILAN_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export function togetherYapilandirilmisMi(): boolean {
  return Boolean(env.TOGETHER_API_KEY?.trim());
}

export function togetherModel(): string {
  return env.TOGETHER_MODEL?.trim() || VARSAYILAN_MODEL;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Yalnızca `assistant` mesajları, model araç çağırdığında taşır. */
  tool_calls?: ToolCall[];
  /** Yalnızca `tool` mesajları; hangi çağrının sonucu olduğunu eşler. */
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Sağlayıcıdan bağımsız araç tanımları; istekte OpenAI şekline sarılır. */
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none";
  /** Tek çağrı için üst sınır (ms). Aşılırsa istek iptal edilir. */
  timeoutMs?: number;
  /** Dışarıdan gelen iptal sinyali; toplam bütçe dolduğunda tetiklenir. */
  signal?: AbortSignal;
}

/** openrouter.ts ile aynı varsayılan; iki istemci arasında tutarlılık için. */
export const VARSAYILAN_ZAMAN_ASIMI_MS = 60_000;

export interface ChatResult {
  ok: boolean;
  /** HTTP durum kodu; ağ hatasında 0. */
  status: number;
  content: string;
  /** Model araç çağırdıysa dolu; aksi halde boş dizi. */
  toolCalls: ToolCall[];
  /** "stop" | "length" | "tool_calls" | ... */
  finishReason: string;
  /** Yalnızca sunucu log'una yazılacak hata ayrıntısı. */
  detay: string;
}

function bosSonuc(alanlar: Partial<ChatResult> & { detay: string }): ChatResult {
  return {
    ok: false,
    status: 0,
    content: "",
    toolCalls: [],
    finishReason: "",
    ...alanlar,
  };
}

/**
 * Tek bir Together.ai sohbet çağrısı. Hata durumunda istisna fırlatmaz;
 * çağıran katman (agentic döngü) kademeli olarak geriye düşebilsin diye
 * her zaman bir `ChatResult` döner. Davranış `openrouter.ts`'teki
 * `chatCompletion` ile bilinçli olarak simetrik.
 */
export async function chatCompletion(request: ChatRequest): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    max_tokens: request.maxTokens ?? 16000,
    top_p: 1,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tanim) => ({
      type: "function",
      function: {
        name: tanim.name,
        description: tanim.description,
        parameters: tanim.parameters,
      },
    }));
    body.tool_choice = request.toolChoice ?? "auto";
  }

  const controller = new AbortController();
  const zamanAsimi = request.timeoutMs ?? VARSAYILAN_ZAMAN_ASIMI_MS;
  const timer = setTimeout(() => controller.abort(), zamanAsimi);
  const disIptal = () => controller.abort();
  request.signal?.addEventListener("abort", disIptal);

  let response: Response;
  try {
    response = await fetch(TOGETHER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (networkError) {
    const iptalEdildi =
      networkError instanceof Error && networkError.name === "AbortError";

    return bosSonuc({
      detay: iptalEdildi
        ? `Zaman aşımı (${zamanAsimi} ms) ya da iptal`
        : `Ağ hatası: ${String(networkError)}`,
    });
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", disIptal);
  }

  const responseText = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    return bosSonuc({ status: response.status, detay: responseText.slice(0, 1000) });
  }

  if (!contentType.includes("application/json")) {
    return bosSonuc({
      status: response.status,
      detay: `Beklenmeyen içerik tipi: ${contentType} | ${responseText.slice(0, 500)}`,
    });
  }

  let apiData: unknown;
  try {
    apiData = JSON.parse(responseText);
  } catch (parseError) {
    return bosSonuc({
      status: response.status,
      detay: `JSON ayrıştırma hatası: ${String(parseError)}`,
    });
  }

  const message = (
    apiData as {
      choices?: Array<{
        message?: {
          content?: unknown;
          tool_calls?: unknown;
        };
        finish_reason?: unknown;
      }>;
    }
  )?.choices?.[0]?.message;

  const finishReason =
    typeof (apiData as { choices?: Array<{ finish_reason?: unknown }> })?.choices?.[0]
      ?.finish_reason === "string"
      ? ((apiData as { choices: Array<{ finish_reason: string }> }).choices[0].finish_reason)
      : "";

  const content = typeof message?.content === "string" ? message.content : "";
  const toolCalls = gecerliArasCagrilari(message?.tool_calls);

  // İçerik boş ama araç çağrısı varsa bu geçerli bir yanıt — model bilerek
  // metin üretmeden araç çağırıyor. Yalnızca ikisi de boşsa hata sayılır.
  if (content.trim().length === 0 && toolCalls.length === 0) {
    return bosSonuc({
      status: response.status,
      finishReason,
      detay: `Boş içerik: ${JSON.stringify(apiData).slice(0, 500)}`,
    });
  }

  return { ok: true, status: response.status, content, toolCalls, finishReason, detay: "" };
}

/** API yanıtındaki `tool_calls` alanını güvenle `ToolCall[]`'a daraltır. */
function gecerliArasCagrilari(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) return [];

  return value.filter((aday): aday is ToolCall => {
    if (!aday || typeof aday !== "object") return false;
    const c = aday as Record<string, unknown>;
    if (typeof c.id !== "string") return false;
    if (!c.function || typeof c.function !== "object") return false;
    const fn = c.function as Record<string, unknown>;
    return typeof fn.name === "string" && typeof fn.arguments === "string";
  });
}
