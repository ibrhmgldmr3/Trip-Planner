import { describe, expect, it } from "vitest";
import {
  chatCompletion,
  extractJsonObject,
  modelleriYokla,
  openRouterModels,
  ucretsizModelMi,
} from "@/lib/openrouter";

/**
 * CANLI TEST — gerçek OpenRouter çağrısı yapar.
 *
 * NEDEN VAR (B2): plan üretimini kıran hata üç kez aynı şekilde geldi ve
 * mock'lu hiçbir test onu göremezdi — çünkü sorun BİZİM KODUMUZDA DEĞİLDİ.
 * Yapılandırılmış model OpenRouter kataloğundan sessizce kalkıyor, çağrı
 * 404 dönüyor, zincir yedeğe düşüyor, yedek de aynı gün ölmüşse plan
 * üretimi tamamen duruyor:
 *
 *   openai/gpt-oss-20b:free         → 404 "unavailable for free"
 *   nvidia/nemotron-nano-9b-v2:free → 404 "No endpoints found"
 *
 * Bu dosya haftalık bir zamanlanmış işte koşmalı. Kırmızıya döndüğünde
 * yapılacak şey `OPENROUTER_MODEL` / `OPENROUTER_MODEL_FALLBACK`i güncel,
 * tercihen ÜCRETLİ bir modele çevirmek.
 *
 * Anahtar yoksa test kendini atlar; CI'da anahtarsız koşum yeşil kalır.
 */

const anahtarVar = Boolean(process.env.OPENROUTER_API_KEY);

describe.skipIf(!anahtarVar)("OpenRouter — canlı", () => {
  it("yapılandırılmış modeller katalogda hâlâ duruyor", async () => {
    const sonuc = await modelleriYokla(15_000);

    // Katalog okunamadıysa bu testin söyleyeceği bir şey yok; ağ ya da
    // sağlayıcı sorunu bizim yapılandırmamızla ilgili değil.
    expect(sonuc.ok, `Katalog okunamadı: ${sonuc.detay}`).toBe(true);

    expect(
      sonuc.eksikler,
      `Katalogdan kalkmış model(ler): ${sonuc.eksikler.join(", ")}. ` +
        `OPENROUTER_MODEL / OPENROUTER_MODEL_FALLBACK güncellenmeli.`
    ).toEqual([]);
  }, 20_000);

  it("birincil model yapılandırılmış JSON çıktısı üretebiliyor", async () => {
    // Katalogda olmak yetmiyor: modelin `json_schema` desteklemesi de
    // gerekiyor. `plan-generation.ts` ilk stratejide tam olarak bunu
    // istiyor; desteklemeyen bir modelde zincir sessizce ikinci stratejiye
    // düşüyor ve çıktı kalitesi düşüyor.
    const [birincil] = openRouterModels();

    const sonuc = await chatCompletion({
      model: birincil,
      messages: [
        {
          role: "system",
          content:
            "Yalnızca şu şemaya uyan tek bir JSON nesnesi döndür: " +
            '{"sehir": string, "gun": number}. Açıklama ekleme.',
        },
        { role: "user", content: "Roma için 3 günlük bir plan başlığı üret." },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "canli_yoklama",
          strict: true,
          schema: {
            type: "object",
            properties: { sehir: { type: "string" }, gun: { type: "number" } },
            required: ["sehir", "gun"],
            additionalProperties: false,
          },
        },
      },
      requireParameters: true,
      // BÜTÇE CÖMERT OLMAK ZORUNDA. Varsayılan modeller akıl yürütme
      // (reasoning) modelleri ve üretilen düşünce token'ları `max_tokens`
      // bütçesinden düşüyor. 200 token'lık bir yoklamada model bütçenin
      // tamamını `reasoning` alanına harcayıp `content: null` +
      // `finish_reason: "length"` döndürüyor — yani test, üretimde
      // olmayan bir hatayı raporluyordu (üretim 16000 kullanıyor).
      maxTokens: 3000,
      timeoutMs: 30_000,
    });

    expect(sonuc.ok, `Çağrı başarısız (HTTP ${sonuc.status}): ${sonuc.detay}`).toBe(true);
    expect(sonuc.finishReason).not.toBe("length");

    const cozulen = extractJsonObject(sonuc.content) as {
      sehir?: unknown;
      gun?: unknown;
    } | null;

    expect(cozulen, `Yanıt JSON değil: ${sonuc.content.slice(0, 200)}`).not.toBeNull();
    expect(typeof cozulen!.sehir).toBe("string");
    expect(typeof cozulen!.gun).toBe("number");
  }, 40_000);

  it("üretim yapılandırmasında ücretsiz model kullanılmıyor", async () => {
    // Bu test YALNIZCA NODE_ENV=production ile koşulduğunda anlamlı; yerel
    // geliştirmede ücretsiz model tamamen makul ve kendini atlıyor.
    if (process.env.NODE_ENV !== "production") return;

    const ucretsizler = openRouterModels().filter(ucretsizModelMi);

    expect(
      ucretsizler,
      `Üretimde ücretsiz model: ${ucretsizler.join(", ")}. ` +
        `Ücretsiz katman garanti edilmiyor; katalogdan kalktığı gün plan ` +
        `üretimi durur.`
    ).toEqual([]);
  });
}, 60_000);
