import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MODEL SAĞLIĞI (B2).
 *
 * Bu testlerin var olma sebebi tek bir hata modu: yapılandırılmış OpenRouter
 * modeli katalogdan SESSİZCE kalkıyor ve plan üretimi bir gün çalışmayı
 * bırakıyor. Üç kez yaşandı, üçünde de kullanıcı şikâyetiyle öğrenildi.
 *
 * `modelleriYokla` bu durumu görünür kılıyor; buradaki testler onun
 * sözleşmesini koruyor. Kataloğun GERÇEKTEN okunabildiğini doğrulamak canlı
 * testin işi (tests/openrouter.canli.test.ts) — mock'lu bir test sağlayıcı
 * tarafındaki bir değişikliği göremez.
 *
 * `openrouter.ts` `@/env`'i import anında okuyor; gerçek env doğrulaması
 * testte çalışmasın diye taklit ediliyor (together.test.ts'teki aynı desen).
 */

const envMock = {
  current: {
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_MODEL: undefined as string | undefined,
    OPENROUTER_MODEL_FALLBACK: undefined as string | undefined,
    APP_URL: "http://localhost:3000",
  },
};

vi.mock("@/env", () => ({
  get env() {
    return envMock.current;
  },
}));

async function modulYukle() {
  vi.resetModules();
  return import("@/lib/openrouter");
}

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  envMock.current = {
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_MODEL: undefined,
    OPENROUTER_MODEL_FALLBACK: undefined,
    APP_URL: "http://localhost:3000",
  };
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * `NODE_ENV`i geçici olarak değiştirir.
 *
 * `Object.defineProperty(process.env, ...)` KULLANILAMAZ: Node `process.env`
 * için yalnızca yazılabilir+numaralanabilir veri tanımlayıcısı kabul ediyor,
 * aksi halde TypeError fırlatıyor. `vi.stubEnv` bunu doğru yapıyor ve
 * `unstubAllEnvs` ile geri alınıyor.
 */
function nodeEnvAyarla(deger: string) {
  vi.stubEnv("NODE_ENV", deger);
}

/** OpenRouter `/api/v1/models` yanıtını taklit eder. */
function katalog(idler: string[], status = 200): Response {
  return new Response(JSON.stringify({ data: idler.map((id) => ({ id })) }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ucretsizModelMi", () => {
  it(":free sonekini tanır", async () => {
    const { ucretsizModelMi } = await modulYukle();

    expect(ucretsizModelMi("z-ai/glm-5.2:free")).toBe(true);
    expect(ucretsizModelMi("  z-ai/glm-5.2:free  ")).toBe(true);
    expect(ucretsizModelMi("openai/gpt-5")).toBe(false);
    // Sonek ORTADA geçerse ücretsiz değil; kimliğin sonuna bakıyoruz.
    expect(ucretsizModelMi("saglayici/model:free-deneme")).toBe(false);
  });
});

describe("modelleriYokla", () => {
  it("her iki model de katalogdaysa ok döner, eksik yok", async () => {
    envMock.current.OPENROUTER_MODEL = "saglayici/birincil";
    envMock.current.OPENROUTER_MODEL_FALLBACK = "saglayici/yedek";

    global.fetch = vi
      .fn()
      .mockResolvedValue(katalog(["saglayici/birincil", "saglayici/yedek", "baska/model"]));

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla();

    expect(sonuc.ok).toBe(true);
    expect(sonuc.eksikler).toEqual([]);
    expect(sonuc.modeller).toHaveLength(2);
    expect(sonuc.modeller.every((m) => m.bulundu)).toBe(true);
  });

  it("ASIL SENARYO: katalogdan kalkmış modeli eksik olarak bildirir", async () => {
    envMock.current.OPENROUTER_MODEL = "olmus/model:free";
    envMock.current.OPENROUTER_MODEL_FALLBACK = "yasayan/model";

    global.fetch = vi.fn().mockResolvedValue(katalog(["yasayan/model"]));

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla();

    expect(sonuc.ok).toBe(true);
    expect(sonuc.eksikler).toEqual(["olmus/model:free"]);

    const olmus = sonuc.modeller.find((m) => m.model === "olmus/model:free")!;
    expect(olmus.bulundu).toBe(false);
    expect(olmus.ucretsiz).toBe(true);
  });

  it("anahtarı Authorization başlığında gönderir", async () => {
    const fetchMock = vi.fn().mockResolvedValue(katalog(["a/b"]));
    global.fetch = fetchMock;

    const { modelleriYokla } = await modulYukle();
    await modelleriYokla();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/models");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test");
  });

  it("HTTP hatasında ok:false döner, fırlatmaz", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("üst kaynak hatası", { status: 502 }));

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla();

    expect(sonuc.ok).toBe(false);
    expect(sonuc.status).toBe(502);
    // Katalog okunamadıysa "hepsi eksik" DEMİYORUZ; durum bilinmiyor.
    expect(sonuc.eksikler).toEqual([]);
  });

  it("ağ hatasında ok:false döner, fırlatmaz", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla();

    expect(sonuc.ok).toBe(false);
    expect(sonuc.status).toBe(0);
    expect(sonuc.detay).toContain("ECONNRESET");
  });

  it("boş katalog 'hepsi eksik' sayılmaz", async () => {
    // Sağlayıcı beklenmeyen bir şekil dönerse bunu üretim arızası gibi
    // raporlamak yanlış alarm üretir.
    global.fetch = vi.fn().mockResolvedValue(katalog([]));

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla();

    expect(sonuc.ok).toBe(false);
    expect(sonuc.eksikler).toEqual([]);
  });

  it("zaman aşımında ok:false döner", async () => {
    global.fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_cozumle, reddet) => {
          init.signal?.addEventListener("abort", () => {
            const hata = new Error("aborted");
            hata.name = "AbortError";
            reddet(hata);
          });
        })
    );

    const { modelleriYokla } = await modulYukle();
    const sonuc = await modelleriYokla(20);

    expect(sonuc.ok).toBe(false);
    expect(sonuc.detay).toContain("Zaman aşımı");
  });
});

describe("chatCompletion istek gövdesi", () => {
  /** Sohbet tamamlama yanıtını taklit eder. */
  function sohbetYaniti(content: string): Response {
    return new Response(
      JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  it("frequency_penalty ve presence_penalty GÖNDERMEZ", async () => {
    // REGRESYON — canlı çağrıyla ölçülen gerçek hata (2 Eylül 2026):
    //
    // İkisi de 0 gönderiliyordu, yani davranışa hiçbir katkıları yoktu.
    // Ama `provider.require_parameters: true` ile birlikte OpenRouter
    // isteği YALNIZCA tüm bu parametreleri destekleyen sağlayıcılara
    // yönlendiriyor. Varsayılan birincil model bu ikisini desteklemediği
    // için istek
    //   404 "No endpoints found that can handle the requested parameters"
    // dönüyordu; aynı istek penalty'siz 200 dönüyor.
    //
    // ETKİSİ: plan üretiminin BİRİNCİ ve en iyi stratejisi (strict
    // json_schema) her seferinde sessizce düşüyor, zincir json_object'e
    // geçiyordu. Plan yine üretildiği için hata hiç fark edilmemişti.
    const fetchMock = vi.fn().mockResolvedValue(sohbetYaniti('{"a":1}'));
    global.fetch = fetchMock;

    const { chatCompletion } = await modulYukle();
    await chatCompletion({
      model: "saglayici/model",
      messages: [{ role: "user", content: "merhaba" }],
      requireParameters: true,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const govde = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(govde).not.toHaveProperty("frequency_penalty");
    expect(govde).not.toHaveProperty("presence_penalty");

    // Yönlendirmeyi daraltan bayrak yerinde duruyor; kaldırılmadı.
    expect(govde.provider).toEqual({ require_parameters: true });
  });

  it("requireParameters verilmezse provider alanı hiç gönderilmez", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sohbetYaniti('{"a":1}'));
    global.fetch = fetchMock;

    const { chatCompletion } = await modulYukle();
    await chatCompletion({
      model: "saglayici/model",
      messages: [{ role: "user", content: "merhaba" }],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const govde = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(govde).not.toHaveProperty("provider");
  });
});

describe("ucretsizModelUyarisi", () => {
  it("üretimde ücretsiz model için BİR KEZ uyarır", async () => {
    nodeEnvAyarla("production");
    envMock.current.OPENROUTER_MODEL = "bedava/model:free";
    envMock.current.OPENROUTER_MODEL_FALLBACK = "bedava/yedek:free";

    const { ucretsizModelUyarisi } = await modulYukle();
    const { logger } = await import("@/lib/logger");
    const uyari = vi.spyOn(logger, "warn").mockImplementation(() => {});

    ucretsizModelUyarisi();
    ucretsizModelUyarisi();
    ucretsizModelUyarisi();

    // Her istekte log basmak üretim log'unu doldururdu.
    expect(uyari).toHaveBeenCalledTimes(1);
    expect(uyari.mock.calls[0][2]).toMatchObject({
      modeller: ["bedava/model:free", "bedava/yedek:free"],
    });
  });

  it("geliştirmede uyarmaz", async () => {
    nodeEnvAyarla("development");
    envMock.current.OPENROUTER_MODEL = "bedava/model:free";

    const { ucretsizModelUyarisi } = await modulYukle();
    const { logger } = await import("@/lib/logger");
    const uyari = vi.spyOn(logger, "warn").mockImplementation(() => {});

    ucretsizModelUyarisi();

    // Yerelde ücretsiz model makul; engellemek geliştiriciyi anahtar
    // almaya zorlardı.
    expect(uyari).not.toHaveBeenCalled();
  });

  it("üretimde ücretli model kullanılıyorsa uyarmaz", async () => {
    nodeEnvAyarla("production");
    envMock.current.OPENROUTER_MODEL = "saglayici/ucretli";
    envMock.current.OPENROUTER_MODEL_FALLBACK = "saglayici/ucretli-yedek";

    const { ucretsizModelUyarisi } = await modulYukle();
    const { logger } = await import("@/lib/logger");
    const uyari = vi.spyOn(logger, "warn").mockImplementation(() => {});

    ucretsizModelUyarisi();

    expect(uyari).not.toHaveBeenCalled();
  });
});
