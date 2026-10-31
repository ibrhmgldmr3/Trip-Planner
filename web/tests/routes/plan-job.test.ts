import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AHMET,
  BURCU,
  istek,
  jsonIstek,
  oturum,
  oturumYok,
  params,
  yanit,
} from "../helpers/route-harness";
import { sahtePrismaKur } from "../helpers/fake-prisma";

/**
 * ARKA PLAN PLAN ÜRETİMİ (Aşama 3).
 *
 * Üretimin kendisi (LLM zinciri) burada çalıştırılmıyor — `plan-generation`
 * modülü taklit ediliyor. Test edilen şey iş yaşam döngüsü:
 *   - POST planı DÖNDÜRMÜYOR, 202 + jobId dönüyor
 *   - Aynı anda ikinci üretim başlatılmıyor
 *   - Başkasının işi sorgulanamıyor
 *   - Üretim hatası işi FAILED yapıyor, sessizce kaybolmuyor
 *   - Asılı kalmış iş temizleniyor
 */

const { prismaMock, authMock, uretimMock, sinirMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
  authMock: { requireUser: vi.fn() },
  uretimMock: { planUret: vi.fn() },
  sinirMock: { rateLimitAsync: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

vi.mock("@/lib/auth-session", () => ({ requireUser: authMock.requireUser }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: sinirMock.rateLimitAsync,
  rateLimit: () => ({ success: true, remaining: 5, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/plan-generation", () => ({
  planUret: uretimMock.planUret,
  PlanUretilemediHatasi: class PlanUretilemediHatasi extends Error {},
}));

// `after()` testte hemen çalışsın: gerçek Next runtime'ında yanıt
// gönderildikten sonra çalışıyor, burada senkron yürütmek yeterli.
vi.mock("next/server", async (asilModul) => {
  const gercek = await asilModul<typeof import("next/server")>();
  return {
    ...gercek,
    after: (fn: () => unknown) => {
      void Promise.resolve(fn());
    },
  };
});

const GECERLI_ISTEK = {
  city: "Roma",
  country: "İtalya",
  startDate: "2026-05-01",
  endDate: "2026-05-05",
};

function kur(kullaniciId: string | null, veri: Record<string, Record<string, unknown>[]> = {}) {
  const { prisma, kayitlar } = sahtePrismaKur({
    user: [
      { id: AHMET, email: "ahmet@ornek.test" },
      { id: BURCU, email: "burcu@ornek.test" },
    ],
    planJob: [],
    tripPlan: [],
    ...veri,
  });

  prismaMock.current = prisma;
  authMock.requireUser.mockResolvedValue(
    kullaniciId ? oturum(kullaniciId) : oturumYok()
  );
  sinirMock.rateLimitAsync.mockResolvedValue({
    success: true,
    remaining: 4,
    retryAfter: 0,
  });

  return { kayitlar };
}

/** `after()` içindeki işin bitmesini bekler. */
async function isBitsin() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/trip-plan-model", () => {
  it("planı döndürmez, 202 + jobId döner", async () => {
    const { kayitlar } = kur(AHMET);
    uretimMock.planUret.mockResolvedValue({
      tripPlanId: "yeni-plan",
      format: "structured",
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status, body } = await yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK))
    );

    expect(status).toBe(202);
    expect(body.jobId).toBeTruthy();
    // Sözleşme değişti: yanıtta plan YOK.
    expect(body.plan).toBeUndefined();
    expect(kayitlar("planJob")).toHaveLength(1);
  });

  it("işi arka planda çalıştırıp SUCCEEDED yapar", async () => {
    const { kayitlar } = kur(AHMET);
    uretimMock.planUret.mockResolvedValue({
      tripPlanId: "yeni-plan",
      format: "structured",
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK));
    await isBitsin();

    const is = kayitlar("planJob")[0];
    expect(is.status).toBe("SUCCEEDED");
    expect(is.tripPlanId).toBe("yeni-plan");
    expect(is.finishedAt).toBeTruthy();
  });

  it("üretim hatası işi FAILED yapar; hata sessizce kaybolmaz", async () => {
    const { kayitlar } = kur(AHMET);
    uretimMock.planUret.mockRejectedValue(new Error("sağlayıcı düştü"));

    const { POST } = await import("@/app/api/trip-plan-model/route");
    await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK));
    await isBitsin();

    const is = kayitlar("planJob")[0];
    expect(is.status).toBe("FAILED");
    expect(is.error).toBeTruthy();
    // Teknik ayrıntı istemciye sızmıyor.
    expect(String(is.error)).not.toContain("sağlayıcı düştü");
  });

  it("devam eden iş varken YENİ iş açmaz", async () => {
    const { kayitlar } = kur(AHMET, {
      planJob: [
        {
          id: "devam-eden",
          userId: AHMET,
          status: "RUNNING",
          request: {},
          createdAt: new Date(),
          step: "yapilandirilmis-uretim",
          tripPlanId: null,
          error: null,
          finishedAt: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status, body } = await yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK))
    );

    expect(status).toBe(202);
    expect(body.jobId).toBe("devam-eden");
    // Kota ve sağlayıcı maliyeti boşa gitmiyor.
    expect(kayitlar("planJob")).toHaveLength(1);
    expect(uretimMock.planUret).not.toHaveBeenCalled();
    // SAYAÇ HİÇ ARTMIYOR: kota kontrolü eskiden handler'ın ilk satırındaydı
    // ve devam eden işe bağlanan istek de bir hak yakıyordu. Saatlik hak 5;
    // sabırsızlanıp üç kez tıklamak hakkın çoğunu HİÇ PLAN ÜRETMEDEN
    // harcıyordu.
    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
  });

  it("8 dakikadır süren iş hâlâ 'devam eden' sayılır", async () => {
    // REGRESYON: "devam eden" penceresi 6 dakika, "asılı kalmış" eşiği 10
    // dakikaydı. Aradaki 4 dakikada iş ne devam eden sayılıyor ne ölü
    // sayılıyordu — ama hâlâ RUNNING'di. Kullanıcı o pencerede tekrar
    // denediğinde İKİNCİ bir LLM zinciri başlıyordu. İki eşik artık tek
    // sabite bağlı.
    const { kayitlar } = kur(AHMET, {
      planJob: [
        {
          id: "sekiz-dakikalik",
          userId: AHMET,
          status: "RUNNING",
          request: {},
          createdAt: new Date(Date.now() - 8 * 60 * 1000),
          step: "agentic-uretim",
          tripPlanId: null,
          error: null,
          finishedAt: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status, body } = await yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK))
    );

    expect(status).toBe(202);
    expect(body.jobId).toBe("sekiz-dakikalik");
    expect(kayitlar("planJob")).toHaveLength(1);
    expect(uretimMock.planUret).not.toHaveBeenCalled();
  });

  it("geçersiz gövde kotadan hak yakmaz", async () => {
    const { kayitlar } = kur(AHMET);

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status } = await yanit(
      // `city` zorunlu; şema reddediyor.
      await POST(jsonIstek("/api/trip-plan-model", "POST", { country: "İtalya" }))
    );

    expect(status).toBe(400);
    expect(kayitlar("planJob")).toHaveLength(0);
    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
  });

  it("ters tarih aralığı kotadan hak yakmaz", async () => {
    kur(AHMET);

    const { POST } = await import("@/app/api/trip-plan-model/route");
    await POST(
      jsonIstek("/api/trip-plan-model", "POST", {
        ...GECERLI_ISTEK,
        startDate: "2026-05-05",
        endDate: "2026-05-01",
      })
    );

    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
  });

  it("üretim gerçekten başlatıldığında kota tüketilir", async () => {
    kur(AHMET);
    uretimMock.planUret.mockResolvedValue({
      tripPlanId: "yeni-plan",
      format: "structured",
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK));

    expect(sinirMock.rateLimitAsync).toHaveBeenCalledTimes(1);
  });

  it("ters tarih aralığını üretime hiç sokmaz", async () => {
    const { kayitlar } = kur(AHMET);

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status } = await yanit(
      await POST(
        jsonIstek("/api/trip-plan-model", "POST", {
          ...GECERLI_ISTEK,
          startDate: "2026-05-05",
          endDate: "2026-05-01",
        })
      )
    );

    expect(status).toBe(400);
    expect(kayitlar("planJob")).toHaveLength(0);
    expect(uretimMock.planUret).not.toHaveBeenCalled();
  });

  it("kota dolduğunda 429 döner ve iş açmaz", async () => {
    const { kayitlar } = kur(AHMET);
    sinirMock.rateLimitAsync.mockResolvedValue({
      success: false,
      remaining: 0,
      retryAfter: 600,
    });

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status } = await yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK))
    );

    expect(status).toBe(429);
    expect(kayitlar("planJob")).toHaveLength(0);
  });

  it("oturum yoksa 401 döner", async () => {
    kur(null);

    const { POST } = await import("@/app/api/trip-plan-model/route");
    const { status } = await yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", GECERLI_ISTEK))
    );

    expect(status).toBe(401);
  });
});

describe("GET /api/plan-jobs/[id]", () => {
  it("başkasının işini göstermez", async () => {
    kur(BURCU, {
      planJob: [
        {
          id: "ahmetin-isi",
          userId: AHMET,
          status: "SUCCEEDED",
          request: {},
          createdAt: new Date(),
          step: "tamamlandi",
          tripPlanId: "plan-1",
          error: null,
          finishedAt: new Date(),
        },
      ],
    });

    const { GET } = await import("@/app/api/plan-jobs/[id]/route");
    const { status } = await yanit(
      await GET(istek("/api/plan-jobs/ahmetin-isi"), params({ id: "ahmetin-isi" }))
    );

    expect(status).toBe(404);
  });

  it("devam eden iş için yalnızca durum döner", async () => {
    kur(AHMET, {
      planJob: [
        {
          id: "is-1",
          userId: AHMET,
          status: "RUNNING",
          request: {},
          createdAt: new Date(),
          step: "yapilandirilmis-uretim",
          tripPlanId: null,
          error: null,
          finishedAt: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/plan-jobs/[id]/route");
    const { status, body } = await yanit(
      await GET(istek("/api/plan-jobs/is-1"), params({ id: "is-1" }))
    );

    expect(status).toBe(200);
    expect((body.job as { status: string }).status).toBe("RUNNING");
    expect(body.plan).toBeUndefined();
  });

  it("biten iş için planı da döner", async () => {
    kur(AHMET, {
      planJob: [
        {
          id: "is-2",
          userId: AHMET,
          status: "SUCCEEDED",
          request: {},
          createdAt: new Date(),
          step: "tamamlandi",
          tripPlanId: "plan-1",
          error: null,
          finishedAt: new Date(),
        },
      ],
      tripPlan: [
        {
          id: "plan-1",
          userId: AHMET,
          city: "Roma",
          country: "İtalya",
          startDate: new Date(2026, 4, 1),
          endDate: new Date(2026, 4, 5),
          duration: "5 gün",
          raw_markdown: "# Roma",
          raw_html: "<h1>Roma</h1>",
          ai_model: "test-model",
          plan_json: null,
          plan_schema_version: 1,
        },
      ],
    });

    const { GET } = await import("@/app/api/plan-jobs/[id]/route");
    const { status, body } = await yanit(
      await GET(istek("/api/plan-jobs/is-2"), params({ id: "is-2" }))
    );

    expect(status).toBe(200);
    const plan = body.plan as { city: string; tripPlanId: string; markdown: string };
    expect(plan.city).toBe("Roma");
    expect(plan.tripPlanId).toBe("plan-1");
    expect(plan.markdown).toBe("# Roma");
  });

  it("asılı kalmış işi FAILED'a çeker", async () => {
    // Sunucu üretim ortasında yeniden başlarsa iş RUNNING'de kalır ve
    // kullanıcı sonsuza kadar "hazırlanıyor" görürdü.
    const eski = new Date(Date.now() - 30 * 60 * 1000);

    const { kayitlar } = kur(AHMET, {
      planJob: [
        {
          id: "asili",
          userId: AHMET,
          status: "RUNNING",
          request: {},
          createdAt: eski,
          step: "yapilandirilmis-uretim",
          tripPlanId: null,
          error: null,
          finishedAt: null,
        },
      ],
    });

    const { GET } = await import("@/app/api/plan-jobs/[id]/route");
    const { body } = await yanit(
      await GET(istek("/api/plan-jobs/asili"), params({ id: "asili" }))
    );

    expect((body.job as { status: string }).status).toBe("FAILED");
    expect(kayitlar("planJob")[0].error).toContain("zaman aşımına");
  });

  it("bilinmeyen iş için 404 döner", async () => {
    kur(AHMET);

    const { GET } = await import("@/app/api/plan-jobs/[id]/route");
    const { status } = await yanit(
      await GET(istek("/api/plan-jobs/yok"), params({ id: "yok" }))
    );

    expect(status).toBe(404);
  });
});
