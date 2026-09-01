import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `together.ts` `@/env`'i import anında okuyor; testte gerçek env
 * doğrulaması çalışmasın diye taklit ediyoruz (bkz. web-search.test.ts'teki
 * aynı desen).
 */
const envMock = {
  current: {
    TOGETHER_API_KEY: "test-key",
    TOGETHER_MODEL: undefined as string | undefined,
  },
};

vi.mock("@/env", () => ({
  get env() {
    return envMock.current;
  },
}));

async function modulYukle() {
  vi.resetModules();
  return import("@/lib/together");
}

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  envMock.current = { TOGETHER_API_KEY: "test-key", TOGETHER_MODEL: undefined };
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function jsonYanit(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("togetherYapilandirilmisMi / togetherModel", () => {
  it("anahtar yoksa false döner", async () => {
    envMock.current.TOGETHER_API_KEY = undefined as unknown as string;
    const { togetherYapilandirilmisMi } = await modulYukle();
    expect(togetherYapilandirilmisMi()).toBe(false);
  });

  it("model env'den okunur, yoksa varsayılana düşer", async () => {
    const { togetherModel } = await modulYukle();
    expect(togetherModel()).toMatch(/Llama-3\.3-70B/);

    envMock.current.TOGETHER_MODEL = "ozel/model";
    const { togetherModel: yeniden } = await modulYukle();
    expect(yeniden()).toBe("ozel/model");
  });
});

describe("chatCompletion", () => {
  it("düz metin yanıtını doğru ayrıştırır", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonYanit({
        choices: [{ message: { content: "merhaba" }, finish_reason: "stop" }],
      })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
    });

    expect(sonuc.ok).toBe(true);
    expect(sonuc.content).toBe("merhaba");
    expect(sonuc.toolCalls).toEqual([]);
    expect(sonuc.finishReason).toBe("stop");
  });

  it("araç çağrısı olan, içeriği boş yanıtı GEÇERLİ sayar", async () => {
    // OpenAI-uyumlu API'lerde model araç çağırdığında content null/boş
    // olabilir; bu durum openrouter.ts'teki "boş içerik = hata" kuralından
    // BİLİNÇLİ olarak farklı — burada içerik + araç çağrısı ikisi birden
    // boşsa hata sayılıyor.
    global.fetch = vi.fn().mockResolvedValue(
      jsonYanit({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                { id: "call_1", type: "function", function: { name: "web_search", arguments: '{"query":"x"}' } },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
      tools: [{ name: "web_search", description: "d", parameters: {} }],
    });

    expect(sonuc.ok).toBe(true);
    expect(sonuc.toolCalls).toHaveLength(1);
    expect(sonuc.toolCalls[0]).toMatchObject({
      id: "call_1",
      function: { name: "web_search", arguments: '{"query":"x"}' },
    });
  });

  it("içerik VE araç çağrısı ikisi de boşsa hata sayar", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonYanit({ choices: [{ message: { content: "" }, finish_reason: "stop" }] })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
    });

    expect(sonuc.ok).toBe(false);
    expect(sonuc.detay).toContain("Boş içerik");
  });

  it("bozuk tool_calls girdilerini sessizce eler", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonYanit({
        choices: [
          {
            message: {
              content: "yine de bir içerik",
              tool_calls: [
                { id: "call_1", type: "function", function: { name: "web_search", arguments: "{}" } },
                { id: "call_2" }, // function eksik — geçersiz
                "bozuk-girdi",
                null,
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
    });

    expect(sonuc.toolCalls).toHaveLength(1);
    expect(sonuc.toolCalls[0].id).toBe("call_1");
  });

  it("tools verildiğinde istek gövdesine OpenAI şeklinde sarar", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonYanit({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
      tools: [{ name: "web_search", description: "ara", parameters: { type: "object" } }],
      toolChoice: "auto",
    });

    const [, init] = fetchSpy.mock.calls[0];
    const gövde = JSON.parse((init as RequestInit).body as string);

    expect(gövde.tools).toEqual([
      {
        type: "function",
        function: { name: "web_search", description: "ara", parameters: { type: "object" } },
      },
    ]);
    expect(gövde.tool_choice).toBe("auto");
  });

  it("tools verilmediğinde istek gövdesinde tools alanı yer almaz", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonYanit({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    await chatCompletion({ model: "test-model", messages: [{ role: "user", content: "selam" }] });

    const [, init] = fetchSpy.mock.calls[0];
    const gövde = JSON.parse((init as RequestInit).body as string);
    expect(gövde).not.toHaveProperty("tools");
  });

  it("HTTP hatasında ok:false ve durum kodu döner", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("yetkisiz", { status: 401 })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
    });

    expect(sonuc.ok).toBe(false);
    expect(sonuc.status).toBe(401);
  });

  it("ağ hatasında ok:false döner, fırlatmaz", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
    });

    expect(sonuc.ok).toBe(false);
    expect(sonuc.detay).toContain("Ağ hatası");
  });

  it("zaman aşımında iptal edilir ve anlamlı bir detay döner", async () => {
    global.fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        })
    ) as unknown as typeof fetch;

    const { chatCompletion } = await modulYukle();
    const sonuc = await chatCompletion({
      model: "test-model",
      messages: [{ role: "user", content: "selam" }],
      timeoutMs: 20,
    });

    expect(sonuc.ok).toBe(false);
    expect(sonuc.detay).toContain("Zaman aşımı");
  });
});
