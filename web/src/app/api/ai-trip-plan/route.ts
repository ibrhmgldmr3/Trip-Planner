import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
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
      notes 
    } = body;

    // Gerekli verileri kontrol et
    if (!city) {
      return NextResponse.json(
        { error: "Şehir bilgisi gereklidir" },
        { status: 400 }
      );
    }

    // Seyahat süresi hesapla
    let durationText = "";
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      // Gidiş ve dönüş aynı gün ise 1 gün olarak hesapla
      const duration = daysDiff === 0 ? 1 : daysDiff;
      durationText = `${duration} gün süreli`;
    }

    // OpenAI'a gönderilecek sorguyu oluştur
    const prompt = `Şu detaylara uygun detaylı bir seyahat planı oluştur:
    
Şehir: ${city}
${country ? `Ülke: ${country}` : ''}
${startDate ? `Başlangıç Tarihi: ${startDate}` : ''}
${endDate ? `Bitiş Tarihi: ${endDate}` : ''}
${durationText ? `Süre: ${durationText}` : ''}
${budget ? `Bütçe: ${budget} TL` : ''}
${transportation && transportation.length > 0 ? `Ulaşım Tercihleri: ${transportation.join(', ')}` : ''}
${interests && interests.length > 0 ? `İlgi Alanları: ${interests.join(', ')}` : ''}
${notes ? `Ek Notlar: ${notes}` : ''}

Lütfen şunları içeren kapsamlı bir seyahat planı oluştur:
1. Günlük detaylı bir program (sabah, öğle, akşam aktiviteleri)
2. Ziyaret edilecek önemli yerler ve tarihi/kültürel mekanlar
3. Tavsiye edilen restoranlar ve yeme-içme noktaları
4. Tahmini bütçe dökümü ve maliyetler
5. Şehir içi ulaşım önerileri
6. Konaklama önerileri
7. Yerel etkinlikler ve festivaller (varsa belirtilen tarihlerde)
8. Seyahat için ipuçları ve öneriler

Lütfen yanıtı markdown formatında, bölümlere ayrılmış, günlere göre düzenlenmiş şekilde ver. Her gün için başlık kullan.`;

    // OpenAI API'sine istek gönder
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        { role: "system", content: "Sen uzman bir seyahat danışmanısın. Türkçe konuşuyorsun ve Türkiye'deki ve dünyadaki turistik yerler hakkında derin bilgiye sahipsin." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 10000,
    });
    console.log("OpenAI Response:", completion);
    // API yanıtını al
    const response = completion.choices[0].message.content;

    // Başarılı yanıt döndür
    return NextResponse.json({ 
      tripPlan: response,
      destination: {
        city,
        country: country || "",
      },
      dates: {
        startDate: startDate || null,
        endDate: endDate || null,
        duration: durationText || null,
      }
    });
  } catch (error) {
    console.error("AI Trip Plan Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Seyahat planı oluşturulurken bir hata oluştu";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
