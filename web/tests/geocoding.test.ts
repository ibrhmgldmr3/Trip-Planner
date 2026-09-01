import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanGunu } from "@/lib/plan-budget";

/**
 * `geocoding.ts` `@/env`'i import anında okuyor; testte gerçek env
 * doğrulaması çalışmasın diye taklit ediyoruz (web-search.test.ts'teki
 * aynı desen).
 */
const envMock = { current: { GOOGLE_MAPS_SERVER_API_KEY: undefined as string | undefined } };

vi.mock("@/env", () => ({
  get env() {
    return envMock.current;
  },
}));

async function modulYukle() {
  vi.resetModules();
  return import("@/lib/geocoding");
}

const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  envMock.current = { GOOGLE_MAPS_SERVER_API_KEY: undefined };
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

function googleYaniti(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** `status: "OK"` ve tek sonuçlu bir Geocoding yanıtı. */
function okYanit(lat: number, lng: number) {
  return googleYaniti({ status: "OK", results: [{ geometry: { location: { lat, lng } } }] });
}

/** Verilen aktivite adlarından tek günlük bir plan üretir. */
function gun(konumlar: Array<string | { location: string; coordinates: { lat: number; lng: number } }>): PlanGunu[] {
  return [
    {
      day: 1,
      date: "2026-05-01",
      notes: "",
      isEmpty: false,
      activities: konumlar.map((konum, i) =>
        typeof konum === "string"
          ? {
              id: `a${i}`,
              name: `Aktivite ${i}`,
              startTime: "09:00",
              endTime: "10:00",
              cost: 0,
              description: "",
              category: "gezi",
              location: konum,
            }
          : {
              id: `a${i}`,
              name: `Aktivite ${i}`,
              startTime: "09:00",
              endTime: "10:00",
              cost: 0,
              description: "",
              category: "gezi",
              location: konum.location,
              coordinates: konum.coordinates,
            }
      ),
    },
  ];
}

describe("geocodingYapilandirilmisMi", () => {
  it("anahtar yoksa false döner", async () => {
    const { geocodingYapilandirilmisMi } = await modulYukle();
    expect(geocodingYapilandirilmisMi()).toBe(false);
  });

  it("anahtar varsa true döner", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const { geocodingYapilandirilmisMi } = await modulYukle();
    expect(geocodingYapilandirilmisMi()).toBe(true);
  });
});

describe("adresiCoz", () => {
  it("anahtar yoksa ağ çağrısı yapmadan null döner", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("Kolezyum, Roma")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("OK yanıtından koordinatı çıkarır ve anahtarı sorguya koyar", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.8902, 12.4922));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("Kolezyum, Roma")).toEqual({ lat: 41.8902, lng: 12.4922 });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("address")).toBe("Kolezyum, Roma");
    expect(url.searchParams.get("key")).toBe("AIza-test");
  });

  it("ZERO_RESULTS'ta null döner, fırlatmaz", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    global.fetch = vi
      .fn()
      .mockResolvedValue(googleYaniti({ status: "ZERO_RESULTS", results: [] })) as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("belirsiz yer")).toBeNull();
  });

  it("REQUEST_DENIED gibi yapılandırma hatalarında null döner", async () => {
    // En sık sebep: tarayıcı (referrer kısıtlı) anahtarının sunucuda
    // kullanılması. Üretimi düşürmemeli, yalnızca koordinatsız bırakmalı.
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    global.fetch = vi
      .fn()
      .mockResolvedValue(googleYaniti({ status: "REQUEST_DENIED" })) as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("Kolezyum")).toBeNull();
  });

  it("HTTP hatasında ve ağ hatasında null döner", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";

    global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 500 })) as unknown as typeof fetch;
    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("Kolezyum")).toBeNull();

    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    const { adresiCoz: tekrar } = await modulYukle();
    expect(await tekrar("Kolezyum")).toBeNull();
  });

  it("aralık dışı koordinat döndüren yanıtı reddeder", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    global.fetch = vi.fn().mockResolvedValue(okYanit(999, 12)) as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("Kolezyum")).toBeNull();
  });

  it("boş adreste ağ çağrısı yapmaz", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    expect(await adresiCoz("   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("gunlereKoordinatEkle", () => {
  it("anahtar yoksa günleri olduğu gibi döner", async () => {
    const gunler = gun(["Kolezyum"]);
    const { gunlereKoordinatEkle } = await modulYukle();

    const sonuc = await gunlereKoordinatEkle(gunler, { city: "Roma", country: "İtalya" });
    expect(sonuc.gunler).toBe(gunler);
    expect(sonuc.cozulen).toBe(0);
  });

  it("şehir ve ülkeyi adres metnine ekler", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    await gunlereKoordinatEkle(gun(["Kolezyum"]), { city: "Roma", country: "İtalya" });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.searchParams.get("address")).toBe("Kolezyum, Roma, İtalya");
  });

  it("aynı adresi bir kez sorgular, sonucu tüm aktivitelere dağıtır", async () => {
    // Otel gibi tekrar eden duraklar bir planda 10+ kez geçiyor; her biri
    // için ayrı istek atmak kotayı boşa harcardı.
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    const sonuc = await gunlereKoordinatEkle(gun(["Otel Roma", "Otel Roma", "Otel Roma"]), {
      city: "Roma",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sonuc.cozulen).toBe(3);
    expect(sonuc.gunler[0].activities.every((a) => a.coordinates)).toBe(true);
  });

  it("zaten koordinatlı aktiviteyi tekrar sorgulamaz", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    const sonuc = await gunlereKoordinatEkle(
      gun([{ location: "Kolezyum", coordinates: { lat: 1, lng: 2 } }]),
      { city: "Roma" }
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sonuc.cozulen).toBe(0);
    expect(sonuc.gunler[0].activities[0].coordinates).toEqual({ lat: 1, lng: 2 });
  });

  it("çözülemeyen aktiviteyi koordinatsız bırakır ve sayar", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    global.fetch = vi
      .fn()
      .mockResolvedValue(googleYaniti({ status: "ZERO_RESULTS", results: [] })) as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    const sonuc = await gunlereKoordinatEkle(gun(["belirsiz"]), { city: "Roma" });

    expect(sonuc.cozulen).toBe(0);
    expect(sonuc.cozulemeyen).toBe(1);
    expect(sonuc.gunler[0].activities[0].coordinates).toBeUndefined();
  });

  it("konumu boş olan aktivite için istek atmaz", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    // Şehir de boş: kurulacak adres tamamen boş kalıyor.
    const sonuc = await gunlereKoordinatEkle(gun([""]), { city: "" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sonuc.cozulemeyen).toBe(1);
  });

  it("süre bütçesi dolmuşsa hiç istek atmadan döner", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { gunlereKoordinatEkle } = await modulYukle();
    const sonuc = await gunlereKoordinatEkle(gun(["Kolezyum"]), { city: "Roma" }, {
      sureBitisi: Date.now() - 1,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sonuc.cozulen).toBe(0);
  });

  it("girdi dizisini değiştirmez", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    global.fetch = vi.fn().mockResolvedValue(okYanit(41.89, 12.49)) as unknown as typeof fetch;

    const gunler = gun(["Kolezyum"]);
    const { gunlereKoordinatEkle } = await modulYukle();
    await gunlereKoordinatEkle(gunler, { city: "Roma" });

    expect(gunler[0].activities[0].coordinates).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Faz F — SSRF yüzeyi                                                        */
/* -------------------------------------------------------------------------- */

describe("SSRF sınırı", () => {
  it("model girdisi istek HEDEFİNİ değiştiremez", async () => {
    // Adres metni MODEL çıktısından geliyor (aktivitenin `location` alanı).
    // Bir gün biri `${GEOCODE_ENDPOINT}?address=${adres}` diye dize
    // birleştirirse bu test düşer — bugün adres `searchParams` üzerinden
    // gidiyor ve hedef host sabit.
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();

    await adresiCoz("https://kotu.test/x?a=b#frag");
    await adresiCoz("@kotu.test/");
    await adresiCoz("../../../etc/passwd");

    for (const [istenen] of fetchSpy.mock.calls) {
      const url = new URL(String(istenen));
      expect(url.origin).toBe("https://maps.googleapis.com");
      expect(url.pathname).toBe("/maps/api/geocode/json");
    }
  });

  it("adres metni sorgu parametresi olarak kodlanır", async () => {
    envMock.current.GOOGLE_MAPS_SERVER_API_KEY = "AIza-test";
    const fetchSpy = vi.fn().mockResolvedValue(okYanit(41.89, 12.49));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { adresiCoz } = await modulYukle();
    await adresiCoz("Kolezyum & Forum, Roma");

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    // Ayrıştırıldığında ham metin geri gelmeli; kaçırma kaybolmamalı.
    expect(url.searchParams.get("address")).toBe("Kolezyum & Forum, Roma");
  });
});
