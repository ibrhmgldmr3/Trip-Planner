import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { env } from "@/env";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

const prisma = new PrismaClient();

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

// Yanıt kaydetme yardımcı fonksiyonu
function saveResponseToFile(content: string, type: 'success' | 'error' | 'html', city?: string): string | null {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedCity = city?.replace(/[^a-zA-Z0-9]/g, '') || 'unknown';
    const filename = `openrouter-response-${type}-${sanitizedCity}-${timestamp}.txt`;
    const logsDir = join(process.cwd(), 'logs');
    const filepath = join(logsDir, filename);
    
    // Logs klasörünü oluştur
    try {
      mkdirSync(logsDir, { recursive: true });
    } catch {
      // Klasör zaten var
    }
    
    writeFileSync(filepath, content, 'utf8');
    console.log(`?? Yanıt dosyaya kaydedildi: ${filename}`);
    return filename;
  } catch (error) {
    console.error('? Dosyaya kaydetme hatası:', error);
    return null;
  }
}

// Ana POST handler
export async function POST(request: NextRequest) {
  try {
    console.log("?? Trip Plan API çağrısı başlatıldı");
    
    // İstek gövdesini al ve doğrula
    const body = await request.json();
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
      specialRequirements 
    } = body;

    // Debug: Gelen verilerin tiplerini kontrol et
    console.log("?? Gelen veri tipleri:", {
      interests: { type: typeof interests, isArray: Array.isArray(interests), value: interests },
      transportation: { type: typeof transportation, isArray: Array.isArray(transportation), value: transportation }
    });

    // Şehir kontrolü
    if (!city || typeof city !== 'string' || city.trim().length === 0) {
      return NextResponse.json(
        { error: "Şehir bilgisi gereklidir" },
        { status: 400 }
      );
    }

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
${interests && interests.length > 0 ? `• İlgi alanlarım: ${interests.join(', ')}` : '• İlgi alanlarım: Genel turistik yerler'}
${travelStyle ? `• Seyahat tarzım: ${travelStyle}` : '• Seyahat tarzım: Standart'}
${budget ? `• Bütçem: ${budget}` : '• Bütçem: Orta'}
${accommodation ? `• Konaklama tercihi: ${accommodation}` : '• Konaklama tercihi: Otel'}
${transportation && transportation.length > 0 ? `• Ulaşım tercihi: ${transportation.join(', ')}` : '• Ulaşım tercihi: Toplu taşıma'}
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

    console.log("?? OpenRouter API'sine istek gönderiliyor...");
    console.log("?? API Key:", env.OPENROUTER_API_KEY ? "? Mevcut" : "? Eksik");
    console.log("?? API URL:", "https://openrouter.ai/api/v1/chat/completions");
    console.log("?? Model:", "openai/gpt-oss-20b:free");
    console.log("??? Şehir:", city);

    // OpenRouter API çağrısı
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "Trip Planner App"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
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

    console.log("?? API Yanıtı alındı - Status:", openRouterResponse.status);

    // Yanıt içeriğini al
    let responseText = '';
    try {
      responseText = await openRouterResponse.text();
    } catch (error) {
      console.error("? Yanıt okuma hatası:", error);
      return NextResponse.json(
        { 
          error: "API yanıtı okunamadı",
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        { status: 500 }
      );
    }

    // Content-Type kontrolü
    const contentType = openRouterResponse.headers.get('content-type') || '';
    console.log("?? Content-Type:", contentType);

    // Yanıtı dosyaya kaydet
    const savedFile = saveResponseToFile(
      `HTTP Status: ${openRouterResponse.status} ${openRouterResponse.statusText}\n` +
      `Content-Type: ${contentType}\n` +
      `Request Details:\n` +
      `  - City: ${city}\n` +
      `  - Country: ${country || 'N/A'}\n` +
      `  - Date Range: ${startDate || 'N/A'} - ${endDate || 'N/A'}\n` +
      `  - Interests: ${interests?.join(', ') || 'N/A'}\n` +
      `  - Budget: ${budget || 'N/A'}\n\n` +
      `Raw Response:\n` +
      `${responseText}`,
      contentType.includes('application/json') ? 'success' : 'html',
      city
    );

    // Başarısız yanıt kontrolü
    if (!openRouterResponse.ok) {
      let errorData;
      
      if (contentType.includes('application/json')) {
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { 
            error: "API JSON döndürmedi ancak JSON Content-Type belirtti",
            rawResponse: responseText.substring(0, 500) 
          };
        }
      } else {
        errorData = {
          error: "API başarısız HTTP status döndürdü",
          contentType,
          statusCode: openRouterResponse.status,
          statusText: openRouterResponse.statusText,
          responsePreview: responseText.substring(0, 500)
        };
      }

      console.error("? OpenRouter API Hatası:", errorData);
      
      return NextResponse.json(
        { 
          error: "AI seyahat planı oluşturulurken hata oluştu", 
          details: {
            ...errorData,
            savedToFile: savedFile
          }
        },
        { status: openRouterResponse.status }
      );
    }

    // JSON parse kontrolü
    if (!contentType.includes('application/json')) {
      console.error("? API JSON döndürmedi, Content-Type:", contentType);
      
      return NextResponse.json(
        { 
          error: "API beklenmeyen yanıt formatı döndürdü",
          details: {
            contentType,
            responsePreview: responseText.substring(0, 500),
            fullLength: responseText.length,
            savedToFile: savedFile
          }
        },
        { status: 500 }
      );
    }

    // JSON ayrıştırma
    let apiData;
    try {
      apiData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("? JSON ayrıştırma hatası:", parseError);
      
      return NextResponse.json(
        { 
          error: "API yanıtı geçersiz JSON formatında",
          details: {
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            responsePreview: responseText.substring(0, 500),
            savedToFile: savedFile
          }
        },
        { status: 500 }
      );
    }

    // Yanıt yapısı kontrolü
    if (!apiData.choices || !apiData.choices[0] || !apiData.choices[0].message || !apiData.choices[0].message.content) {
      console.error("? API yanıt yapısı beklenmeyen:", apiData);
      
      return NextResponse.json(
        { 
          error: "API beklenmeyen yanıt yapısı döndürdü",
          details: {
            receivedData: apiData,
            savedToFile: savedFile
          }
        },
        { status: 500 }
      );
    }

    const planText = apiData.choices[0].message.content;
    console.log("? Seyahat planı başarıyla oluşturuldu, uzunluk:", planText.length);

    // Markdown'ı HTML'e dönüştür
    let htmlContent: string;
    try {
      const markdownResult = marked.parse(planText);
      htmlContent = typeof markdownResult === 'string' ? markdownResult : await markdownResult;
    } catch (markdownError) {
      console.warn("?? Markdown dönüştürme hatası:", markdownError);
      htmlContent = `<pre>${planText}</pre>`;
    }

    // Veritabanına kaydet
    const savedTripPlan = await saveTripPlanToDatabase(
      { 
      city: city.trim(),
      country: country?.trim(),
      duration: durationText
      },
      {
      city: city.trim(),
      country: country?.trim(),
      startDate,
      endDate,
      budget,
      interests: Array.isArray(interests) 
        ? interests.map((i: string) => i.trim()) 
        : typeof interests === 'string' 
        ? interests.split(',').map((i: string) => i.trim()) 
        : [],
      travelStyle,
      accommodation,
      transportation: Array.isArray(transportation) 
        ? transportation.map((t: string) => t.trim()) 
        : typeof transportation === 'string' 
        ? transportation.split(',').map((t: string) => t.trim()) 
        : []
      },
      planText,
      htmlContent,
      "openai/gpt-oss-20b:free"
    );
  

    console.log("?? Veritabanı kaydı:", savedTripPlan ? "Başarılı" : "Başarısız");

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
          model: "openai/gpt-oss-20b:free",
          savedToFile: savedFile,
          savedToDatabase: !!savedTripPlan
        }
      }
    });

  } catch (error: unknown) {
    console.error("?? Genel hata:", error);
    
    const errorDetails = error instanceof Error 
      ? { 
          name: error.name, 
          message: error.message,
          stack: error.stack 
        }
      : { 
          unknown: "Bilinmeyen hata tipi",
          value: String(error)
        };
    
    return NextResponse.json(
      { 
        error: "Seyahat planı oluşturulurken beklenmeyen bir hata oluştu",
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

