import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import {
  planBudgetPatchSchema,
  planDailyPlansPutSchema,
  ilkHataMesaji,
} from "@/lib/api-schemas";
import { gunSayisi } from "@/lib/trip-dates";
import {
  butceyiCoz,
  butceyiGunlerleEsitle,
  butceyiYenidenHesapla,
  gunleriCoz,
  bosButce,
} from "@/lib/plan-budget";
import { logger } from "@/lib/logger";
import { arsivUstuneYazilacaklar } from "@/lib/iliskisel-plan-ozeti";

/**
 * Plan detayı okuma/güncelleme.
 *
 * Bu dosyada düzeltilen sorunlar:
 *  - Üç handler da oturum + kullanıcı çözümlemesini elle tekrarlıyordu;
 *    artık `requireUser()` üzerinden tek yol var.
 *  - PATCH gövdesi doğrulanmıyordu: `Number(body.total_cost)` sayısal
 *    olmayan girdide NaN üretip Prisma'da yakalanmamış hataya dönüşüyordu.
 *  - PUT yalnızca `gun_plani` yazıyor, `{id, gun_plani}` döndürüyordu.
 *    Oysa istemci (daily-planner) yanıttan `plan.total_cost` okuyordu →
 *    o dal hiç çalışmıyor, aktivite maliyetleri bütçeye hiç yansımıyordu.
 *    Artık gün planı kaydedilirken bütçenin "aktiviteler" kategorisi
 *    yeniden hesaplanıyor ve toplamlar yanıtta dönüyor.
 *  - Hata yanıtları iç hata mesajını (`details`) istemciye sızdırıyordu.
 */

/**
 * Sahiplik kontrolü; üç handler da aynı kontrolü yapıyordu.
 *
 * "YOK" İLE "SENİN DEĞİL" AYRIMI YAPILMIYOR: ikisi de 404. 403 dönmek,
 * id'yi bilen birine o planın VAR OLDUĞUNU doğrular; cuid'ler tahmin
 * edilemez ama bir kez sızdıklarında (log, paylaşılan ekran görüntüsü,
 * Referer başlığı) 403 ile 404 arasındaki fark doğrudan bir bilgi
 * sızıntısıdır. İlişkisel model uçları (`src/lib/trip-ownership.ts`) bu
 * kuralı zaten uyguluyordu; TripPlan uçları geride kalmıştı.
 */
async function planiSahiplenDogrula(planId: string, userId: string) {
  const plan = await prisma.tripPlan.findFirst({
    where: { id: planId, userId },
    select: {
      userId: true,
      startDate: true,
      endDate: true,
      butce_tahmini: true,
    },
  });

  if (!plan) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Plan bulunamadı" }, { status: 404 }),
    };
  }

  return { ok: true as const, plan };
}


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    // Sahiplik SORGUNUN İÇİNDE: önce oku sonra karşılaştır deseni, filtre
    // unutulduğunda sessizce başkasının planını döndürüyor.
    const plan = await prisma.tripPlan.findFirst({
      where: {
        id: planId,
        userId: auth.user.id
      },
      select: {
        id: true,
        city: true,
        country: true,
        // Kalkış şehri (B6): başlıkta güzergâh olarak gösteriliyor.
        originCity: true,
        startDate: true,
        endDate: true,
        duration: true,
        total_cost: true,
        daily_cost: true,
        ai_model: true,
        createdAt: true,
        travel_style: true,
        budget_level: true,
        interests: true,
        accommodation: true,
        transportation: true,
        sehir_bilgisi: true,
        gun_plani: true,
        yemek_rehberi: true,
        pratik_bilgiler: true,
        butce_tahmini: true,
        raw_markdown: true,
        raw_html: true,
        status: true,
        // Taşınmışsa JSON sütunlarının yerine ilişkisel karşılıkları
        // döndürülüyor (B4 · Adım 5).
        tripId: true,
        migratedAt: true
      }
    });

    // "Yok" ile "senin değil" ayrımı yapılmıyor (bkz. planiSahiplenDogrula).
    if (!plan) {
      return NextResponse.json(
        { error: "Plan bulunamadı" },
        { status: 404 }
      );
    }

    // TAŞINMIŞ PLANDA JSON SÜTUNLARI ARŞİV (B4 · Adım 5).
    //
    // `butce_tahmini`, `gun_plani` ve toplamlar ilişkisel tablolardan
    // üretilip AYNI ŞEKİLDE döndürülüyor; bu yüzden plan detayı sayfası
    // hiç değişmedi. Alternatif, sayfayı iki ayrı veri yoluna bölmekti —
    // aynı ekranın iki farklı okuma kodu, iki farklı bozulma yolu demek.
    const ustuneYaz = await arsivUstuneYazilacaklar(plan);

    return NextResponse.json({
      success: true,
      plan: { ...plan, ...ustuneYaz }
    });

  } catch (error: unknown) {
    logger.error("Plan detayı getirilemedi", error);
    
    return NextResponse.json(
      { 
        error: "Plan detayı yüklenemedi"
      },
      { status: 500 }
    );
  }
}

/**
 * Bütçe güncellemesi.
 *
 * `butce_tahmini` gönderildiğinde toplamlar SUNUCUDA yeniden hesaplanıyor;
 * istemcinin gönderdiği `total_cost` değerine güvenilmiyor. Böylece
 * `TripPlan.total_cost` ile `butce_tahmini` içindeki toplam hiçbir zaman
 * ayrışmıyor (bütçe sayfası ikisini geçmişte farklı formüllerle üretiyordu).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const sahiplik = await planiSahiplenDogrula(planId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const parsed = planBudgetPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçersiz bütçe verisi") },
        { status: 400 }
      );
    }

    const gonderilen = parsed.data;
    const gun = gunSayisi(sahiplik.plan.startDate, sahiplik.plan.endDate);

    const updateData: {
      total_cost?: number;
      daily_cost?: number;
      butce_tahmini?: string;
    } = {};

    if (gonderilen.butce_tahmini !== undefined) {
      const butce = butceyiCoz(gonderilen.butce_tahmini);

      if (!butce) {
        return NextResponse.json(
          { error: "Bütçe verisi tanınan JSON biçiminde değil" },
          { status: 400 }
        );
      }

      // Toplam/günlük ortalama/önerilen bütçe türetilmiş alanlar:
      // kategori toplamlarından yeniden üretiliyor.
      const normalize = butceyiYenidenHesapla(butce, gun);

      updateData.butce_tahmini = JSON.stringify(normalize);
      updateData.total_cost = normalize.totalCostWithExtras;
      updateData.daily_cost = normalize.dailyAverage;
    } else {
      // Bütçe JSON'u gönderilmediyse tekil alanlar doğrudan güncellenebilir.
      if (gonderilen.total_cost !== undefined) {
        updateData.total_cost = Math.round(gonderilen.total_cost);
      }
      if (gonderilen.daily_cost !== undefined) {
        updateData.daily_cost = Math.round(gonderilen.daily_cost);
      }
    }

    const updatedPlan = await prisma.tripPlan.update({
      where: { id: planId },
      data: updateData,
      select: {
        id: true,
        total_cost: true,
        daily_cost: true,
        butce_tahmini: true,
      },
    });

    logger.info("Plan bütçesi güncellendi", { planId });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error: unknown) {
    logger.error("Plan bütçesi güncellenemedi", error);

    return NextResponse.json(
      { error: "Plan bütçesi güncellenemedi" },
      { status: 500 }
    );
  }
}

/**
 * Günlük plan güncellemesi.
 *
 * Kaydetmeden önce gövde JSON olarak çözülüyor: istemci ne gönderirse
 * gönderilsin `gun_plani` sütununda daima tüketicilerin beklediği şekil
 * (kök seviyede dizi) duruyor. Ardından aktivite maliyetleri bütçeye
 * yansıtılıp toplamlar güncelleniyor — bu olmadan günlük planlayıcıda
 * eklenen bir aktivitenin maliyeti hiçbir yerde görünmüyordu.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: planId } = await context.params;

    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const sahiplik = await planiSahiplenDogrula(planId, auth.user.id);
    if (!sahiplik.ok) return sahiplik.response;

    const parsed = planDailyPlansPutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: ilkHataMesaji(parsed.error, "Geçersiz günlük plan verisi") },
        { status: 400 }
      );
    }

    const gunler = gunleriCoz(parsed.data.daily_plans);
    if (!gunler) {
      return NextResponse.json(
        { error: "Günlük plan verisi tanınan JSON biçiminde değil" },
        { status: 400 }
      );
    }

    const gun = gunSayisi(sahiplik.plan.startDate, sahiplik.plan.endDate);

    const updateData: {
      gun_plani: string;
      butce_tahmini?: string;
      total_cost?: number;
      daily_cost?: number;
    } = {
      gun_plani: JSON.stringify(gunler),
    };

    // Bütçe eski (markdown) biçimdeyse dokunmuyoruz: çözemediğimiz bir
    // metni yeniden yazmak veri kaybı olur. Böyle satırlarda gün planı
    // güncellenir, bütçe olduğu gibi kalır.
    const mevcutButce = butceyiCoz(sahiplik.plan.butce_tahmini);
    const temelButce = mevcutButce ?? (sahiplik.plan.butce_tahmini ? null : bosButce());

    if (temelButce) {
      const yeniButce = butceyiGunlerleEsitle(temelButce, gunler, gun);
      updateData.butce_tahmini = JSON.stringify(yeniButce);
      updateData.total_cost = yeniButce.totalCostWithExtras;
      updateData.daily_cost = yeniButce.dailyAverage;
    }

    const updatedPlan = await prisma.tripPlan.update({
      where: { id: planId },
      data: updateData,
      select: {
        id: true,
        gun_plani: true,
        butce_tahmini: true,
        total_cost: true,
        daily_cost: true,
      },
    });

    logger.info("Günlük planlar güncellendi", {
      planId,
      gunSayisi: gunler.length,
      butceGuncellendi: updateData.butce_tahmini !== undefined,
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error: unknown) {
    logger.error("Günlük planlar güncellenemedi", error);

    return NextResponse.json(
      { error: "Günlük planlar güncellenemedi" },
      { status: 500 }
    );
  }
}
