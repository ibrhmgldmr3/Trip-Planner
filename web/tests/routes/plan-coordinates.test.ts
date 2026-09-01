import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AHMET,
  BURCU,
  ikiKullanicili,
  jsonIstek,
  oturum,
  oturumYok,
  params,
  yanit,
} from "../helpers/route-harness";
import { sahtePrismaKur, type SahteVeritabani } from "../helpers/fake-prisma";

/**
 * `POST /api/plan-detail/[id]/coordinates` — Faz D.
 *
 * Bu ucun üç kritik davranışı var ve üçü de burada sabitleniyor:
 *  1. SAHİPLİK. Uç bir yazma ucu ve maliyetli (her çağrı Google Geocoding
 *     kotası harcıyor); başkasının planı üzerinde çalıştırılamamalı.
 *  2. YALNIZCA `gun_plani`. `PUT /api/plan-detail/[id]` gün planını
 *     kaydederken bütçeyi de yeniden yazıyor. Bu uç bunu YAPMAMALI —
 *     kullanıcı haritada rota isterken bütçesi sessizce değişmemeli.
 *  3. HİÇBİR ŞEY ÇÖZÜLEMEZSE YAZMA YOK. Gereksiz bir UPDATE `updatedAt`i
 *     kaydırıp planı "değişmiş" gösterirdi.
 */

// Hız sınırlayıcı gerçek: sayaç süreç belleğinde ve dosyadaki testler aynı
// kullanıcıyla defalarca çağırıyor. Varsayılan 10/saat sınırına dayanmak
// testi "kaç tane it() var" sorusuna bağlar; sınırı burada yükseltiyoruz.
// (Sınırın KENDİSİ ayrı bir konu — bu dosya onu test etmiyor.)
process.env.GEOCODE_RATE_LIMIT_PER_HOUR = "1000";

const { prismaMock, authMock, geocodeMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
  authMock: { requireUser: vi.fn() },
  geocodeMock: {
    yapilandirilmis: vi.fn(),
    ekle: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

vi.mock("@/lib/auth-session", () => ({
  requireUser: authMock.requireUser,
}));

// Gerçek geocoding ağa çıkardı; davranışını burada sürüyoruz.
vi.mock("@/lib/geocoding", () => ({
  geocodingYapilandirilmisMi: () => geocodeMock.yapilandirilmis(),
  gunlereKoordinatEkle: (...args: unknown[]) => geocodeMock.ekle(...args),
}));

/** Aktiviteli bir gün planı taşıyan başlangıç verisi. */
function veriKur(): SahteVeritabani {
  const veri = ikiKullanicili();

  veri.tripPlan[0].gun_plani = JSON.stringify([
    {
      day: 1,
      date: "2026-05-01",
      notes: "",
      activities: [
        {
          id: "d1-a1",
          name: "Kolezyum",
          startTime: "09:00",
          endTime: "11:00",
          cost: 0,
          description: "",
          category: "gezi",
          location: "Kolezyum",
        },
      ],
    },
  ]);

  return veri;
}

function kur(kullaniciId: string | null, veri: SahteVeritabani = veriKur()) {
  const { prisma, kayitlar } = sahtePrismaKur(veri);
  prismaMock.current = prisma;

  authMock.requireUser.mockResolvedValue(
    kullaniciId ? oturum(kullaniciId) : oturumYok()
  );

  // Sahte veritabanındaki güncel plan satırı; her okumada tazesi alınıyor
  // çünkü handler kaydı yerinde güncelliyor.
  const plan = () =>
    kayitlar("tripPlan").find((k) => k.id === "plan-ahmet") as Record<string, unknown>;

  return { plan };
}

/** Rotayı taze import eder; `vi.resetModules` ile taklitler güncel kalıyor. */
async function cagir(planId: string) {
  const { POST } = await import("@/app/api/plan-detail/[id]/coordinates/route");
  return POST(
    jsonIstek(`/api/plan-detail/${planId}/coordinates`, "POST"),
    params({ id: planId })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  geocodeMock.yapilandirilmis.mockReturnValue(true);
  // Varsayılan: tek aktiviteye koordinat ekliyor.
  geocodeMock.ekle.mockImplementation(async (gunler: unknown) => ({
    gunler: (gunler as Array<{ activities: unknown[] }>).map((gun) => ({
      ...gun,
      activities: (gun.activities as Array<Record<string, unknown>>).map((a) => ({
        ...a,
        coordinates: { lat: 41.89, lng: 12.49 },
      })),
    })),
    cozulen: 1,
    cozulemeyen: 0,
  }));
});

describe("POST /api/plan-detail/[id]/coordinates", () => {
  it("oturum yoksa 401 döner", async () => {
    kur(null);
    const { status } = await yanit(await cagir("plan-ahmet"));
    expect(status).toBe(401);
  });

  it("başkasının planına koordinat yazmaz", async () => {
    const { plan } = kur(BURCU);
    const { status } = await yanit(await cagir("plan-ahmet"));

    expect(status).toBe(403);
    // En önemli iddia: plan DEĞİŞMEDİ.
    expect(plan().gun_plani).toContain("Kolezyum");
    expect(plan().gun_plani).not.toContain("coordinates");
  });

  it("olmayan planda 404 döner", async () => {
    kur(AHMET);
    const { status } = await yanit(await cagir("yok-boyle-bir-plan"));
    expect(status).toBe(404);
  });

  it("geocoding yapılandırılmamışsa 503 döner ve hiç sorgu yapmaz", async () => {
    geocodeMock.yapilandirilmis.mockReturnValue(false);
    kur(AHMET);

    const { status } = await yanit(await cagir("plan-ahmet"));
    expect(status).toBe(503);
    expect(geocodeMock.ekle).not.toHaveBeenCalled();
  });

  it("kendi planında koordinatları çözer ve gun_plani'ye yazar", async () => {
    const { plan } = kur(AHMET);
    const { status, body } = await yanit(await cagir("plan-ahmet"));

    expect(status).toBe(200);
    expect(body.cozulen).toBe(1);

    const gunler = JSON.parse(plan().gun_plani as string);
    expect(gunler[0].activities[0].coordinates).toEqual({ lat: 41.89, lng: 12.49 });
  });

  it("bütçeye ve toplam maliyete DOKUNMAZ", async () => {
    const { plan } = kur(AHMET);
    const oncekiButce = plan().butce_tahmini;
    const oncekiToplam = plan().total_cost;

    await cagir("plan-ahmet");

    expect(plan().butce_tahmini).toBe(oncekiButce);
    expect(plan().total_cost).toBe(oncekiToplam);
  });

  it("hiçbir konum çözülemezse yazma yapmaz", async () => {
    geocodeMock.ekle.mockResolvedValue({ gunler: [], cozulen: 0, cozulemeyen: 3 });

    const { plan } = kur(AHMET);
    const oncekiGunPlani = plan().gun_plani;

    const { status, body } = await yanit(await cagir("plan-ahmet"));

    expect(status).toBe(200);
    expect(body.cozulen).toBe(0);
    expect(plan().gun_plani).toBe(oncekiGunPlani);
  });

  it("gün planı JSON değilse 400 döner", async () => {
    const veri = veriKur();
    // Eski markdown planlar: `gunleriCoz` null dönüyor.
    veri.tripPlan[0].gun_plani = "## 1. Gün\n- Kolezyum";

    kur(AHMET, veri);
    const { status } = await yanit(await cagir("plan-ahmet"));

    expect(status).toBe(400);
    expect(geocodeMock.ekle).not.toHaveBeenCalled();
  });
});
