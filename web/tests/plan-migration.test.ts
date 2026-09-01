import { describe, expect, it } from "vitest";
import { planiTaslagaCevir, type TasinacakPlan } from "@/lib/plan-migration";
import { TripStatus } from "@/lib/trip-status";

/** Serileştiricinin ürettiği biçimde bir bütçe JSON'u. */
function butceJson() {
  return JSON.stringify({
    categories: {
      "ulaşım": { items: [{ description: "Uçak", amount: 4000, isPaid: true }], total: 4000 },
      konaklama: { items: [{ description: "Otel", amount: 6000, isPaid: false }], total: 6000 },
      yemek: { items: [], total: 1500 },
      aktiviteler: { items: [], total: 0 },
    },
    currency: "TRY",
    totalCostWithExtras: 11500,
    suggestedBudget: 13800,
    dailyAverage: 2300,
  });
}

/** Serileştiricinin ürettiği biçimde bir gün planı JSON'u. */
function gunPlaniJson() {
  return JSON.stringify([
    {
      day: 1,
      date: "2026-05-01",
      notes: "Havaalanından otele",
      isEmpty: false,
      activities: [
        {
          id: "d1-a1",
          name: "Kolezyum",
          startTime: "09:00",
          endTime: "12:00",
          cost: 500,
          description: "Rehberli tur",
          category: "kültür",
          location: "Roma merkez",
        },
      ],
    },
    { day: 2, date: "2026-05-02", notes: "", isEmpty: true, activities: [] },
  ]);
}

function plan(ustuneYaz: Partial<TasinacakPlan> = {}): TasinacakPlan {
  return {
    id: "plan-1",
    city: "Roma",
    country: "İtalya",
    startDate: new Date(2026, 4, 1, 12),
    endDate: new Date(2026, 4, 5, 12),
    status: "PLANNED",
    total_cost: 11500,
    sehir_bilgisi: "Roma hakkında",
    pratik_bilgiler: "Metro kartı alın",
    gun_plani: gunPlaniJson(),
    butce_tahmini: butceJson(),
    ...ustuneYaz,
  };
}

describe("planiTaslagaCevir — seyahat", () => {
  it("temel alanları taşır", () => {
    const sonuc = planiTaslagaCevir(plan());
    expect(sonuc.ok).toBe(true);
    if (!sonuc.ok) return;

    expect(sonuc.taslak.trip.city).toBe("Roma");
    expect(sonuc.taslak.trip.country).toBe("İtalya");
    expect(sonuc.taslak.trip.title).toBe("Roma Gezisi");
    expect(sonuc.taslak.trip.description).toBe("Roma hakkında");
    expect(sonuc.taslak.trip.notes).toBe("Metro kartı alın");
    expect(sonuc.taslak.trip.status).toBe(TripStatus.PLANNED);
  });

  it("bütçeyi kategori toplamlarından türetir", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");
    // 4000 + 6000 + 1500
    expect(sonuc.taslak.trip.budget).toBe(11500);
  });

  it("bilinmeyen durumu PLANNED'a düşürür", () => {
    const sonuc = planiTaslagaCevir(plan({ status: "PLANLANDI" }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");
    expect(sonuc.taslak.trip.status).toBe(TripStatus.PLANNED);
  });

  it("bilinen durumu korur", () => {
    const sonuc = planiTaslagaCevir(plan({ status: "DONE" }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");
    expect(sonuc.taslak.trip.status).toBe(TripStatus.DONE);
  });
});

describe("planiTaslagaCevir — taşınamayan planlar", () => {
  it("tarihi olmayan planı taşımaz", () => {
    // Trip.startDate/endDate zorunlu; tarih uydurmak veriyi bozmak olurdu.
    expect(planiTaslagaCevir(plan({ startDate: null }))).toEqual({
      ok: false,
      engel: "tarih-yok",
    });
    expect(planiTaslagaCevir(plan({ endDate: null }))).toEqual({
      ok: false,
      engel: "tarih-yok",
    });
  });

  it("ters tarih aralığını taşımaz", () => {
    const sonuc = planiTaslagaCevir(
      plan({ startDate: new Date(2026, 4, 5), endDate: new Date(2026, 4, 1) })
    );
    expect(sonuc).toEqual({ ok: false, engel: "tarih-tersine" });
  });

  it("şehirsiz planı taşımaz", () => {
    expect(planiTaslagaCevir(plan({ city: "   " }))).toEqual({
      ok: false,
      engel: "sehir-yok",
    });
  });
});

describe("planiTaslagaCevir — bütçe kalemleri", () => {
  it("her kalemi ayrı satıra çevirir", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    const kalemler = sonuc.taslak.budgetItems;
    expect(kalemler).toHaveLength(3);

    const ucak = kalemler.find((k) => k.description === "Uçak");
    expect(ucak).toMatchObject({ category: "ulaşım", amount: 4000, isPaid: true });
  });

  it("ödeme durumunu korur", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");
    expect(sonuc.taslak.budgetItems.filter((k) => k.isPaid)).toHaveLength(1);
  });

  it("kalemi olmayan ama toplamı olan kategoriyi tek satıra indirir", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    const yemek = sonuc.taslak.budgetItems.find((k) => k.category === "yemek");
    expect(yemek).toMatchObject({ amount: 1500, description: "yemek (toplam)" });
  });

  it("sıfır tutarlı kategoriyi atlar", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");
    expect(sonuc.taslak.budgetItems.some((k) => k.category === "aktiviteler")).toBe(false);
  });

  it("markdown bütçeden kalem üretmez ama uyarır", () => {
    const sonuc = planiTaslagaCevir(
      plan({ butce_tahmini: "## Bütçe\n- Ulaşım: 4.000 TL", total_cost: 9000 })
    );
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    expect(sonuc.taslak.budgetItems).toHaveLength(0);
    expect(sonuc.uyarilar).toContain("butce-markdown-atlandi");
    // Toplam yine de kaybolmuyor.
    expect(sonuc.taslak.trip.budget).toBe(9000);
  });
});

describe("planiTaslagaCevir — günlük planlar", () => {
  it("günleri tarihiyle birlikte taşır", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    expect(sonuc.taslak.dailyPlans).toHaveLength(2);
    expect(sonuc.taslak.dailyPlans[0].date.getDate()).toBe(1);
    expect(sonuc.taslak.dailyPlans[1].date.getDate()).toBe(2);
  });

  it("aktivite alan adlarını ilişkisel sözleşmeye çevirir", () => {
    const sonuc = planiTaslagaCevir(plan());
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    const aktivite = sonuc.taslak.dailyPlans[0].activities[0];
    // gun_plani: name/startTime → DailyPlan: title/time
    expect(aktivite.title).toBe("Kolezyum");
    expect(aktivite.time).toBe("09:00");
    expect(aktivite.endTime).toBe("12:00");
    expect(aktivite.cost).toBe(500);
    expect(aktivite.location).toBe("Roma merkez");
  });

  it("tarihi olmayan günü gün numarasından türetir", () => {
    const gunPlani = JSON.stringify([
      { day: 3, notes: "", activities: [] },
    ]);
    const sonuc = planiTaslagaCevir(plan({ gun_plani: gunPlani }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    // Başlangıç 1 Mayıs; 3. gün = 3 Mayıs.
    expect(sonuc.taslak.dailyPlans[0].date.getDate()).toBe(3);
  });

  it("aynı tarihe düşen ikinci günü atlar", () => {
    // (tripId, date) tekil; ikinci kayıt kısıt hatası verirdi.
    const gunPlani = JSON.stringify([
      { day: 1, date: "2026-05-01", notes: "ilk", activities: [] },
      { day: 2, date: "2026-05-01", notes: "çakışan", activities: [] },
    ]);
    const sonuc = planiTaslagaCevir(plan({ gun_plani: gunPlani }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    expect(sonuc.taslak.dailyPlans).toHaveLength(1);
    expect(sonuc.taslak.dailyPlans[0].notes).toBe("ilk");
    expect(sonuc.uyarilar.some((u) => u.includes("cakismasi"))).toBe(true);
  });

  it("markdown gün planından gün üretmez ama uyarır", () => {
    const sonuc = planiTaslagaCevir(plan({ gun_plani: "### 1. Gün\n- Müze" }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    expect(sonuc.taslak.dailyPlans).toHaveLength(0);
    expect(sonuc.uyarilar).toContain("gun-plani-markdown-atlandi");
  });

  it("gün sayısı aralıktan fazlaysa uyarır", () => {
    const gunPlani = JSON.stringify(
      Array.from({ length: 7 }, (_, i) => ({ day: i + 1, notes: "", activities: [] }))
    );
    const sonuc = planiTaslagaCevir(plan({ gun_plani: gunPlani }));
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    // 1-5 Mayıs = 5 gün; plan 7 gün içeriyor.
    expect(sonuc.uyarilar.some((u) => u.startsWith("gun-sayisi-fazla"))).toBe(true);
  });

  it("boş JSON sütunlarında sorunsuz çalışır", () => {
    const sonuc = planiTaslagaCevir(
      plan({ gun_plani: null, butce_tahmini: null, total_cost: null })
    );
    if (!sonuc.ok) throw new Error("dönüşüm başarısız");

    expect(sonuc.taslak.dailyPlans).toHaveLength(0);
    expect(sonuc.taslak.budgetItems).toHaveLength(0);
    expect(sonuc.taslak.trip.budget).toBeNull();
    expect(sonuc.uyarilar).toHaveLength(0);
  });
});
