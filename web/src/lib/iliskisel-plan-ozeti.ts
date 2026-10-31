import { prisma } from "@/lib/prisma";
import { gunlukOrtalama, gunSayisi } from "@/lib/trip-dates";
import {
  AKTIVITE_KATEGORISI,
  aktiviteButceKalemleri,
  butceyiYenidenHesapla,
  bosButce,
  type ButceKategorisi,
  type PlanButcesi,
} from "@/lib/plan-budget";
import {
  ekranGununeCevir,
  gunAnahtari,
  iliskiselAktiviteyeCevir,
  type EkranAktivitesi,
  type EkranGunu,
} from "@/lib/gunluk-plan-esitleme";
import { Prisma } from "@prisma/client";

/**
 * İlişkisel modelden ARŞİV ŞEKLİNE okuma (B4 · Adım 5).
 *
 * NEDEN VAR: taşıma bittikten sonra bile üç ekran `TripPlan`ın JSON
 * sütunlarını okumaya devam ediyordu (planlar listesi, profil
 * istatistikleri, plan detayı). O yüzden bütçe ve günlük planlayıcı
 * ilişkisel tabloya yazdıktan SONRA bir de JSON sütunlarını güncellemek
 * zorundaydı — "geçiş dönemi çift yazması". İki modeli aynı anda güncel
 * tutmak, ikisinin ayrışması için tek bir hata yolunun yetmesi demekti.
 *
 * ÇÖZÜM YÖNÜ: istemcileri değiştirmek yerine SUNUCUDA türetmek. Taşınmış
 * bir plan okunurken `total_cost`, `daily_cost`, `butce_tahmini` ve
 * `gun_plani` ilişkisel tablolardan üretilip arşiv sütunlarıyla aynı
 * şekilde döndürülüyor. Böylece üç ekranın hiçbiri değişmedi, ama hiçbiri
 * artık bayat bir sütun okumuyor ve çift yazma kaldırılabildi.
 *
 * SONUÇ: JSON sütunları SALT OKUNUR ARŞİV. Taşınmamış planlar için hâlâ
 * tek gerçek kaynak; taşınmış planlar için yalnızca ilişkisel tabloların
 * sessiz kaldığı yerde (aşağıdaki geri düşme kuralı) konuşuyorlar.
 *
 * SAHİPLİK: buradaki sorgular yetki KONTROL ETMİYOR. Çağıranlar
 * `tripId`leri zaten kullanıcının kendi planlarından çıkarıyor; bu modüle
 * dışarıdan gelen ham bir kimlik verilmemeli.
 */

/** Taşınma damgası taşıyan planın okunan alanları. */
export interface TasinabilirPlan {
  tripId: string | null;
  migratedAt: Date | null;
}

/**
 * Plan ilişkisel modele taşındıysa `Trip` kimliği, taşınmadıysa null.
 *
 * İKİ ALAN DA ARANIYOR: `migratedAt` taşımanın damgası, `tripId` ise bağ.
 * Bağ kopabiliyor — `TripPlan.trip` ilişkisi `onDelete: SetNull` (bkz. A1),
 * yani kullanıcı türetilmiş geziyi silerse `tripId` null olur ama
 * `migratedAt` dolu kalır. O durumda ilişkisel tarafta okunacak bir şey
 * yoktur; plan arşive geri düşer.
 */
export function tasinmisTripId(plan: TasinabilirPlan): string | null {
  return plan.migratedAt && plan.tripId ? plan.tripId : null;
}

/* -------------------------------------------------------------------------- */
/* Saf çeviriler                                                              */
/* -------------------------------------------------------------------------- */

/** `BudgetItem` satırının bütçe şekline çevrilirken okunan alanları. */
export interface OzetKalem {
  category: string;
  description: string;
  amount: number;
  isPaid: boolean;
  currency?: string | null;
}

/**
 * `BudgetItem` satırlarını `butce_tahmini` sütununun şekline çevirir.
 *
 * Kategori toplamları ve genel toplam BURADA HESAPLANMIYOR;
 * `butceyiYenidenHesapla` üretiyor. Aynı formülün ikinci bir kopyası,
 * taşınmış ve taşınmamış planların farklı toplamlar göstermesi demek
 * olurdu.
 */
export function kalemlerdenButce(kalemler: OzetKalem[], gun: number): PlanButcesi {
  const categories: Record<string, ButceKategorisi> = {};

  for (const kalem of kalemler) {
    const kategori = (categories[kalem.category] ??= { items: [], total: 0 });
    kategori.items.push({
      description: kalem.description,
      amount: kalem.amount,
      isPaid: kalem.isPaid,
    });
  }

  // Para birimi kalem başına saklanıyor ama bütçe şeklinde tek alan var.
  // İlk dolu değer alınıyor; karışık para birimi bu modelde zaten temsil
  // edilemiyor (kalemler doğrudan toplanıyor).
  const currency = kalemler.find((k) => k.currency)?.currency || "TRY";

  return butceyiYenidenHesapla({ ...bosButce(), categories, currency }, gun);
}

/** `DailyPlan` satırının ekran şekline çevrilirken okunan alanları. */
export interface OzetGunSatiri {
  id: string;
  date: Date | string;
  notes: string | null;
  activities: unknown;
}

/**
 * `DailyPlan` satırlarını `gun_plani` sütununun şekline çevirir.
 *
 * GÜN NUMARASI TARİH SIRASINDAN TÜRETİLİYOR: ilişkisel tarafta "kaçıncı
 * gün" diye bir sütun yok, doğal anahtar tarih (`@@unique([tripId, date])`).
 * Satırlar sıralanmadan numaralandırılsaydı gün numaraları veritabanının
 * döndürme sırasına bağlı kalırdı.
 */
export function gunSatirlarindanEkranGunleri(satirlar: OzetGunSatiri[]): EkranGunu[] {
  return [...satirlar]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((satir, index) =>
      ekranGununeCevir(
        {
          id: satir.id,
          date: satir.date instanceof Date ? satir.date.toISOString() : satir.date,
          notes: satir.notes,
          activities: satir.activities,
        },
        index + 1
      )
    );
}

/* -------------------------------------------------------------------------- */
/* Okuma                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Verilen seyahatlerin bütçe toplamları.
 *
 * DÖNEN HARİTADA OLMAYAN SEYAHAT = HİÇ KALEMİ YOK. Bu ayrım önemli:
 * toplamı 0 olan bir seyahat ile hiç kalemi olmayan bir seyahat aynı şey
 * değil. Taşıma, bütçesi markdown olan planlarda kalem ÜRETMİYOR (sayıya
 * güvenilmiyor, bkz. plan-migration.ts); böyle bir planı 0 TL göstermek
 * kullanıcıya verisi silinmiş gibi görünürdü. Kalem yoksa çağıran arşiv
 * değerine geri düşüyor.
 */
export async function iliskiselToplamlariGetir(
  tripIds: Array<string | null>
): Promise<Map<string, number>> {
  const benzersiz = [...new Set(tripIds.filter((id): id is string => !!id))];
  const toplamlar = new Map<string, number>();

  // Boş `in` listesiyle sorgu atmak gereksiz; ayrıca filtrenin yanlışlıkla
  // `undefined`a düşüp TÜM kalemleri okumasının önünü kesiyor.
  if (benzersiz.length === 0) return toplamlar;

  const kalemler = await prisma.budgetItem.findMany({
    where: { tripId: { in: benzersiz } },
    select: { tripId: true, amount: true },
  });

  for (const kalem of kalemler) {
    toplamlar.set(kalem.tripId, (toplamlar.get(kalem.tripId) ?? 0) + kalem.amount);
  }

  return toplamlar;
}

/**
 * Planın ekranda gösterilecek toplamı.
 *
 * Taşınmışsa ilişkisel toplam; taşınmamışsa ya da ilişkisel tarafta hiç
 * kalem yoksa arşivdeki `total_cost`.
 */
export function etkinToplam(
  plan: TasinabilirPlan & { total_cost: number | null },
  toplamlar: Map<string, number>
): number | null {
  const tripId = tasinmisTripId(plan);
  if (!tripId) return plan.total_cost;

  const iliskisel = toplamlar.get(tripId);
  return iliskisel === undefined ? plan.total_cost : Math.round(iliskisel);
}

/** Bir plan listesinin toplamlarını TEK sorguda ilişkisel modelden tazeler. */
export async function toplamlariTazele<
  T extends TasinabilirPlan & { total_cost: number | null }
>(planlar: T[]): Promise<T[]> {
  const toplamlar = await iliskiselToplamlariGetir(planlar.map(tasinmisTripId));
  return planlar.map((plan) => ({ ...plan, total_cost: etkinToplam(plan, toplamlar) }));
}

/**
 * Taşınmış planın gün planı, `gun_plani` sütununun şeklinde.
 *
 * @returns Hiç `DailyPlan` satırı yoksa null — çağıran arşive geri düşer.
 */
export async function iliskiselGunPlaniJson(tripId: string): Promise<string | null> {
  const satirlar = await prisma.dailyPlan.findMany({
    where: { tripId },
    select: { id: true, date: true, notes: true, activities: true },
    orderBy: { date: "asc" },
  });

  if (satirlar.length === 0) return null;

  return JSON.stringify(gunSatirlarindanEkranGunleri(satirlar));
}

/** Plan detayında arşiv sütunlarının üzerine yazılacak alanlar. */
export interface ArsivUstuYazma {
  total_cost?: number;
  daily_cost?: number;
  butce_tahmini?: string;
  gun_plani?: string;
}

/**
 * Taşınmış bir planın JSON sütunlarının ilişkisel karşılıklarını üretir.
 *
 * KISMİ OLABİLİR: bütçe ve gün planı ayrı ayrı değerlendiriliyor. Bütçesi
 * markdown olduğu için kalem üretilmemiş ama günleri taşınmış bir planda
 * yalnızca `gun_plani` tazeleniyor, bütçe arşivde kalıyor.
 */
export async function arsivUstuneYazilacaklar(
  plan: TasinabilirPlan & { startDate: Date | null; endDate: Date | null }
): Promise<ArsivUstuYazma> {
  const tripId = tasinmisTripId(plan);
  if (!tripId) return {};

  const [kalemler, gunPlani] = await Promise.all([
    prisma.budgetItem.findMany({
      where: { tripId },
      select: {
        category: true,
        description: true,
        amount: true,
        isPaid: true,
        currency: true,
      },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    }),
    iliskiselGunPlaniJson(tripId),
  ]);

  const ustuneYaz: ArsivUstuYazma = {};
  const gun = gunSayisi(plan.startDate, plan.endDate);

  if (kalemler.length > 0) {
    const butce = kalemlerdenButce(kalemler, gun);
    ustuneYaz.butce_tahmini = JSON.stringify(butce);
    ustuneYaz.total_cost = butce.totalCostWithExtras;
    ustuneYaz.daily_cost = butce.dailyAverage;
  }

  if (gunPlani) ustuneYaz.gun_plani = gunPlani;

  return ustuneYaz;
}

/**
 * Günlerin aktivitelerini ilişkisel satırlara GERİ yazar.
 *
 * Tek çağıranı koordinat tamamlama ucu: gün planını okuyup aktivitelere
 * koordinat ekliyor ve sonucu kaydetmesi gerekiyor. Taşınmış planda
 * yazılacak yer `TripPlan.gun_plani` değil, `DailyPlan` satırları.
 *
 * EŞLEŞTİRME TARİHE GÖRE, sıraya göre değil. Şemada `@@unique([tripId,
 * date])` var, yani tarih doğal anahtar; indeksle eşleştirmek, araya bir
 * gün eklenmiş bir planda bütün koordinatları BİR GÜN KAYDIRIRDI.
 *
 * @returns Güncellenen satır sayısı.
 */
export async function gunAktivitelerineYaz(
  tripId: string,
  gunler: Array<{ date: string; day: number; activities: EkranAktivitesi[] }>
): Promise<number> {
  const satirlar = await prisma.dailyPlan.findMany({
    where: { tripId },
    select: { id: true, date: true },
  });

  const satirHaritasi = new Map(
    satirlar.map((satir) => [gunAnahtari(satir.date.toISOString()), satir.id])
  );

  let yazilan = 0;

  await prisma.$transaction(async (tx) => {
    for (const gun of gunler) {
      const id = satirHaritasi.get(gunAnahtari(gun.date));
      // Karşılığı olmayan gün atlanıyor: ekranda var olup tabloda olmayan
      // bir gün burada YARATILMAMALI, bu uç yalnızca koordinat tamamlıyor.
      if (!id) continue;

      await tx.dailyPlan.update({
        where: { id },
        data: {
          activities: gun.activities.map((aktivite, index) =>
            iliskiselAktiviteyeCevir(aktivite, gun.day, index)
          ) as unknown as Prisma.InputJsonValue,
        },
      });

      yazilan += 1;
    }
  });

  return yazilan;
}

/* -------------------------------------------------------------------------- */
/* Yazma                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Aktivite maliyetlerini bütçenin "aktiviteler" kategorisine yansıtır.
 *
 * NEDEN GEREKLİ: JSON modelinde bunu `PUT /api/plan-detail/[id]` yapıyordu
 * — gün planı kaydedilirken bütçe de yeniden hesaplanıyordu. Günlük
 * planlayıcı taşınmış planlarda o ucu ARTIK ÇAĞIRMIYOR (çift yazma
 * kaldırıldı), dolayısıyla aynı kural ilişkisel tarafta da işlemek
 * zorunda; yoksa eklenen bir aktivitenin maliyeti hiçbir toplama girmezdi.
 *
 * KATEGORİ TAMAMEN YENİDEN YAZILIYOR: kaynak gün planı, elle girilmiş
 * kalemler değil. Bu, JSON modelindeki davranışın birebir aynısı.
 *
 * TEK İSTİSNA — `isPaid` KORUNUYOR: aynı açıklamayla duran bir kalem
 * "ödendi" işaretliyse yeni satırda da işaretli kalıyor. JSON modeli bunu
 * yapamıyordu (her seferinde `isPaid: false` yazıyordu); ilişkisel tarafta
 * kullanıcının işaretini her gün kaydında silmek için bir sebep yok.
 *
 * @returns Seyahatin güncel bütçe toplamı.
 */
export async function aktiviteButcesiniEsitle(tripId: string): Promise<number> {
  const gunSatirlari = await prisma.dailyPlan.findMany({
    where: { tripId },
    select: { id: true, date: true, notes: true, activities: true },
    orderBy: { date: "asc" },
  });

  const kalemler = aktiviteButceKalemleri(gunSatirlarindanEkranGunleri(gunSatirlari));

  await prisma.$transaction(async (tx) => {
    const mevcut = await tx.budgetItem.findMany({
      where: { tripId, category: AKTIVITE_KATEGORISI },
      select: { description: true, isPaid: true },
    });

    const odenmisler = new Set(mevcut.filter((k) => k.isPaid).map((k) => k.description));

    await tx.budgetItem.deleteMany({
      where: { tripId, category: AKTIVITE_KATEGORISI },
    });

    if (kalemler.length === 0) return;

    await tx.budgetItem.createMany({
      data: kalemler.map((kalem) => ({
        tripId,
        category: AKTIVITE_KATEGORISI,
        description: kalem.description,
        amount: kalem.amount,
        isEstimate: true,
        isPaid: odenmisler.has(kalem.description),
      })),
    });
  });

  const toplamlar = await iliskiselToplamlariGetir([tripId]);
  return toplamlar.get(tripId) ?? 0;
}

/** Toplam ve gün ortalamasını birlikte döndürür; istemci ikisini de gösteriyor. */
export function toplamOzeti(
  toplam: number,
  baslangic: Date | string | null,
  bitis: Date | string | null
): { total_cost: number; daily_cost: number } {
  const gun = gunSayisi(baslangic, bitis);
  return { total_cost: Math.round(toplam), daily_cost: gunlukOrtalama(toplam, gun) };
}
