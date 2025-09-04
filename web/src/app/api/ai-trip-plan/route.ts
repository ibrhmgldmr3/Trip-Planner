import { NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // �stek g�vdesini al
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

    // Seyahat Süresi hesapla
    let durationText = "";
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      // Gidi� ve Dön�� ayn� Gün ise 1 Gün olarak hesapla
      const duration = daysDiff === 0 ? 1 : daysDiff;
      durationText = `${duration} Gün Süreli`;
    }

    // OpenAI'a Günderilecek sorguyu oluştur
    const prompt = `�u detaylara uygun detayl� bir seyahat plan� oluştur:
    
Şehir: ${city}
${country ? `Ülke: ${country}` : ''}
${startDate ? `Başlangıç Tarihi: ${startDate}` : ''}
${endDate ? `Bitiş Tarihi: ${endDate}` : ''}
${durationText ? `Süre: ${durationText}` : ''}
${budget ? `Bütçe: ${budget} TL` : ''}
${transportation && transportation.length > 0 ? `Ulaşım Tercihleri: ${transportation.join(', ')}` : ''}
${interests && interests.length > 0 ? `İlgi Alanları: ${interests.join(', ')}` : ''}
${notes ? `Ek Notlar: ${notes}` : ''}

Lütfen Şunları i�eren kapsaml� bir seyahat plan� oluştur:
1. Günlük detayl� bir program (sabah, öğle, akşam aktiviteleri)
2. Ziyaret edilecek �nemli yerler ve tarihi/k�lt�rel mekanlar
3. Tavsiye edilen restoranlar ve yeme-i�me noktalar�
4. Tahmini Bütçe d�k�m� ve maliyetler
5. Şehir i�i Ulaşım Önerileri
6. Konaklama Önerileri
7. Yerel etkinlikler ve festivaller (varsa belirtilen tarihlerde)
8. Seyahat için ipu�lar� ve Öneriler

Lütfen yanıt� markdown format�nda, b�l�mlere ayr�lm��, Günlere g�re düzenlenmi� �ekilde ver. Her Gün için ba�l�k kullan.`;

    // OpenAI API'sine istek Günder
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        { role: "system", content: "Sen uzman bir seyahat danışmanısın. Türkçe konuşuyorsun ve T�rkiye'deki ve Dönyadaki turistik yerler hakkında derin bilgiye sahipsin." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 10000,
    });
    console.log("OpenAI Response:", completion);
    // API yanıt�n� al
    const response = completion.choices[0].message.content;

    // başarılı yanıt Dönd�r
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
    const errorMessage = error instanceof Error ? error.message : "Seyahat plan� oluşturulurken bir Hata oluştu";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


