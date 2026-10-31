import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AHMET,
  BURCU,
  ikiKullanicili,
  istek,
  jsonIstek,
  oturum,
  oturumYok,
  params,
  yanit,
} from "../helpers/route-harness";
import { sahtePrismaKur, type SahteVeritabani } from "../helpers/fake-prisma";

/**
 * YETKİLENDİRME TESTLERİ.
 *
 * Denetimde bulunan en ciddi açık şuydu: rotalar `session.user.id as string`
 * yazıp bu değeri doğrudan Prisma `where`ine koyuyordu; değer `undefined`
 * olduğunda Prisma filtreyi düşürüyor ve sahiplik koşulu tamamen kalkıyordu.
 * Tip sistemi bunu göremiyordu (alan `string` ilan edilmişti), lint göremezdi,
 * saf fonksiyon testi de göremezdi — çünkü hata handler'ın İÇİNDEYDİ.
 *
 * Bu dosya tam olarak o boşluğu kapatıyor: her veri ucu için "Burcu, Ahmet'in
 * kaydına erişebiliyor mu?" sorusunu soruyor. Sahte Prisma, gerçeğinin
 * `undefined = filtre yok` semantiğini birebir taklit ettiği için filtreyi
 * unutan bir rota burada YAKALANIR.
 *
 * Kural: "yok" ile "senin değil" ayrımı yapılmıyor; ikisi de 404. 403 dönmek
 * id'yi bilen birine o kaydın var olduğunu doğrular.
 */

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
  authMock: { requireUser: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

vi.mock("@/lib/auth-session", () => ({
  requireUser: authMock.requireUser,
}));

/** Testin veritabanını kurar ve oturumu belirler. */
function kur(kullaniciId: string | null, veri: SahteVeritabani = ikiKullanicili()) {
  const { prisma, kayitlar } = sahtePrismaKur(veri);
  prismaMock.current = prisma;

  authMock.requireUser.mockResolvedValue(
    kullaniciId ? oturum(kullaniciId) : oturumYok()
  );

  return { kayitlar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ========================================================================== */
/* /api/trip                                                                  */
/* ========================================================================== */

describe("/api/trip", () => {
  it("başkasının seyahatini okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/route");

    const { status } = await yanit(await GET(istek("/api/trip?id=gezi-ahmet")));
    expect(status).toBe(404);
  });

  it("kendi seyahatini okur", async () => {
    kur(AHMET);
    const { GET } = await import("@/app/api/trip/route");

    const { status, body } = await yanit(await GET(istek("/api/trip?id=gezi-ahmet")));
    expect(status).toBe(200);
    expect((body.trip as { city: string }).city).toBe("Roma");
  });

  it("listede yalnızca kendi seyahatlerini görür", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/route");

    const { body } = await yanit(await GET(istek("/api/trip")));
    const trips = body.trips as Array<{ id: string }>;
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toBe("gezi-burcu");
  });

  it("başkasının seyahatini güncellemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/route");

    const { status } = await yanit(
      await PUT(jsonIstek("/api/trip", "PUT", { id: "gezi-ahmet", title: "Ele geçirildi" }))
    );

    expect(status).toBe(404);
    const ahmetinGezisi = kayitlar("trip").find((t) => t.id === "gezi-ahmet");
    expect(ahmetinGezisi?.title).toBe("Roma Gezisi");
  });

  it("başkasının seyahatini silmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/trip/route");

    const { status } = await yanit(
      await DELETE(istek("/api/trip?id=gezi-ahmet", "DELETE"))
    );

    expect(status).toBe(404);
    expect(kayitlar("trip").some((t) => t.id === "gezi-ahmet")).toBe(true);
  });

  it("oturum yoksa 401 döner", async () => {
    kur(null);
    const { GET } = await import("@/app/api/trip/route");

    const { status } = await yanit(await GET(istek("/api/trip")));
    expect(status).toBe(401);
  });
});

/* ========================================================================== */
/* /api/trip/budget                                                           */
/* ========================================================================== */

describe("/api/trip/budget", () => {
  it("başkasının seyahatinin bütçesini okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/budget/route");

    const { status } = await yanit(
      await GET(istek("/api/trip/budget?tripId=gezi-ahmet"))
    );
    expect(status).toBe(404);
  });

  it("başkasının seyahatine bütçe kalemi eklemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { POST } = await import("@/app/api/trip/budget/route");

    const { status } = await yanit(
      await POST(
        jsonIstek("/api/trip/budget", "POST", {
          tripId: "gezi-ahmet",
          category: "yemek",
          description: "Sızma",
          amount: 100,
        })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("budgetItem").some((k) => k.description === "Sızma")).toBe(false);
  });

  it("başkasının bütçe kalemini güncellemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/budget/route");

    const { status } = await yanit(
      await PUT(jsonIstek("/api/trip/budget", "PUT", { id: "kalem-ahmet", amount: 1 }))
    );

    // 403 DEĞİL 404: "senin değil" demek, id'yi bilen birine o kaydın var
    // olduğunu doğrular. İlişkisel modelin tamamı bu kuralı uyguluyor.
    expect(status).toBe(404);
    expect(kayitlar("budgetItem").find((k) => k.id === "kalem-ahmet")?.amount).toBe(4000);
  });

  it("başkasının bütçe kalemini silmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/trip/budget/route");

    const { status } = await yanit(
      await DELETE(istek("/api/trip/budget?id=kalem-ahmet", "DELETE"))
    );

    expect(status).toBe(404);
    expect(kayitlar("budgetItem").some((k) => k.id === "kalem-ahmet")).toBe(true);
  });

  it("kendi kalemini günceller", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/budget/route");

    const { status } = await yanit(
      await PUT(jsonIstek("/api/trip/budget", "PUT", { id: "kalem-burcu", amount: 3500 }))
    );

    expect(status).toBe(200);
    expect(kayitlar("budgetItem").find((k) => k.id === "kalem-burcu")?.amount).toBe(3500);
  });
});

/* ========================================================================== */
/* /api/trip/daily-plans                                                      */
/* ========================================================================== */

describe("/api/trip/daily-plans", () => {
  it("başkasının günlük planlarını okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/daily-plans/route");

    const { status } = await yanit(
      await GET(istek("/api/trip/daily-plans?tripId=gezi-ahmet"))
    );
    expect(status).toBe(404);
  });

  it("başkasının seyahatine günlük plan eklemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { POST } = await import("@/app/api/trip/daily-plans/route");

    const { status } = await yanit(
      await POST(
        jsonIstek("/api/trip/daily-plans", "POST", {
          tripId: "gezi-ahmet",
          date: "2026-05-02",
          activities: [],
        })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("dailyPlan")).toHaveLength(2);
  });

  it("başkasının günlük planını güncellemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/daily-plans/route");

    const { status } = await yanit(
      await PUT(
        jsonIstek("/api/trip/daily-plans", "PUT", { id: "gun-ahmet", notes: "Sızma" })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("dailyPlan").find((g) => g.id === "gun-ahmet")?.notes).toBeNull();
  });

  it("başkasının günlük planını silmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/trip/daily-plans/route");

    const { status } = await yanit(
      await DELETE(istek("/api/trip/daily-plans?id=gun-ahmet", "DELETE"))
    );

    expect(status).toBe(404);
    expect(kayitlar("dailyPlan").some((g) => g.id === "gun-ahmet")).toBe(true);
  });
});

/* ========================================================================== */
/* /api/trip/accommodations                                                   */
/* ========================================================================== */

describe("/api/trip/accommodations", () => {
  it("başkasının konaklamalarını okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/accommodations/route");

    const { status } = await yanit(
      await GET(istek("/api/trip/accommodations?tripId=gezi-ahmet"))
    );
    expect(status).toBe(404);
  });

  it("başkasının konaklamasını güncellemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/accommodations/route");

    const { status } = await yanit(
      await PUT(
        jsonIstek("/api/trip/accommodations", "PUT", {
          id: "konaklama-ahmet",
          name: "Ele geçirildi",
        })
      )
    );

    expect(status).toBe(404);
    expect(
      kayitlar("accommodation").find((k) => k.id === "konaklama-ahmet")?.name
    ).toBe("Hotel Roma");
  });

  it("başkasının konaklamasını silmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/trip/accommodations/route");

    const { status } = await yanit(
      await DELETE(istek("/api/trip/accommodations?id=konaklama-ahmet", "DELETE"))
    );

    expect(status).toBe(404);
    expect(kayitlar("accommodation").some((k) => k.id === "konaklama-ahmet")).toBe(true);
  });
});

/* ========================================================================== */
/* /api/trip/transportations                                                  */
/* ========================================================================== */

describe("/api/trip/transportations", () => {
  it("başkasının ulaşım kayıtlarını okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/trip/transportations/route");

    const { status } = await yanit(
      await GET(istek("/api/trip/transportations?tripId=gezi-ahmet"))
    );
    expect(status).toBe(404);
  });

  it("başkasının ulaşım kaydını güncellemez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PUT } = await import("@/app/api/trip/transportations/route");

    const { status } = await yanit(
      await PUT(
        jsonIstek("/api/trip/transportations", "PUT", {
          id: "ulasim-ahmet",
          price: 1,
        })
      )
    );

    expect(status).toBe(404);
    expect(
      kayitlar("transportation").find((u) => u.id === "ulasim-ahmet")?.price
    ).toBe(4000);
  });
});

/* ========================================================================== */
/* /api/plan-detail/[id]                                                      */
/* ========================================================================== */

describe("/api/plan-detail/[id]", () => {
  it("başkasının planını okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/plan-detail/[id]/route");

    const { status } = await yanit(
      await GET(istek("/api/plan-detail/plan-ahmet"), params({ id: "plan-ahmet" }))
    );
    // 403 DEĞİL 404: "senin değil" demek, id'yi bilen birine o planın var
    // olduğunu doğrular. İlişkisel model uçlarıyla aynı kural.
    expect(status).toBe(404);
  });

  it("başkasının planının bütçesini değiştirmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PATCH } = await import("@/app/api/plan-detail/[id]/route");

    const { status } = await yanit(
      await PATCH(
        jsonIstek("/api/plan-detail/plan-ahmet", "PATCH", { total_cost: 1 }),
        params({ id: "plan-ahmet" })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("tripPlan").find((p) => p.id === "plan-ahmet")?.total_cost).toBe(10000);
  });

  it("başkasının günlük planını değiştirmez", async () => {
    kur(BURCU);
    const { PUT } = await import("@/app/api/plan-detail/[id]/route");

    const { status } = await yanit(
      await PUT(
        jsonIstek("/api/plan-detail/plan-ahmet", "PUT", { daily_plans: "[]" }),
        params({ id: "plan-ahmet" })
      )
    );
    expect(status).toBe(404);
  });

  it("kendi planını okur", async () => {
    kur(AHMET);
    const { GET } = await import("@/app/api/plan-detail/[id]/route");

    const { status, body } = await yanit(
      await GET(istek("/api/plan-detail/plan-ahmet"), params({ id: "plan-ahmet" }))
    );

    expect(status).toBe(200);
    // Sahip kimliği yanıtta yer almamalı.
    expect(body.plan).not.toHaveProperty("userId");
  });
});

/* ========================================================================== */
/* /api/my-plans                                                              */
/* ========================================================================== */

describe("/api/my-plans", () => {
  it("yalnızca kendi planlarını listeler", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/my-plans/route");

    const { body } = await yanit(await GET());
    const plans = body.plans as Array<{ id: string }>;

    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("plan-burcu");
  });

  it("taşınma alanlarını döndürür (B4 çift yol ayrımı)", async () => {
    // Bütçe sayfası hangi veri yolunu kullanacağına `migratedAt`/`tripId`
    // ile karar veriyor. Bu alanlar `select`ten düşerse sayfa TAŞINMIŞ bir
    // planı taşınmamış sanıp JSON sütununu okur ve kullanıcının ilişkisel
    // tabloda duran kalemleri ekranda hiç görünmez.
    kur(BURCU);
    const { GET } = await import("@/app/api/my-plans/route");

    const { body } = await yanit(await GET());
    const plans = body.plans as Array<Record<string, unknown>>;

    expect(plans[0]).toHaveProperty("migratedAt");
    expect(plans[0]).toHaveProperty("tripId");
  });

  it("başkasının planını silmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/my-plans/[id]/route");

    const { status } = await yanit(
      await DELETE(istek("/api/my-plans/plan-ahmet", "DELETE"), params({ id: "plan-ahmet" }))
    );

    expect(status).toBe(404);
    expect(kayitlar("tripPlan").some((p) => p.id === "plan-ahmet")).toBe(true);
  });

  it("kendi planını siler", async () => {
    const { kayitlar } = kur(BURCU);
    const { DELETE } = await import("@/app/api/my-plans/[id]/route");

    const { status } = await yanit(
      await DELETE(istek("/api/my-plans/plan-burcu", "DELETE"), params({ id: "plan-burcu" }))
    );

    expect(status).toBe(200);
    expect(kayitlar("tripPlan").some((p) => p.id === "plan-burcu")).toBe(false);
  });
});

/* ========================================================================== */
/* /api/trip-plans/[id]/status                                                */
/* ========================================================================== */

describe("/api/trip-plans/[id]/status", () => {
  it("başkasının planının durumunu değiştirmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { PATCH } = await import("@/app/api/trip-plans/[id]/status/route");

    const { status } = await yanit(
      await PATCH(
        jsonIstek("/api/trip-plans/plan-ahmet/status", "PATCH", { status: "CANCELLED" }),
        params({ id: "plan-ahmet" })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("tripPlan").find((p) => p.id === "plan-ahmet")?.status).toBe("PLANNED");
  });
});

/* ========================================================================== */
/* /api/conversation/save                                                     */
/* ========================================================================== */

describe("/api/conversation/save", () => {
  it("başkasının seyahatine konuşma kaydetmez", async () => {
    const { kayitlar } = kur(BURCU);
    const { POST } = await import("@/app/api/conversation/save/route");

    const { status } = await yanit(
      await POST(
        jsonIstek("/api/conversation/save", "POST", {
          tripId: "gezi-ahmet",
          messages: [{ role: "user", content: "merhaba" }],
        })
      )
    );

    expect(status).toBe(404);
    expect(kayitlar("aiConversation")).toHaveLength(0);
  });

  it("başkasının seyahatinin konuşmalarını okumaz", async () => {
    kur(BURCU);
    const { GET } = await import("@/app/api/conversation/save/route");

    const { status } = await yanit(
      await GET(istek("/api/conversation/save?tripId=gezi-ahmet"))
    );
    expect(status).toBe(404);
  });
});

/* ========================================================================== */
/* Regresyon: filtre düşerse test kırmızıya döner                             */
/* ========================================================================== */

describe("sahte Prisma, Prisma semantiğini taklit ediyor", () => {
  it("undefined filtre DÜŞER (asıl açığın kaynağı)", async () => {
    const { prisma } = sahtePrismaKur(ikiKullanicili());
    const client = prisma as unknown as {
      trip: {
        findFirst: (a: unknown) => Promise<{ id: string } | null>;
      };
    };

    // Rota `userId` yerine undefined geçerse filtre kalkar ve BAŞKASININ
    // kaydı döner. Sahte istemci bunu gizlemiyor; testler bu davranış
    // üzerine kurulu.
    const sizinti = await client.trip.findFirst({
      where: { id: "gezi-ahmet", userId: undefined },
    });
    expect(sizinti?.id).toBe("gezi-ahmet");

    // Doğru filtre uygulandığında kayıt gelmiyor.
    const engellendi = await client.trip.findFirst({
      where: { id: "gezi-ahmet", userId: BURCU },
    });
    expect(engellendi).toBeNull();
  });

  it("null filtre UYGULANIR", async () => {
    const { prisma } = sahtePrismaKur({
      tripPlan: [
        { id: "a", userId: "u1", migratedAt: null },
        { id: "b", userId: "u1", migratedAt: new Date() },
      ],
    });
    const client = prisma as unknown as {
      tripPlan: { findMany: (a: unknown) => Promise<Array<{ id: string }>> };
    };

    const tasinmamislar = await client.tripPlan.findMany({
      where: { migratedAt: null },
    });
    expect(tasinmamislar.map((p) => p.id)).toEqual(["a"]);
  });
});
