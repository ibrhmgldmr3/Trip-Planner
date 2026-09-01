import { butceyiCoz, gunleriCoz, tutar, type PlanGunu } from "@/lib/plan-budget";
import { gunSayisi, isoGunTarihi, tarihiCoz } from "@/lib/trip-dates";
import { TripStatus, isTripStatus } from "@/lib/trip-status";

/**
 * `TripPlan`'ın JSON sütunlarını ilişkisel modele çevirir.
 *
 * NEDEN VAR (Aşama 1): uygulamada iki veri modeli yan yana yaşıyor.
 * Arayüzün tamamı `TripPlan.gun_plani` / `TripPlan.butce_tahmini` JSON
 * METİNLERİNİ kullanıyor; `Trip` + `BudgetItem` + `DailyPlan` ilişkisel
 * modelinin ise API'si var ama hiçbir sayfa çağırmıyor. JSON tarafında
 * her düzenleme tüm sütunu yeniden yazıyor (eşzamanlı düzenlemede biri
 * diğerini eziyor), SQL ile toplama yapılamıyor ve her okuyan kendi
 * ayrıştırıcısını yazıyor — denetimdeki bütçe hatalarının kaynağı buydu.
 *
 * Bu modül DÖNÜŞÜMÜ yapar, yazmayı değil: saf bir fonksiyon olduğu için
 * gerçek verinin şekli birim testle sabitlenebiliyor. Veritabanına yazma
 * `planiIliskiselModeleTasi` içinde (plan-migration-runner.ts).
 */

/** İlişkisel modele yazılacak, henüz kimliksiz kayıt taslağı. */
export interface IliskiselPlanTaslagi {
  trip: {
    title: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    city: string;
    country: string | null;
    budget: number | null;
    notes: string | null;
    status: TripStatus;
  };
  budgetItems: Array<{
    category: string;
    description: string;
    amount: number;
    currency: string;
    isEstimate: boolean;
    isPaid: boolean;
  }>;
  dailyPlans: Array<{
    date: Date;
    title: string | null;
    notes: string | null;
    activities: Array<{
      id?: string;
      title: string;
      description?: string;
      time?: string;
      endTime?: string;
      location?: string;
      cost?: number;
      category?: string;
    }>;
  }>;
}

/** Dönüştürülemeyen planların gerekçesi; rapora ve log'a yazılıyor. */
export type TasimaEngeli =
  | "tarih-yok"
  | "tarih-gecersiz"
  | "tarih-tersine"
  | "sehir-yok";

export type DonusumSonucu =
  | { ok: true; taslak: IliskiselPlanTaslagi; uyarilar: string[] }
  | { ok: false; engel: TasimaEngeli };

/** Dönüştürücünün ihtiyaç duyduğu `TripPlan` alanları. */
export interface TasinacakPlan {
  id: string;
  city: string;
  country: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  total_cost: number | null;
  sehir_bilgisi: string | null;
  pratik_bilgiler: string | null;
  gun_plani: string | null;
  butce_tahmini: string | null;
}

/**
 * Aktivite şeklini `DailyPlan.activities` sözleşmesine çevirir.
 *
 * `gun_plani` içinde alan adı `name` / `startTime`, ilişkisel tarafta
 * `title` / `time`. İki şekli birleştirmek yerine ilişkisel tarafı esas
 * alıyoruz: `trip-services.ts` zaten oraya bu adlarla yazıyor.
 */
function aktiviteleriCevir(gun: PlanGunu): IliskiselPlanTaslagi["dailyPlans"][number]["activities"] {
  return gun.activities.map((aktivite, index) => {
    const kayit: IliskiselPlanTaslagi["dailyPlans"][number]["activities"][number] = {
      id: aktivite.id || `d${gun.day}-a${index + 1}`,
      title: aktivite.name.trim() || "Aktivite",
    };

    if (aktivite.description.trim()) kayit.description = aktivite.description.trim();
    if (aktivite.startTime.trim()) kayit.time = aktivite.startTime.trim();
    if (aktivite.endTime.trim()) kayit.endTime = aktivite.endTime.trim();
    if (aktivite.location.trim()) kayit.location = aktivite.location.trim();
    if (aktivite.cost > 0) kayit.cost = aktivite.cost;
    if (aktivite.category.trim()) kayit.category = aktivite.category.trim();

    return kayit;
  });
}

/**
 * Bir günün tarihini belirler.
 *
 * Önce günün kendi `date` alanı denenir (serileştirici ISO yazıyor); yoksa
 * ya da çözülemezse gün numarasından seyahat başlangıcına göre türetilir.
 * Böylece eksik/bozuk tarihli günler de sıraya oturuyor.
 */
function gunTarihiBelirle(gun: PlanGunu, baslangic: Date, index: number): Date | null {
  const kendiTarihi = tarihiCoz(gun.date);
  if (kendiTarihi) return kendiTarihi;

  const gunNo = gun.day > 0 ? gun.day : index + 1;
  const turetilmis = tarihiCoz(isoGunTarihi(baslangic, gunNo - 1));
  return turetilmis;
}

/**
 * `TripPlan` satırını ilişkisel taslağa çevirir.
 *
 * Tarihi olmayan planlar TAŞINMIYOR: `Trip.startDate`/`endDate` zorunlu ve
 * `DailyPlan` tarihe göre tekil. Tarih uydurmak, veriyi kurtarmak değil
 * bozmak olurdu — bu satırlar `migratedAt` boş kalarak JSON tarafında
 * yaşamaya devam ediyor ve rapora düşüyor.
 */
export function planiTaslagaCevir(plan: TasinacakPlan): DonusumSonucu {
  const uyarilar: string[] = [];

  const sehir = plan.city?.trim();
  if (!sehir) return { ok: false, engel: "sehir-yok" };

  if (!plan.startDate || !plan.endDate) {
    return { ok: false, engel: "tarih-yok" };
  }

  const baslangic = tarihiCoz(plan.startDate);
  const bitis = tarihiCoz(plan.endDate);
  if (!baslangic || !bitis) return { ok: false, engel: "tarih-gecersiz" };
  if (bitis < baslangic) return { ok: false, engel: "tarih-tersine" };

  const gunAdedi = gunSayisi(baslangic, bitis);

  /* ----------------------------- Bütçe ---------------------------------- */

  const budgetItems: IliskiselPlanTaslagi["budgetItems"] = [];
  const butce = butceyiCoz(plan.butce_tahmini);

  if (butce) {
    for (const [kategori, detay] of Object.entries(butce.categories)) {
      if (detay.items.length > 0) {
        for (const kalem of detay.items) {
          if (kalem.amount <= 0) continue;
          budgetItems.push({
            category: kategori,
            description: kalem.description,
            amount: kalem.amount,
            currency: butce.currency,
            isEstimate: true,
            isPaid: kalem.isPaid,
          });
        }
      } else if (detay.total > 0) {
        // Kalemi olmayan ama toplamı olan kategori tek satıra iniyor.
        budgetItems.push({
          category: kategori,
          description: `${kategori} (toplam)`,
          amount: detay.total,
          currency: butce.currency,
          isEstimate: true,
          isPaid: false,
        });
      }
    }
  } else if (plan.butce_tahmini) {
    // Markdown bütçe: sayıya güvenilmez, kalem üretmiyoruz. `total_cost`
    // yine de Trip.budget'a yazılıyor ki toplam kaybolmasın.
    uyarilar.push("butce-markdown-atlandi");
  }

  /* --------------------------- Günlük plan ------------------------------ */

  const dailyPlans: IliskiselPlanTaslagi["dailyPlans"] = [];
  const gunler = gunleriCoz(plan.gun_plani);

  if (gunler) {
    // Aynı tarihe düşen günler tekilleştiriliyor: DailyPlan'da
    // (tripId, date) tekil ve ikinci kayıt zaten kısıt hatası verirdi.
    const gorulenTarihler = new Set<string>();

    gunler.forEach((gun, index) => {
      const tarih = gunTarihiBelirle(gun, baslangic, index);
      if (!tarih) {
        uyarilar.push(`gun-${gun.day}-tarih-cozulemedi`);
        return;
      }

      const anahtar = isoGunTarihi(tarih, 0);
      if (gorulenTarihler.has(anahtar)) {
        uyarilar.push(`gun-${gun.day}-tarih-cakismasi`);
        return;
      }
      gorulenTarihler.add(anahtar);

      dailyPlans.push({
        date: tarih,
        // `gun_plani` JSON'unda gün başlığı diye bir alan yok; ilişkisel
        // tarafta opsiyonel olduğu için boş bırakılıyor.
        title: null,
        notes: gun.notes.trim() || null,
        activities: aktiviteleriCevir(gun),
      });
    });

    if (gunler.length > gunAdedi) {
      uyarilar.push(`gun-sayisi-fazla:${gunler.length}/${gunAdedi}`);
    }
  } else if (plan.gun_plani) {
    uyarilar.push("gun-plani-markdown-atlandi");
  }

  /* ----------------------------- Seyahat -------------------------------- */

  const kategoriToplami = budgetItems.reduce((sum, k) => sum + k.amount, 0);
  const butceToplami = kategoriToplami > 0 ? kategoriToplami : tutar(plan.total_cost);

  return {
    ok: true,
    uyarilar,
    taslak: {
      trip: {
        title: `${sehir} Gezisi`,
        description: plan.sehir_bilgisi?.trim() || null,
        startDate: baslangic,
        endDate: bitis,
        city: sehir,
        country: plan.country?.trim() || null,
        budget: butceToplami > 0 ? butceToplami : null,
        notes: plan.pratik_bilgiler?.trim() || null,
        status: isTripStatus(plan.status) ? plan.status : TripStatus.PLANNED,
      },
      budgetItems,
      dailyPlans,
    },
  };
}
