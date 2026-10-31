import { beforeEach, describe, expect, it, vi } from "vitest";
import { AHMET, istek, oturum, oturumYok, yanit } from "../helpers/route-harness";

/**
 * `GET /api/accommodation-options`
 *
 * Konaklama ekranı bu ana kadar tamamen SABİT DEMO VERİYLE çalışıyordu.
 * Bu uç, uydurmakla tedarikçi sözleşmesi arasındaki dürüst orta yol: zaten
 * kurulu olan arama sağlayıcısıyla GERÇEK fiyat sayfalarını buluyor.
 *
 * Buradaki testlerin odağı, ekranın güvendiği üç davranış:
 *  - Arama yapılandırılmamışsa bu AÇIKÇA söyleniyor (boş liste "sonuç yok"
 *    gibi okunur ve kullanıcı boşuna arar).
 *  - Sosyal medya sonuçları eleniyor; oradan otel fiyatı öğrenilmiyor.
 *  - Aynı alan adından ikinci sonuç gösterilmiyor.
 */

const { authMock, sinirMock, aramaMock } = vi.hoisted(() => ({
  authMock: { requireUser: vi.fn() },
  sinirMock: { rateLimitAsync: vi.fn() },
  aramaMock: {
    arama: vi.fn(),
    aramaYapilandirilmisMi: vi.fn(),
    otelAramaSorgusu: vi.fn(),
  },
}));

vi.mock("@/lib/auth-session", () => ({ requireUser: authMock.requireUser }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: sinirMock.rateLimitAsync,
  rateLimit: () => ({ success: true, remaining: 5, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/web-search", () => ({
  arama: aramaMock.arama,
  aramaYapilandirilmisMi: aramaMock.aramaYapilandirilmisMi,
  otelAramaSorgusu: aramaMock.otelAramaSorgusu,
}));

function sonuc(url: string, title = "Başlık") {
  return { title, url, snippet: "özet" };
}

function kur(kullaniciId: string | null = AHMET) {
  authMock.requireUser.mockResolvedValue(
    kullaniciId ? oturum(kullaniciId) : oturumYok()
  );
  sinirMock.rateLimitAsync.mockResolvedValue({
    success: true,
    remaining: 11,
    retryAfter: 0,
  });
  aramaMock.aramaYapilandirilmisMi.mockReturnValue(true);
  aramaMock.otelAramaSorgusu.mockReturnValue("Roma otel fiyatları gecelik ortalama");
  aramaMock.arama.mockResolvedValue([sonuc("https://otel.test/roma")]);
}

function cagir(sorgu: string) {
  return import("@/app/api/accommodation-options/route").then(({ GET }) =>
    GET(istek(`/api/accommodation-options?${sorgu}`))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/accommodation-options", () => {
  it("oturum yoksa 401 döner", async () => {
    kur(null);
    const { status } = await yanit(await cagir("city=Roma"));
    expect(status).toBe(401);
  });

  it("şehir yoksa 400 döner", async () => {
    kur();
    const { status } = await yanit(await cagir("city="));
    expect(status).toBe(400);
    expect(aramaMock.arama).not.toHaveBeenCalled();
  });

  it("kaynakları döndürür ve sorguyu paylaşılan kurucudan alır", async () => {
    kur();
    const { status, body } = await yanit(await cagir("city=Roma&checkIn=2026-11-02"));

    expect(status).toBe(200);
    expect(body.yapilandirildi).toBe(true);
    expect((body.kaynaklar as unknown[]).length).toBe(1);

    // Sorgu metni `web-search.ts`'te; kopyalanırsa modele giden araçla
    // ekranın araması zamanla ayrışır.
    expect(aramaMock.otelAramaSorgusu).toHaveBeenCalledWith("Roma", "2026-11-02", undefined);
  });

  it("arama yapılandırılmamışsa AÇIKÇA söyler ve kota harcamaz", async () => {
    kur();
    aramaMock.aramaYapilandirilmisMi.mockReturnValue(false);

    const { status, body } = await yanit(await cagir("city=Roma"));

    expect(status).toBe(200);
    expect(body.yapilandirildi).toBe(false);
    expect(body.kaynaklar).toEqual([]);
    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
    expect(aramaMock.arama).not.toHaveBeenCalled();
  });

  it("sosyal medya sonuçlarını eler", async () => {
    kur();
    aramaMock.arama.mockResolvedValue([
      sonuc("https://www.instagram.com/otel"),
      sonuc("https://m.facebook.com/otel"),
      sonuc("https://otel.test/roma"),
    ]);

    const { body } = await yanit(await cagir("city=Roma"));
    const kaynaklar = body.kaynaklar as Array<{ url: string }>;

    expect(kaynaklar).toHaveLength(1);
    expect(kaynaklar[0].url).toBe("https://otel.test/roma");
  });

  it("aynı alan adından tek sonuç gösterir", async () => {
    kur();
    aramaMock.arama.mockResolvedValue([
      sonuc("https://otel.test/a"),
      sonuc("https://www.otel.test/b"),
      sonuc("https://baska.test/c"),
    ]);

    const { body } = await yanit(await cagir("city=Roma"));
    const kaynaklar = body.kaynaklar as Array<{ alan: string }>;

    expect(kaynaklar.map((k) => k.alan)).toEqual(["otel.test", "baska.test"]);
  });

  it("en fazla 6 kaynak döndürür", async () => {
    kur();
    aramaMock.arama.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => sonuc(`https://alan${i}.test/x`))
    );

    const { body } = await yanit(await cagir("city=Roma"));
    expect((body.kaynaklar as unknown[]).length).toBe(6);
  });

  it("kota dolduğunda 429 döner", async () => {
    kur();
    sinirMock.rateLimitAsync.mockResolvedValue({
      success: false,
      remaining: 0,
      retryAfter: 30,
    });

    const { status } = await yanit(await cagir("city=Roma"));
    expect(status).toBe(429);
    expect(aramaMock.arama).not.toHaveBeenCalled();
  });

  it("arama fırlatırsa 500 döner, çökmez", async () => {
    kur();
    aramaMock.arama.mockRejectedValue(new Error("sağlayıcı düştü"));

    const { status, body } = await yanit(await cagir("city=Roma"));
    expect(status).toBe(500);
    // Teknik ayrıntı istemciye sızmıyor.
    expect(String(body.error)).not.toContain("sağlayıcı düştü");
  });
});
