import { describe, expect, it } from "vitest";
import {
  ekranAktivitesineCevir,
  ekranGununeCevir,
  gunAnahtari,
  gunFarkiBosMu,
  gunlukPlanFarkiCikar,
  gunGovdesineCevir,
  iliskiselAktiviteyeCevir,
  type EkranGunu,
  type IliskiselGun,
} from "@/lib/gunluk-plan-esitleme";
import type { PlanAktivitesi } from "@/lib/plan-budget";

/**
 * GÜNLÜK PLAN EŞİTLEME (B4 · Adım 3).
 *
 * İki şey korunuyor: `{name, startTime}` ↔ `{title, time}` çevirisinin iki
 * yönde de kayıpsız olması, ve fark hesabının kullanıcının gününü
 * silmemesi.
 */

function aktivite(over: Partial<PlanAktivitesi> = {}): PlanAktivitesi {
  return {
    id: "d1-a1",
    name: "Kolezyum",
    startTime: "09:00",
    endTime: "12:00",
    cost: 500,
    description: "Rehberli tur",
    category: "aktiviteler",
    location: "Roma",
    ...over,
  };
}

function ekranGunu(over: Partial<EkranGunu> = {}): EkranGunu {
  return {
    day: 1,
    date: "2026-10-01",
    activities: [aktivite()],
    notes: "",
    isEmpty: false,
    ...over,
  };
}

function sunucuGunu(over: Partial<IliskiselGun> = {}): IliskiselGun {
  return {
    id: "gun-1",
    date: "2026-10-01T00:00:00.000Z",
    notes: "",
    activities: [
      {
        id: "d1-a1",
        title: "Kolezyum",
        time: "09:00",
        endTime: "12:00",
        cost: 500,
        description: "Rehberli tur",
        category: "aktiviteler",
        location: "Roma",
      },
    ],
    ...over,
  };
}

describe("gunAnahtari", () => {
  it("ISO damgasını ve düz tarihi aynı anahtara indirger", () => {
    // Karşılaştırmanın iki tarafı aynı çözünürlükte olmazsa her gün
    // "değişmiş" görünür ve her kaydetme bütün günleri yeniden yazar.
    expect(gunAnahtari("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
    expect(gunAnahtari("2026-10-01")).toBe("2026-10-01");
    expect(gunAnahtari("")).toBe("");
    expect(gunAnahtari(null)).toBe("");
    expect(gunAnahtari(undefined)).toBe("");
  });
});

describe("şekil çevirisi", () => {
  it("ekran → ilişkisel: name/startTime, title/time olur", () => {
    const k = iliskiselAktiviteyeCevir(aktivite(), 1, 0);

    expect(k.title).toBe("Kolezyum");
    expect(k.time).toBe("09:00");
    expect(k).not.toHaveProperty("name");
    expect(k).not.toHaveProperty("startTime");
  });

  it("ilişkisel → ekran: title/time, name/startTime olur", () => {
    const a = ekranAktivitesineCevir(
      { id: "x", title: "Müze", time: "10:00", cost: 200 },
      1,
      0
    );

    expect(a.name).toBe("Müze");
    expect(a.startTime).toBe("10:00");
    expect(a.cost).toBe(200);
    // Eksik alanlar boş string; ekran bu alanları koşulsuz okuyor.
    expect(a.endTime).toBe("");
    expect(a.location).toBe("");
  });

  it("çeviri iki yönde kayıpsız", () => {
    const once = aktivite();
    const sonra = ekranAktivitesineCevir(iliskiselAktiviteyeCevir(once, 1, 0), 1, 0);
    expect(sonra).toEqual(once);
  });

  it("boş alanlar ilişkisel şekle HİÇ yazılmaz", () => {
    const k = iliskiselAktiviteyeCevir(
      aktivite({ description: "  ", endTime: "", location: "", cost: 0 }),
      1,
      0
    );

    expect(k).not.toHaveProperty("description");
    expect(k).not.toHaveProperty("endTime");
    expect(k).not.toHaveProperty("location");
    expect(k).not.toHaveProperty("cost");
  });

  it("boş aktivite adı 'Aktivite'ye düşer", () => {
    // `dailyActivitySchema.title` `.min(1)`; boş ad isteği 400'e düşürürdü.
    expect(iliskiselAktiviteyeCevir(aktivite({ name: "   " }), 1, 0).title).toBe("Aktivite");
  });

  it("sunucu satırı ekran gününe çevrilir, isEmpty türetilir", () => {
    const g = ekranGununeCevir(sunucuGunu({ activities: [] }), 3);
    expect(g.day).toBe(3);
    expect(g.date).toBe("2026-10-01");
    expect(g.isEmpty).toBe(true);

    const dolu = ekranGununeCevir(sunucuGunu(), 1);
    expect(dolu.isEmpty).toBe(false);
    expect(dolu.activities[0].name).toBe("Kolezyum");
  });

  it("bozuk activities değeri sayfayı düşürmez", () => {
    expect(ekranGununeCevir(sunucuGunu({ activities: "bozuk" }), 1).activities).toEqual([]);
    expect(ekranGununeCevir(sunucuGunu({ activities: null }), 1).activities).toEqual([]);
  });
});

describe("gunlukPlanFarkiCikar", () => {
  it("hiçbir şey değişmediyse üç liste de boş", () => {
    const fark = gunlukPlanFarkiCikar([ekranGunu()], [sunucuGunu()]);

    expect(fark.eklenecek).toEqual([]);
    expect(fark.guncellenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
    expect(gunFarkiBosMu(fark)).toBe(true);
  });

  it("ISO ile düz tarih eşleşir, sahte güncelleme üretmez", () => {
    // Sunucu ISO döndürüyor, ekran "YYYY-MM-DD" taşıyor.
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu({ date: "2026-10-01" })],
      [sunucuGunu({ date: "2026-10-01T00:00:00.000Z" })]
    );
    expect(gunFarkiBosMu(fark)).toBe(true);
  });

  it("sunucuda olmayan tarihi 'eklenecek' sayar", () => {
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu(), ekranGunu({ day: 2, date: "2026-10-02", activities: [] })],
      [sunucuGunu()]
    );

    expect(fark.eklenecek).toHaveLength(1);
    expect(fark.eklenecek[0].date).toBe("2026-10-02");
    expect(fark.guncellenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
  });

  it("ekrandan kalkan günü 'silinecek' sayar", () => {
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu()],
      [sunucuGunu(), sunucuGunu({ id: "gun-2", date: "2026-10-02T00:00:00.000Z" })]
    );

    expect(fark.silinecek).toEqual(["gun-2"]);
  });

  it("aktivite değişince günü güncellenecek sayar ve sunucu kimliğini taşır", () => {
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu({ activities: [aktivite({ cost: 750 })] })],
      [sunucuGunu()]
    );

    expect(fark.guncellenecek).toHaveLength(1);
    expect(fark.guncellenecek[0].id).toBe("gun-1");
    expect(fark.guncellenecek[0].activities[0].cost).toBe(750);
  });

  it("yalnızca not değişince de güncellenecek sayar", () => {
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu({ notes: "Erken kalk" })],
      [sunucuGunu({ notes: "" })]
    );
    expect(fark.guncellenecek).toHaveLength(1);
  });

  it("aktivite SIRASI değişince güncellenecek sayar", () => {
    // Gün içindeki akış anlamlı; sıra değişikliği gerçek bir değişiklik.
    const a = aktivite({ id: "a", name: "İlk" });
    const b = aktivite({ id: "b", name: "İkinci" });

    const fark = gunlukPlanFarkiCikar(
      [ekranGunu({ activities: [b, a] })],
      [
        sunucuGunu({
          activities: [
            iliskiselAktiviteyeCevir(a, 1, 0),
            iliskiselAktiviteyeCevir(b, 1, 1),
          ],
        }),
      ]
    );

    expect(fark.guncellenecek).toHaveLength(1);
  });

  it("DEĞİŞMEYEN günler istek üretmez", () => {
    const gunler = [
      ekranGunu({ day: 1, date: "2026-10-01" }),
      ekranGunu({ day: 2, date: "2026-10-02", activities: [] }),
      ekranGunu({ day: 3, date: "2026-10-03", activities: [] }),
    ];
    const sunucu = [
      sunucuGunu({ id: "g1", date: "2026-10-01T00:00:00.000Z" }),
      sunucuGunu({ id: "g2", date: "2026-10-02T00:00:00.000Z", activities: [] }),
      sunucuGunu({ id: "g3", date: "2026-10-03T00:00:00.000Z", activities: [] }),
    ];

    // Yalnızca 2. günün notu değişiyor.
    gunler[1] = { ...gunler[1], notes: "Serbest gün" };

    const fark = gunlukPlanFarkiCikar(gunler, sunucu);
    expect(fark.guncellenecek).toHaveLength(1);
    expect(fark.guncellenecek[0].id).toBe("g2");
    expect(fark.eklenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
  });

  it("tarihsiz günü eşitlemeye SOKMAZ ama bildirir", () => {
    // Uç `date` alanını zorunlu tutuyor. Sessizce atlamak, kullanıcıya
    // "kaydedildi" deyip veriyi kaybetmek olurdu.
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu(), ekranGunu({ day: 2, date: "" })],
      [sunucuGunu()]
    );

    expect(fark.tarihsiz).toEqual([2]);
    expect(fark.eklenecek).toEqual([]);
    expect(fark.silinecek).toEqual([]);
  });

  it("ekranda aynı tarih iki kez varsa ikincisi yok sayılır", () => {
    // POST `@@unique([tripId, date])` yüzünden 409 döner ve kaydetme
    // yarıda kalırdı.
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu(), ekranGunu({ day: 2, date: "2026-10-01", activities: [] })],
      []
    );

    expect(fark.eklenecek).toHaveLength(1);
    expect(fark.silinecek).toEqual([]);
  });

  it("ekran boşaltılırsa sunucudaki günler silinir", () => {
    const fark = gunlukPlanFarkiCikar([], [sunucuGunu(), sunucuGunu({ id: "g2", date: "2026-10-02" })]);
    expect(fark.silinecek).toEqual(["gun-1", "g2"]);
  });

  it("sunucu boşsa hepsi eklenecek olur", () => {
    const fark = gunlukPlanFarkiCikar(
      [ekranGunu(), ekranGunu({ day: 2, date: "2026-10-02" })],
      []
    );

    expect(fark.eklenecek).toHaveLength(2);
    expect(fark.silinecek).toEqual([]);
    expect(gunFarkiBosMu(fark)).toBe(false);
  });
});

describe("gunGovdesineCevir", () => {
  it("uçun beklediği gövdeyi üretir", () => {
    const govde = gunGovdesineCevir(ekranGunu({ notes: "not" }));

    expect(govde.date).toBe("2026-10-01");
    expect(govde.notes).toBe("not");
    expect(govde.activities[0].title).toBe("Kolezyum");
  });
});

/* ========================================================================== */
/* Koordinat taşıması                                                         */
/* ========================================================================== */

describe("koordinat taşıması", () => {
  /**
   * B4 · Adım 5'te eklendi.
   *
   * NEDEN KRİTİK: harita sayfası rotayı aktivite koordinatlarından çiziyor
   * ve taşınmış planlarda `gun_plani` artık `DailyPlan` satırlarından
   * TÜRETİLİYOR. Bu çeviri koordinatı düşürseydi, taşınan her planın
   * haritası — kullanıcı hiçbir şey yapmadan — boşalırdı. Günlük
   * planlayıcıdaki her kaydetme de aynı silmeyi tekrar ederdi.
   */
  it("ilişkisel yönde koordinatı taşır", () => {
    const kayit = iliskiselAktiviteyeCevir(
      {
        id: "d1-a1",
        name: "Kolezyum",
        startTime: "09:00",
        endTime: "11:00",
        cost: 0,
        category: "gezi",
        location: "Kolezyum",
        coordinates: { lat: 41.89, lng: 12.49 },
      },
      1,
      0
    );

    expect(kayit.coordinates).toEqual({ lat: 41.89, lng: 12.49 });
  });

  it("ekran yönünde koordinatı taşır", () => {
    const aktivite = ekranAktivitesineCevir(
      { title: "Kolezyum", coordinates: { lat: 41.89, lng: 12.49 } },
      1,
      0
    );

    expect(aktivite.coordinates).toEqual({ lat: 41.89, lng: 12.49 });
  });

  it("GEÇERSİZ koordinatı düşürür", () => {
    // Bozuk bir çifti geri yazmak, ucun Zod şemasına takılıp bütün günü
    // kaydedilemez hale getirirdi; aktivite koordinatsız kalıyor.
    const aktivite = ekranAktivitesineCevir(
      { title: "Kolezyum", coordinates: { lat: 999, lng: 12.49 } },
      1,
      0
    );

    expect(aktivite.coordinates).toBeUndefined();
  });

  it("gidiş-dönüş çevirisi koordinatı KORUYOR", () => {
    const ekran = ekranAktivitesineCevir(
      { title: "Kolezyum", time: "09:00", coordinates: { lat: 41.89, lng: 12.49 } },
      1,
      0
    );

    const geri = iliskiselAktiviteyeCevir(ekran, 1, 0);

    expect(geri).toMatchObject({
      title: "Kolezyum",
      time: "09:00",
      coordinates: { lat: 41.89, lng: 12.49 },
    });
  });
});
