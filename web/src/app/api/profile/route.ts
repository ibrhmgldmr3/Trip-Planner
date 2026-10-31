import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { gunSayisi } from "@/lib/trip-dates";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { hesapSilmeSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { rateLimitAsync } from "@/lib/rate-limit";
import { toplamlariTazele } from "@/lib/iliskisel-plan-ozeti";

/**
 * `preferences` sütununu güvenle objeye çevirir.
 *
 * Sütun `Json` tipinde ama eski satırlar JSON.stringify edilmiş METİN
 * taşıyor (profile/update eskiden öyle yazıyordu). İki biçimi de okumak
 * zorundayız; aksi halde eski profillerdeki telefon/bio/konum kayboluyor.
 */
function tercihleriCoz(value: unknown): Record<string, unknown> {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/** Serbest metin alanını güvenle string'e indirger. */
function metin(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}


export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        preferredTransport: true,
        preferredCurrency: true,
        interests: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        // E-posta doğrulama durumu (B9): profil sayfası doğrulanmamış
        // hesaplarda uyarı ve "yeniden gönder" düğmesi gösteriyor.
        emailVerified: true,
        // Hesap silme onayının ŞİFRE mi ADRES mi istediğini belirliyor.
        // Değerin kendisi değil, VARLIĞI gönderiliyor.
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    // Preferences JSON'dan ek bilgileri al
    const preferences = tercihleriCoz(user.preferences);

    // Profile objesini oluştur
    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      phone: metin(preferences.phone),
      bio: metin(preferences.bio),
      location: metin(preferences.location),
      birthDate: metin(preferences.birthDate),
      emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
      // Şifre HASH'İ İSTEMCİYE GİTMİYOR; yalnızca var olup olmadığı.
      sifreVar: Boolean(user.password),
      preferredTransport: user.preferredTransport,
      preferredCurrency: user.preferredCurrency,
      interests: user.interests,
      preferences,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Kullanıcının seyahat istatistikleri.
    //
    // TOPLAM BÜTÇE İÇİN `groupBy` YETMİYOR (B4 · Adım 5):
    // `_sum: { total_cost: true }` ARŞİV sütununu toplar. Taşınmış bir
    // planın gerçek toplamı `BudgetItem` tablosunda; bütçesini düzenleyen
    // kullanıcı profilinde eski rakamı görmeye devam ederdi. Satırlar
    // okunup toplam ilişkisel modelden tazeleniyor.
    //
    // Sayımlar da aynı listeden çıkıyor: ayrı bir `count` sorgusu, aynı
    // soruya iki ayrı yoldan cevap vermek olurdu.
    const planlar = await prisma.tripPlan.findMany({
      where: { userId: user.id },
      select: { status: true, total_cost: true, tripId: true, migratedAt: true },
    });

    const tazelenmis = await toplamlariTazele(planlar);

    const totalTrips = tazelenmis.length;

    const completedTrips = tazelenmis.filter(
      (plan) => plan.status === 'COMPLETED' || plan.status === 'DONE'
    ).length;

    const totalBudget = tazelenmis.reduce(
      (sum, plan) => sum + (plan.total_cost || 0),
      0
    );

    // En popüler destinasyon
    const popularDestination = await prisma.tripPlan.groupBy({
      by: ['city'],
      where: { userId: user.id },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 1,
    });

    // Ortalama seyahat süresi (gün olarak)
    const tripDurations = await prisma.tripPlan.findMany({
      where: { 
        userId: user.id,
        startDate: { not: null },
        endDate: { not: null }
      },
      select: { startDate: true, endDate: true },
    });

    // Gün sayısı KAPSAYICI hesaplanıyor (bkz. src/lib/trip-dates.ts);
    // eskiden 1-5 Ocak seyahati 4 gün sayılıyordu. Ayrıca tarihleri ters
    // girilmiş satırlar ortalamayı bozmasın diye eleniyor.
    const gecerliSureler = tripDurations
      .map((trip) => gunSayisi(trip.startDate, trip.endDate))
      .filter((gun) => gun > 0);

    const averageTripDuration =
      gecerliSureler.length > 0
        ? Math.round(
            gecerliSureler.reduce((sum, gun) => sum + gun, 0) / gecerliSureler.length
          )
        : 0;

    const stats = {
      totalTrips,
      completedTrips,
      totalBudget,
      averageTripDuration,
      favoriteDestination: popularDestination[0]?.city || null,
    };

    return NextResponse.json({
      success: true,
      profile,
      stats,
    });
  } catch (error: unknown) {
    logger.error("Profil getirilemedi", error);
    
    // Hata ayrıntısı yalnızca sunucu log'una; istemciye genel mesaj.
    return NextResponse.json(
      { success: false, error: "Profil bilgileri getirilemedi" },
      { status: 500 }
    );
  }
}

/**
 * Hesabı ve ona bağlı HER ŞEYİ siler (B9).
 *
 * KVKK/GDPR açısından gerekli; şemadaki `onDelete: Cascade` zincirleri
 * zaten hazırdı, eksik olan uçtu.
 *
 * NE SİLİNİYOR: `User` satırı. Cascade ile hesaplar, oturumlar,
 * `TripPlan` kayıtları ve `Trip` + altındaki bütçe kalemleri, günlük
 * planlar, konaklama/ulaşım kayıtları da gidiyor. Yani "hesabımı sil"
 * gerçekten her şeyi siliyor — kullanıcıya da bu söyleniyor.
 *
 * ONAY ZORUNLU. Şifreyle açılmış hesapta ŞİFRE, yalnızca Google ile
 * açılmış hesapta E-POSTA ADRESİ isteniyor (bkz. `hesapSilmeSchema`).
 * Onaysız silme, açık kalmış bir oturumu olan herkese kullanıcının tüm
 * verisini yok etme yetkisi vermek olurdu.
 *
 * HIZ SINIRI VAR ama amacı farklı: burada korunması gereken şey hesap
 * değil, ŞİFRE. Onay alanı bir şifre doğrulaması olduğu için sınırsız
 * deneme, açık bir oturum üzerinden şifre tahmin etme kanalı açardı.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const kota = await rateLimitAsync(`hesap-sil:${auth.user.id}`, 5, 60 * 60 * 1000);
    if (!kota.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme yapıldı, daha sonra tekrar deneyin" },
        { status: 429, headers: { "Retry-After": String(kota.retryAfter) } }
      );
    }

    const parsed = hesapSilmeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Onay gerekli") },
        { status: 400 }
      );
    }

    const kullanici = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, email: true, password: true },
    });

    if (!kullanici) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const onay = parsed.data.onay;

    const dogru = kullanici.password
      ? await bcrypt.compare(onay, kullanici.password)
      : // Şifresiz (yalnızca Google) hesap: adresin birebir yazılması
        // isteniyor. Karşılaştırma küçük harfe indirilerek yapılıyor;
        // kullanıcının kendi adresini büyük harfle yazması bir hata değil.
        onay.trim().toLocaleLowerCase("tr") ===
        (kullanici.email ?? "").toLocaleLowerCase("tr");

    if (!dogru) {
      return NextResponse.json(
        {
          error: kullanici.password
            ? "Şifre hatalı"
            : "E-posta adresi eşleşmedi",
        },
        { status: 401 }
      );
    }

    // Sahiplik sorgunun İÇİNDE: `where: { id }` oturumdan gelen kimlikle
    // sınırlı ve başka bir filtre yok — yanlışlıkla `deleteMany` yazmanın
    // buradaki bedeli tüm kullanıcıları silmek olurdu.
    await prisma.user.delete({ where: { id: kullanici.id } });

    logger.info("Hesap silindi", { userId: kullanici.id });

    return NextResponse.json({
      success: true,
      message: "Hesabınız ve tüm verileriniz silindi.",
    });
  } catch (error) {
    logger.error("Hesap silinemedi", error);
    return NextResponse.json(
      { error: "Hesap silinemedi, lütfen tekrar deneyin" },
      { status: 500 }
    );
  }
}
