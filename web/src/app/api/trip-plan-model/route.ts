import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { z } from "zod";
import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/sanitize";

const MODEL = "deepseek/deepseek-r1-0528-qwen3-8b:free";

/**
 * İstek gövdesi şeması. Uzunluk sınırları hem prompt injection yüzeyini
 * hem de token maliyetini sınırlamak için var.
 */
const planRequestSchema = z.object({
  city: z.string().trim().min(1, "Şehir bilgisi gereklidir").max(80),
  country: z.string().trim().max(80).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  budget: z.string().max(60).optional(),
  transportation: z.union([z.array(z.string().max(60)).max(20), z.string().max(300)]).optional(),
  interests: z.union([z.array(z.string().max(60)).max(20), z.string().max(300)]).optional(),
  travelStyle: z.string().max(60).optional(),
  accommodation: z.string().max(60).optional(),
  specialRequirements: z.string().max(500).optional(),
});


// LLM yanıtını bölümlere ayırma fonksiyonu
function parseTripPlanSections(markdownContent: string) {
  const sections = {
    sehir_bilgisi: '',
    gun_plani: '',
    yemek_rehberi: '',
    pratik_bilgiler: '',
    butce_tahmini: ''
  };

  // Markdown'ı satırlara böl
  const lines = markdownContent.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];
  
  // Günlük planları biriktirmek için özel array
  const gunPlaniSections: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Başlık kontrolü - hangi bölümde olduğumuzu belirle
    if (line.startsWith('#') || line.startsWith('**')) {
      // Önceki bölümü kaydet
      if (currentSection && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        
        if (currentSection === 'gun_plani') {
          // Günlük planları biriktir (her gün ayrı ayrı)
          gunPlaniSections.push(content);
        } else {
          // Diğer bölümler normal şekilde kaydedilir
          sections[currentSection as keyof typeof sections] = content;
        }
      }
      
      // Yeni bölüm belirle
      if (lowerLine.includes('şehir') || lowerLine.includes('genel') || lowerLine.includes('hakkında') || lowerLine.includes('bilgi')) {
        currentSection = 'sehir_bilgisi';
      } else if (lowerLine.includes('gün') || lowerLine.includes('program') || lowerLine.includes('plan') || lowerLine.includes('aktivite') || lowerLine.includes('günlük')) {
        currentSection = 'gun_plani';
      } else if (lowerLine.includes('yeme') || lowerLine.includes('restoran') || lowerLine.includes('lezzet') || lowerLine.includes('yemek') || lowerLine.includes('gastron')) {
        currentSection = 'yemek_rehberi';
      } else if (lowerLine.includes('pratik') || lowerLine.includes('ulaşım') || lowerLine.includes('güvenlik') || lowerLine.includes('ipuçları') || lowerLine.includes('bilgi')) {
        currentSection = 'pratik_bilgiler';
      } else if (lowerLine.includes('bütçe') || lowerLine.includes('maliyet') || lowerLine.includes('fiyat') || lowerLine.includes('harcama')) {
        currentSection = 'butce_tahmini';
      } else {
        // Genel bilgi olarak kabul et
        if (!currentSection) currentSection = 'sehir_bilgisi';
      }
      
      currentContent = [line];
    } else {
      // İçerik satırı
      currentContent.push(line);
    }
  }

  // Son bölümü kaydet
  if (currentSection && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    
    if (currentSection === 'gun_plani') {
      gunPlaniSections.push(content);
    } else {
      sections[currentSection as keyof typeof sections] = content;
    }
  }

  // Tüm günlük planları birleştir
  if (gunPlaniSections.length > 0) {
    sections.gun_plani = gunPlaniSections.join('\n\n---\n\n');
  }

  return sections;
}

// Bütçe bilgisini çıkartma fonksiyonu
function extractBudgetInfo(content: string) {
  let totalCost = 0;
  let dailyCost = 0;

  // Türk Lirası formatındaki sayıları bul (?, TL, lira)
  const turkishLiraRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*[?TL]/gi;
  const matches = content.match(turkishLiraRegex);
  
  if (matches) {
    const amounts = matches.map(match => {
      const numberStr = match.replace(/[?TL\s]/g, '').replace(/\./g, '').replace(',', '.');
      return parseFloat(numberStr) || 0;
    });
    
    // En büyük tutarı toplam maliyet olarak al
    totalCost = Math.max(...amounts, 0);
    
    // Günlük ortalama hesapla (eğer "günlük" veya "gün" kelimesi varsa)
    if (content.toLowerCase().includes('günlük') || content.toLowerCase().includes('gün')) {
      const dailyAmounts = amounts.filter((_, index) => {
        const context = matches![index].toLowerCase();
        return context.includes('günlük') || context.includes('gün');
      });
      if (dailyAmounts.length > 0) {
        dailyCost = Math.max(...dailyAmounts, 0);
      }
    }
  }

  return { totalCost, dailyCost };
}

// Veritabanına kaydetme fonksiyonu
async function saveTripPlanToDatabase(
  planData: {
    city: string;
    country?: string;
    duration?: string;
  },
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
  },
  markdownContent: string,
  htmlContent: string,
  model: string
) {
  try {
    const sections = parseTripPlanSections(markdownContent);
    const budgetInfo = extractBudgetInfo(sections.butce_tahmini || markdownContent);

    // Debug: Günlük plan içeriğini kontrol et
    console.log("?? Günlük plan uzunluğu:", sections.gun_plani?.length || 0);
    console.log("?? Günlük plan önizleme:", sections.gun_plani?.substring(0, 200) + "...");
    
    // Get session bilgisini al
    let userId = null;
    let userEmail = null;
    
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        userId = session.user.id || null;
        userEmail = session.user.email || null;
        console.log("? Session bulundu:", { userId, userEmail });
      } else {
        console.log("?? Session bulunamadı - anonim kullanıcı");
      }
    } catch (sessionError) {
      console.error("? Session alma hatası:", sessionError);
    }

    const tripPlan = await prisma.tripPlan.create({
      data: {
      city: formData.city.trim(),
      country: formData.country?.trim() || null,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      duration: planData.duration || null,
      
      // Bölümler
      sehir_bilgisi: sections.sehir_bilgisi || null,
      gun_plani: sections.gun_plani || null,
      yemek_rehberi: sections.yemek_rehberi || null,
      pratik_bilgiler: sections.pratik_bilgiler || null,
      butce_tahmini: sections.butce_tahmini || null,
      
      // Raw data
      raw_markdown: markdownContent,
      raw_html: htmlContent,
      
      // Metadata
      ai_model: model,
      
      // İstatistikler
      total_cost: budgetInfo.totalCost || null,
      daily_cost: budgetInfo.dailyCost || null,
      
      // Tercihler
      interests: formData.interests ? JSON.stringify(formData.interests) : null,
      budget_level: formData.budget || null,
      travel_style: formData.travelStyle || null,
      accommodation: formData.accommodation || null,
      transportation: formData.transportation ? JSON.stringify(formData.transportation) : null,
      
      // Kullanıcı bilgileri - hem ID hem email ile ilişki kur
      user_id: userId || null,
      userEmail: userEmail || null,
      }
    });

    console.log("? Plan veritabanına kaydedildi:", tripPlan.id);
    return tripPlan;
  } catch (error) {
    console.error("? Veritabanı kaydetme hatası:", error);
    return null;
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
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      // Gidiş ve dönüş aynı gün ise 1 gün olarak hesapla
      const tripDuration = daysDiff === 0 ? 1 : daysDiff;
      durationText = `${tripDuration} gün`;
    }

    // AI prompt oluşturma
    const prompt = `
Benim için ${city.trim()}, ${country?.trim() || ''} için ${startDate ? `${startDate} ile ${endDate} tarihleri arasında (${durationText})` : ''} detaylı bir seyahat planı oluştur.

?? Tercihlerim:
${interestList.length > 0 ? `• İlgi alanlarım: ${interestList.join(', ')}` : '• İlgi alanlarım: Genel turistik yerler'}
${travelStyle ? `• Seyahat tarzım: ${travelStyle}` : '• Seyahat tarzım: Standart'}
${budget ? `• Bütçem: ${budget}` : '• Bütçem: Orta'}
${accommodation ? `• Konaklama tercihi: ${accommodation}` : '• Konaklama tercihi: Otel'}
${transportationList.length > 0 ? `• Ulaşım tercihi: ${transportationList.join(', ')}` : '• Ulaşım tercihi: Toplu taşıma'}
${specialRequirements ? `• Özel gereksinimler: ${specialRequirements}` : '• Özel gereksinimler: Yok'}

?? Lütfen şu konuları içeren kapsamlı bir plan hazırla:

1. **Şehir Hakkında Genel Bilgi**
   - Kısa tanıtım
   - Nüfus, iklim, para birimi
   - En iyi ziyaret zamanı

2. **Günlük Detaylı Program**
   - Her gün için sabah, öğlen, akşam aktiviteleri
   - Gezilecek yerler ve öneriler
   - Tahmini süre bilgileri

3. **Yeme-İçme Rehberi**
   - Popüler restoranlar
   - Yerel lezzetler
   - Bütçe dostu seçenekler

4. **Pratik Bilgiler**
   - Ulaşım önerileri
   - Güvenlik ipuçları
   - Önemli notlar

5. **Bütçe Tahmini**
   - Konaklama, yemek, aktiviteler
   - Ulaşım maliyetleri
   - Toplam tahmini harcama

Lütfen Markdown formatında, düzenli başlıklar ve listeler kullanarak yanıt ver.
`;

    console.log(`OpenRouter isteği gönderiliyor (model: ${MODEL})`);

    // OpenRouter API çağrısı
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": env.APP_URL ?? "http://localhost:3000",
        "X-Title": "Trip Planner App"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { 
            role: "system", 
            content: "Sen uzman bir seyahat danışmanısın. Verilen bilgilere göre kapsamlı, kişiselleştirilmiş ve pratik seyahat planları hazırlarsın. Türkçe konuşuyorsun ve dünya genelindeki turistik destinasyonlar hakkında derin bilgiye sahipsin. Yanıtlarını Markdown formatında, düzenli ve okunaklı şekilde hazırlarsın." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        temperature: 0.4,
        max_tokens: 10000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    // Yanıt içeriğini al
    let responseText = '';
    try {
      responseText = await openRouterResponse.text();
    } catch (error) {
      console.error("OpenRouter yanıtı okunamadı:", error);
      return NextResponse.json(
        { error: "AI servisinden yanıt alınamadı" },
        { status: 502 }
      );
    }

    const contentType = openRouterResponse.headers.get('content-type') || '';

    // Aşağıdaki hata dallarının ortak kuralı: ayrıntı yalnızca sunucu
    // log'una yazılır, istemciye genel bir mesaj döner. Ham yanıt gövdesi
    // sağlayıcı anahtarı/kota bilgisi içerebilir.
    if (!openRouterResponse.ok) {
      console.error("OpenRouter API hatası:", {
        status: openRouterResponse.status,
        contentType,
        body: responseText.slice(0, 1000),
      });

      const status = openRouterResponse.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "AI servisi şu an yoğun, birkaç dakika sonra tekrar deneyin"
              : "AI seyahat planı oluşturulurken hata oluştu",
        },
        { status }
      );
    }

    if (!contentType.includes('application/json')) {
      console.error("OpenRouter beklenmeyen içerik tipi:", contentType, responseText.slice(0, 1000));
      return NextResponse.json(
        { error: "AI servisinden beklenmeyen yanıt alındı" },
        { status: 502 }
      );
    }

    let apiData;
    try {
      apiData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("OpenRouter JSON ayrıştırma hatası:", parseError, responseText.slice(0, 1000));
      return NextResponse.json(
        { error: "AI servisinden beklenmeyen yanıt alındı" },
        { status: 502 }
      );
    }

    // Yanıt yapısı kontrolü
    const planText: unknown = apiData?.choices?.[0]?.message?.content;
    if (typeof planText !== "string" || planText.trim().length === 0) {
      console.error("OpenRouter beklenmeyen yanıt yapısı:", JSON.stringify(apiData).slice(0, 1000));
      return NextResponse.json(
        { error: "AI servisinden beklenmeyen yanıt alındı" },
        { status: 502 }
      );
    }

    console.log("Seyahat planı oluşturuldu, uzunluk:", planText.length);

    // Markdown'ı HTML'e dönüştür ve sanitize et.
    // marked ham HTML'i escape etmez; model çıktısı güvenilmez girdidir.
    let htmlContent: string;
    try {
      const markdownResult = marked.parse(planText);
      const rawHtml = typeof markdownResult === 'string' ? markdownResult : await markdownResult;
      htmlContent = sanitizeHtml(rawHtml);
    } catch (markdownError) {
      console.warn("Markdown dönüştürme hatası:", markdownError);
      htmlContent = sanitizeHtml(`<pre>${planText}</pre>`);
    }

    // Veritabanına kaydet
    const savedTripPlan = await saveTripPlanToDatabase(
      {
        city: city.trim(),
        country: country?.trim(),
        duration: durationText,
      },
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
      },
      planText,
      htmlContent,
      MODEL
    );

    console.log("Veritabanı kaydı:", savedTripPlan ? "başarılı" : "başarısız");

    // Başarılı yanıt döndür
    return NextResponse.json({
      success: true,
      plan: {
        markdown: planText,
        html: htmlContent,
        city: city.trim(),
        country: country?.trim() || "",
        startDate: startDate || null,
        endDate: endDate || null,
        duration: durationText || null,
        tripPlanId: savedTripPlan?.id,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: MODEL,
          savedToDatabase: !!savedTripPlan
        }
      }
    });

  } catch (error: unknown) {
    // Ayrıntı log'a; istemciye yalnızca genel mesaj (stack trace sızdırma).
    console.error("Trip plan oluşturma hatası:", error);

    return NextResponse.json(
      { error: "Seyahat planı oluşturulurken beklenmeyen bir hata oluştu" },
      { status: 500 }
    );
  }
}

