import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/sanitize";
import { chatCompletion, extractJsonObject, openRouterModels } from "@/lib/openrouter";
import {
  TRIP_PLAN_SCHEMA_VERSION,
  tripPlanJsonSchema,
  tripPlanStructuredSchema,
  type TripPlanStructured,
} from "@/lib/trip-plan-schema";
import { serializeStructuredPlan } from "@/lib/trip-plan-serialize";
import { extractBudgetInfo, parseTripPlanSections } from "@/lib/legacy-plan-parser";
import { planRequestSchema } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

const SISTEM_MESAJI =
  "Sen uzman bir seyahat danışmanısın. Verilen bilgilere göre kapsamlı, " +
  "kişiselleştirilmiş ve pratik seyahat planları hazırlarsın. Türkçe konuşuyorsun " +
  "ve dünya genelindeki turistik destinasyonlar hakkında derin bilgiye sahipsin.";

/** DB'ye yazılacak plan kolonları. Hem yapılandırılmış hem eski yol bunu üretir. */
interface PlanKolonlari {
  sehir_bilgisi: string;
  gun_plani: string;
  yemek_rehberi: string;
  pratik_bilgiler: string;
  butce_tahmini: string;
  raw_markdown: string;
  total_cost: number;
  daily_cost: number;
}

// Veritabanına kaydetme fonksiyonu
async function saveTripPlanToDatabase(
  formData: {
    city: string;
    country?: string;
    startDate?: string;
    endDate?: string;
    budget?: string;
    interests?: string[];
    travelStyle?: string;
    accommodation?: string;
    transportation?: string[];
    duration?: string;
  },
  kolonlar: PlanKolonlari,
  htmlContent: string,
  model: string,
  structured: TripPlanStructured | null
) {
  try {
    // Session'daki id bayat bir JWT'den gelebilir; TripPlan.user_id'ye FK
    // eklendiği için kullanıcıyı veritabanından doğruluyoruz.
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, email: true },
        });
        userId = user?.id ?? null;
        userEmail = user?.email ?? null;
      }
    } catch (sessionError) {
      logger.error("Oturum bilgisi alınamadı", sessionError);
    }

    const tripPlan = await prisma.tripPlan.create({
      data: {
        city: formData.city.trim(),
        country: formData.country?.trim() || null,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        duration: formData.duration || null,

        // Bölümler
        sehir_bilgisi: kolonlar.sehir_bilgisi || null,
        gun_plani: kolonlar.gun_plani || null,
        yemek_rehberi: kolonlar.yemek_rehberi || null,
        pratik_bilgiler: kolonlar.pratik_bilgiler || null,
        butce_tahmini: kolonlar.butce_tahmini || null,

        // Raw data
        raw_markdown: kolonlar.raw_markdown,
        raw_html: htmlContent,

        // Yapılandırılmış plan (yalnızca JSON yolu başarılı olduğunda).
        plan_json: structured ? (structured as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        plan_schema_version: structured ? TRIP_PLAN_SCHEMA_VERSION : null,

        // Metadata
        ai_model: model,

        // İstatistikler
        total_cost: kolonlar.total_cost || null,
        daily_cost: kolonlar.daily_cost || null,

        // Tercihler
        interests: formData.interests ? JSON.stringify(formData.interests) : null,
        budget_level: formData.budget || null,
        travel_style: formData.travelStyle || null,
        accommodation: formData.accommodation || null,
        transportation: formData.transportation ? JSON.stringify(formData.transportation) : null,

        // Sahiplik userId üzerinden. userEmail geçiş süresince yazılmaya
        // devam ediyor; ayrı bir migration'da düşürülecek.
        userId: userId,
        userEmail: userEmail,
      },
    });

    logger.info("Plan veritabanına kaydedildi", { planId: tripPlan.id });
    return tripPlan;
  } catch (error) {
    logger.error("Plan veritabanına kaydedilemedi", error);
    return null;
  }
}

/** Kullanıcı tercihlerini her iki prompt'un da kullandığı ortak metne çevirir. */
function tercihMetni(input: {
  interestList: string[];
  travelStyle?: string;
  budget?: string;
  accommodation?: string;
  transportationList: string[];
  specialRequirements?: string;
}): string {
  return [
    `- İlgi alanları: ${input.interestList.length > 0 ? input.interestList.join(", ") : "Genel turistik yerler"}`,
    `- Seyahat tarzı: ${input.travelStyle || "Standart"}`,
    `- Bütçe: ${input.budget || "Orta"}`,
    `- Konaklama tercihi: ${input.accommodation || "Otel"}`,
    `- Ulaşım tercihi: ${input.transportationList.length > 0 ? input.transportationList.join(", ") : "Toplu taşıma"}`,
    `- Özel gereksinimler: ${input.specialRequirements || "Yok"}`,
  ].join("\n");
}

/**
 * Yapılandırılmış (JSON) plan üretimi.
 *
 * Kademeli strateji; her kademe bir öncekinin desteklenmemesi durumuna karşı:
 *  1. `json_schema` + `strict` + `provider.require_parameters`
 *  2. `json_object` (şema system mesajında tarif ediliyor)
 *  3. `response_format` yok, düz "yalnızca JSON döndür" isteği
 *
 * Her kademede çıktı Zod ile doğrulanır; şema hatasında BİR KEZ onarım turu
 * yapılır. Hiçbiri tutmazsa null döner ve çağıran eski markdown yoluna düşer.
 */
async function yapilandirilmisPlanUret(
  prompt: string,
  semaMetni: string
): Promise<{ plan: TripPlanStructured; model: string } | null> {
  const jsonSchema = tripPlanJsonSchema();
  const models = openRouterModels();

  const stratejiler: Array<{
    ad: string;
    responseFormat?: Record<string, unknown>;
    requireParameters?: boolean;
  }> = [
    {
      ad: "json_schema",
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "seyahat_plani", strict: true, schema: jsonSchema },
      },
      requireParameters: true,
    },
    { ad: "json_object", responseFormat: { type: "json_object" } },
    { ad: "duz_prompt" },
  ];

  let onarimHakki = 1;

  for (const model of models) {
    for (const strateji of stratejiler) {
      const messages = [
        {
          role: "system" as const,
          content:
            `${SISTEM_MESAJI}\n\nYanıtını YALNIZCA aşağıdaki JSON şemasına uyan tek bir ` +
            `JSON nesnesi olarak ver. Açıklama, markdown çiti veya ek metin ekleme. ` +
            `Tüm alanlar zorunludur; bilgi yoksa boş string ya da 0 kullan. ` +
            `Tutarlar Türk Lirası cinsinden sayı olmalıdır.\n\n${semaMetni}`,
        },
        { role: "user" as const, content: prompt },
      ];

      const sonuc = await chatCompletion({
        model,
        messages,
        responseFormat: strateji.responseFormat,
        requireParameters: strateji.requireParameters,
      });

      if (!sonuc.ok) {
        logger.warn("Yapılandırılmış çıktı denemesi başarısız", undefined, {
          model,
          strateji: strateji.ad,
          status: sonuc.status,
          detay: sonuc.detay,
        });
        continue;
      }

      if (sonuc.finishReason === "length") {
        // Kesilmiş JSON ayrıştırılamaz; bir sonraki stratejiye geç.
        logger.warn("Yanıt token sınırında kesildi", undefined, { model, strateji: strateji.ad });
        continue;
      }

      const dogrulanan = jsonuDogrula(sonuc.content);
      if (dogrulanan.plan) {
        logger.debug("Yapılandırılmış plan üretildi", { model, strateji: strateji.ad });
        return { plan: dogrulanan.plan, model };
      }

      logger.warn("Yapılandırılmış çıktı doğrulanamadı", undefined, {
        model,
        strateji: strateji.ad,
        hata: dogrulanan.hata,
      });

      // Şema hatasını modele geri verip bir kez onarım iste.
      if (onarimHakki > 0) {
        onarimHakki -= 1;

        const onarim = await chatCompletion({
          model,
          messages: [
            ...messages,
            { role: "assistant" as const, content: sonuc.content.slice(0, 20000) },
            {
              role: "user" as const,
              content:
                `Önceki yanıt şemaya uymuyor. Hata: ${dogrulanan.hata}\n` +
                `Lütfen aynı planı, şemaya birebir uyan tek bir JSON nesnesi olarak tekrar üret.`,
            },
          ],
          responseFormat: strateji.responseFormat,
          requireParameters: strateji.requireParameters,
        });

        if (onarim.ok && onarim.finishReason !== "length") {
          const onarilan = jsonuDogrula(onarim.content);
          if (onarilan.plan) {
            logger.debug("Onarım turu başarılı", { model, strateji: strateji.ad });
            return { plan: onarilan.plan, model };
          }
          logger.warn("Onarım turu da doğrulanamadı", undefined, { hata: onarilan.hata });
        }
      }
    }
  }

  return null;
}

function jsonuDogrula(content: string): { plan: TripPlanStructured | null; hata: string } {
  const ham = extractJsonObject(content);
  if (ham === null) {
    return { plan: null, hata: "Yanıt içinde geçerli bir JSON nesnesi bulunamadı" };
  }

  const parsed = tripPlanStructuredSchema.safeParse(ham);
  if (!parsed.success) {
    const hata = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(kök)"}: ${issue.message}`)
      .join("; ");
    return { plan: null, hata };
  }

  return { plan: parsed.data, hata: "" };
}

/** Eski (markdown) yol: model JSON üretemediğinde devreye giriyor. */
async function markdownPlanUret(prompt: string): Promise<{ markdown: string; model: string } | null> {
  for (const model of openRouterModels()) {
    const sonuc = await chatCompletion({
      model,
      messages: [
        {
          role: "system",
          content: `${SISTEM_MESAJI} Yanıtlarını Markdown formatında, düzenli ve okunaklı şekilde hazırlarsın.`,
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 10000,
    });

    if (sonuc.ok) {
      return { markdown: sonuc.content, model };
    }

    logger.warn("Markdown yolu başarısız", undefined, {
      model,
      status: sonuc.status,
      detay: sonuc.detay,
    });
  }

  return null;
}

/** Markdown'ı sanitize edilmiş HTML'e çevirir. */
async function markdownToHtml(markdown: string): Promise<string> {
  // marked ham HTML'i escape etmez; model çıktısı güvenilmez girdidir.
  try {
    const markdownResult = marked.parse(markdown);
    const rawHtml = typeof markdownResult === "string" ? markdownResult : await markdownResult;
    return sanitizeHtml(rawHtml);
  } catch (markdownError) {
    logger.warn("Markdown dönüştürülemedi", markdownError);
    return sanitizeHtml(`<pre>${markdown}</pre>`);
  }
}

// Ana POST handler
export async function POST(request: NextRequest) {
  try {
    // Bu endpoint ücretli bir LLM çağrısı yapıyor: önce kimlik, sonra kota.
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Plan oluşturmak için giriş yapmanız gerekiyor" },
        { status: 401 }
      );
    }

    const quota = rateLimit(`trip-plan:${session.user.email}`, 5, 60 * 60 * 1000);
    if (!quota.success) {
      return NextResponse.json(
        {
          error: `Saatlik plan oluşturma limitine ulaştınız. ${Math.ceil(
            quota.retryAfter / 60
          )} dakika sonra tekrar deneyin.`,
        },
        { status: 429, headers: { "Retry-After": String(quota.retryAfter) } }
      );
    }

    // İstek gövdesini al ve doğrula
    const parsed = planRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz istek" },
        { status: 400 }
      );
    }

    const {
      city,
      country,
      startDate,
      endDate,
      budget,
      transportation,
      interests,
      travelStyle,
      accommodation,
      specialRequirements,
    } = parsed.data;

    // Tarih doğrulaması
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "Geçersiz tarih formatı" },
          { status: 400 }
        );
      }

      if (end < start) {
        return NextResponse.json(
          { error: "Bitiş tarihi başlangıç tarihinden önce olamaz" },
          { status: 400 }
        );
      }
    }

    // Şema hem dizi hem virgüllü metin kabul ediyor; buradan sonrası dizi.
    const toList = (value: string[] | string | undefined): string[] =>
      Array.isArray(value)
        ? value.map((v) => v.trim()).filter(Boolean)
        : typeof value === "string"
        ? value.split(",").map((v) => v.trim()).filter(Boolean)
        : [];

    const interestList = toList(interests);
    const transportationList = toList(transportation);

    // Seyahat süresi hesaplama
    let durationText = "";
    let gunSayisi = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      // Gidiş ve dönüş aynı gün ise 1 gün olarak hesapla
      gunSayisi = daysDiff === 0 ? 1 : daysDiff;
      durationText = `${gunSayisi} gün`;
    }

    const tercihler = tercihMetni({
      interestList,
      travelStyle,
      budget,
      accommodation,
      transportationList,
      specialRequirements,
    });

    const hedef = `${city.trim()}${country?.trim() ? `, ${country.trim()}` : ""}`;
    const tarihAraligi = startDate
      ? `${startDate} ile ${endDate} tarihleri arasında (${durationText})`
      : "esnek tarihlerde";

    // Yapılandırılmış yol için prompt
    const yapilandirilmisPrompt = `
${hedef} için ${tarihAraligi} detaylı bir seyahat planı hazırla.

Tercihler:
${tercihler}

Kurallar:
- ${gunSayisi > 0 ? `Tam olarak ${gunSayisi} gün` : "3 gün"} planla; "days" dizisi bu kadar eleman içersin.
- Her gün için sabah, öğleden sonra ve akşam aktivitelerini ayrı aktiviteler olarak ver.
- Aktivite saatlerini "09:00" biçiminde yaz.
- Tüm tutarlar Türk Lirası cinsinden sayı olsun (para birimi sembolü yazma).
- "budget.total" kategori toplamlarının toplamına eşit olsun.
- "budget.dailyAverage" toplamın gün sayısına bölümü olsun.
`.trim();

    // Eski markdown yolu için prompt (geriye düşüş)
    const markdownPrompt = `
${hedef} için ${tarihAraligi} detaylı bir seyahat planı oluştur.

Tercihler:
${tercihler}

Lütfen şu konuları içeren kapsamlı bir plan hazırla:

1. **Şehir Hakkında Genel Bilgi**
2. **Günlük Detaylı Program** (her gün için sabah, öğlen, akşam)
3. **Yeme-İçme Rehberi**
4. **Pratik Bilgiler**
5. **Bütçe Tahmini** (kalemler ve toplam tahmini harcama)

Lütfen Markdown formatında, düzenli başlıklar ve listeler kullanarak yanıt ver.
`.trim();

    const semaMetni = JSON.stringify(tripPlanJsonSchema());

    // 1) Önce yapılandırılmış (JSON + Zod) yol.
    const structuredResult = await yapilandirilmisPlanUret(yapilandirilmisPrompt, semaMetni);

    let kolonlar: PlanKolonlari;
    let markdownContent: string;
    let kullanilanModel: string;
    let structured: TripPlanStructured | null = null;
    let planFormat: "structured" | "markdown";

    if (structuredResult) {
      structured = structuredResult.plan;
      kullanilanModel = structuredResult.model;
      planFormat = "structured";

      const serilestirilmis = serializeStructuredPlan(structured, { startDate, endDate });
      kolonlar = serilestirilmis;
      markdownContent = serilestirilmis.raw_markdown;
    } else {
      // 2) Geriye düşüş: eski markdown yolu + eski ayrıştırıcı.
      logger.warn("Yapılandırılmış çıktı alınamadı, markdown yoluna düşülüyor");
      const markdownResult = await markdownPlanUret(markdownPrompt);

      if (!markdownResult) {
        return NextResponse.json(
          { error: "AI seyahat planı oluşturulurken hata oluştu" },
          { status: 502 }
        );
      }

      kullanilanModel = markdownResult.model;
      markdownContent = markdownResult.markdown;
      planFormat = "markdown";

      const sections = parseTripPlanSections(markdownContent);
      const budgetInfo = extractBudgetInfo(sections.butce_tahmini || markdownContent);

      kolonlar = {
        ...sections,
        raw_markdown: markdownContent,
        total_cost: budgetInfo.totalCost,
        daily_cost: budgetInfo.dailyCost,
      };
    }

    logger.debug("Seyahat planı oluşturuldu", {
      format: planFormat,
      uzunluk: markdownContent.length,
    });

    const htmlContent = await markdownToHtml(markdownContent);

    // Veritabanına kaydet
    const savedTripPlan = await saveTripPlanToDatabase(
      {
        city: city.trim(),
        country: country?.trim(),
        startDate,
        endDate,
        budget,
        interests: interestList,
        travelStyle,
        accommodation,
        transportation: transportationList,
        duration: durationText,
      },
      kolonlar,
      htmlContent,
      kullanilanModel,
      structured
    );

    // Başarılı yanıt döndür.
    // DİKKAT: markdown / html / city / tripPlanId / metadata alanlarının şekli
    // istemci sözleşmesidir; değiştirilmemeli. Yeni alanlar eklenebilir.
    return NextResponse.json({
      success: true,
      plan: {
        markdown: markdownContent,
        html: htmlContent,
        city: city.trim(),
        country: country?.trim() || "",
        startDate: startDate || null,
        endDate: endDate || null,
        duration: durationText || null,
        tripPlanId: savedTripPlan?.id,
        // Yeni alanlar (geriye uyumlu ek):
        format: planFormat,
        structured: structured,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: kullanilanModel,
          savedToDatabase: !!savedTripPlan,
          schemaVersion: structured ? TRIP_PLAN_SCHEMA_VERSION : null,
        },
      },
    });

  } catch (error: unknown) {
    // Ayrıntı log'a; istemciye yalnızca genel mesaj (stack trace sızdırma).
    logger.error("Seyahat planı oluşturulamadı", error);

    return NextResponse.json(
      { error: "Seyahat planı oluşturulurken beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}
