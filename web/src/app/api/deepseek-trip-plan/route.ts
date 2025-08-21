import { NextRequest, NextResponse } from "next/server";
import { marked } from "marked";
import { env } from "@/env";

export async function POST(request: NextRequest) {
  try {
    // İstek gövdesini al
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

    // Gerekli verileri kontrol et
    if (!city) {
      return NextResponse.json(
        { error: "Şehir bilgisi gereklidir" },
        { status: 400 }
      );
    }

    // Tarihleri kontrol et
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

    // Seyahat süresi hesapla
    let tripDuration = 0;
    let durationText = "";
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      tripDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      durationText = `${tripDuration} gün`;
    }

    // OpenRouter'a gönderilecek sorguyu oluştur
    const prompt = `
    Benim için ${city}, ${country || ''} için ${startDate ? `${startDate} ile ${endDate} tarihleri arasında (${durationText})` : ''} bir seyahat planı oluştur.

    ${interests && interests.length > 0 ? `İlgi alanlarım: ${interests.join(', ')}` : 'İlgi alanlarım: Genel turistik yerler'}
    ${travelStyle ? `Seyahat tarzım: ${travelStyle}` : 'Seyahat tarzım: Standart'}
    ${budget ? `Bütçem: ${budget}` : 'Bütçem: Orta'}
    ${accommodation ? `Konaklama tercihi: ${accommodation}` : 'Konaklama tercihi: Otel'}
    ${transportation && transportation.length > 0 ? `Ulaşım tercihi: ${transportation.join(', ')}` : 'Ulaşım tercihi: Toplu taşıma'}
    ${specialRequirements ? `Özel gereksinimler/notlar: ${specialRequirements}` : 'Özel gereksinimler/notlar: Yok'}

    Lütfen şu şekilde bir plan oluştur:
    1. Şehir ve ülke hakkında kısa bir giriş paragrafı
    2. Şehir hakkında temel bilgiler (nüfus, iklim, para birimi, en iyi ziyaret zamanı)
    3. Her gün için ayrıntılı plan (sabah, öğlen, akşam aktiviteleri)
    4. Popüler yeme-içme önerileri ve yerel lezzetler
    5. Güvenlik ipuçları ve dikkat edilmesi gerekenler
    6. Tahmini toplam bütçe (konaklama, yemek, aktiviteler ve ulaşım dahil)
    
    Lütfen Markdown formatında yanıt ver ve başlıklar için uygun başlık seviyelerini kullan. Günlük planlar için düzenli listeler kullan.
    `;

    // API isteği detaylarını loglama
    console.log("Sending request to OpenRouter API");
    console.log("API Key:", env.OPENROUTER_API_KEY ? "API anahtarı mevcut" : "API anahtarı eksik");
    
    // OpenRouter API'sine istek gönder
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
            content: "Sen profesyonel bir seyahat danışmanısın. Verilen bilgilere göre kapsamlı ve kişiselleştirilmiş seyahat planları oluşturursun. Türkçe konuşuyorsun ve Türkiye'deki ve dünyadaki turistik yerler hakkında derin bilgiye sahipsin." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      })
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json();
      console.error("OpenRouter API Error:", errorData);
      console.error("Status:", openRouterResponse.status);
      console.error("Status Text:", openRouterResponse.statusText);
      
      return NextResponse.json(
        { 
          error: "DeepSeek AI ile seyahat planı oluşturulurken bir hata oluştu", 
          details: errorData 
        },
        { status: openRouterResponse.status }
      );
    }

    // API yanıtını al
    const data = await openRouterResponse.json();
    const planText = data.choices[0].message.content;

    // Markdown'ı HTML'e dönüştür
    const htmlContent = marked.parse(planText);

    // Başarılı yanıt döndür
    return NextResponse.json({ 
      plan: {
        markdown: planText,
        html: htmlContent,
        city,
        country: country || "",
        startDate: startDate || null,
        endDate: endDate || null,
        duration: durationText || null
      }
    });
  } catch (error: unknown) {
    console.error("DeepSeek Trip Plan Error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Seyahat planı oluşturulurken bir hata oluştu";
    
    const errorDetails = error instanceof Error 
      ? { name: error.name, stack: error.stack }
      : { unknown: "Unknown error type" };
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: errorDetails
      },
      { status: 500 }
    );
  }
}
