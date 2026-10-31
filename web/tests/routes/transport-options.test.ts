import { beforeEach, describe, expect, it, vi } from "vitest";
import { AHMET, istek, oturum, oturumYok, yanit } from "../helpers/route-harness";

/**
 * `GET /api/transport-options`
 *
 * Bu uç iki şeyi birlikte yapıyor: yerel (bedava) mesafe hesabı ve
 * isteğe bağlı web araması. Buradaki testlerin odağı GİRDİ YORUMU:
 *
 *  - Aynı şehir tespiti ÇÖZÜMLENMİŞ şehir üzerinden mi yapılıyor?
 *    Türkçe küçültme kuralı "I"yı "ı"ya çevirdiği için ham metin
 *    karşılaştırması "Istanbul" ile "İstanbul"u FARKLI şehir sayıyordu;
 *    istek 400 yerine boş seçenek listesiyle 200 dönüyordu.
 *  - Tanınmayan şehirde arama kotası harcanıyor mu?
 *
 * Arama sağlayıcısı taklit ediliyor; test ağa çıkmıyor.
 */

const { authMock, sinirMock, rotaMock } = vi.hoisted(() => ({
  authMock: { requireUser: vi.fn() },
  sinirMock: { rateLimitAsync: vi.fn() },
  rotaMock: { zenginRotaHesapla: vi.fn() },
}));

vi.mock("@/lib/auth-session", () => ({ requireUser: authMock.requireUser }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitAsync: sinirMock.rateLimitAsync,
  rateLimit: () => ({ success: true, remaining: 5, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/ulasim-arama", () => ({
  zenginRotaHesapla: rotaMock.zenginRotaHesapla,
}));

function kur(kullaniciId: string | null = AHMET) {
  authMock.requireUser.mockResolvedValue(
    kullaniciId ? oturum(kullaniciId) : oturumYok()
  );
  sinirMock.rateLimitAsync.mockResolvedValue({
    success: true,
    remaining: 11,
    retryAfter: 0,
  });
  rotaMock.zenginRotaHesapla.mockResolvedValue({
    nereden: "İstanbul",
    nereye: "Ankara",
    kusUcusuKm: 350,
    karayoluKm: 445,
    secenekler: [],
    webAramasiYapildi: false,
  });
}

function cagir(sorgu: string) {
  return import("@/app/api/transport-options/route").then(({ GET }) =>
    GET(istek(`/api/transport-options?${sorgu}`))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/transport-options", () => {
  it("oturum yoksa 401 döner", async () => {
    kur(null);
    const { status } = await yanit(await cagir("from=İstanbul&to=Ankara"));
    expect(status).toBe(401);
  });

  it("geçerli güzergâhta rotayı döndürür", async () => {
    kur();
    const { status, body } = await yanit(await cagir("from=İstanbul&to=Ankara"));

    expect(status).toBe(200);
    expect(body.rota).toBeTruthy();
    expect(rotaMock.zenginRotaHesapla).toHaveBeenCalledTimes(1);
  });

  it("aynı şehir 400 döner", async () => {
    kur();
    const { status, body } = await yanit(await cagir("from=Ankara&to=Ankara"));

    expect(status).toBe(400);
    expect(String(body.error)).toContain("aynı olamaz");
    expect(rotaMock.zenginRotaHesapla).not.toHaveBeenCalled();
  });

  it("ASCII ve Türkçe yazım aynı şehir sayılır", async () => {
    // REGRESYON: `"Istanbul".toLocaleLowerCase("tr")` → "ıstanbul", yani
    // "İstanbul"un küçük hâli olan "istanbul" ile eşleşmiyor. Ham metin
    // karşılaştırması bu ikisini farklı şehir sayıyor, ardından rota
    // hesabı ikisini de İstanbul'a çözüp BOŞ seçenek listesi dönüyordu:
    // kullanıcı hatasız ama işe yaramaz bir yanıt görüyordu.
    kur();
    const { status } = await yanit(await cagir("from=Istanbul&to=İstanbul"));

    expect(status).toBe(400);
    expect(rotaMock.zenginRotaHesapla).not.toHaveBeenCalled();
  });

  it("tanınmayan şehirde 404 döner ve arama kotası harcanmaz", async () => {
    kur();
    const { status } = await yanit(await cagir("from=Atlantis&to=Ankara"));

    expect(status).toBe(404);
    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
    expect(rotaMock.zenginRotaHesapla).not.toHaveBeenCalled();
  });

  it("?web=0 verildiğinde arama kotası harcanmaz", async () => {
    kur();
    const { status } = await yanit(await cagir("from=İstanbul&to=Ankara&web=0"));

    expect(status).toBe(200);
    expect(sinirMock.rateLimitAsync).not.toHaveBeenCalled();
    expect(rotaMock.zenginRotaHesapla).toHaveBeenCalledWith(
      "İstanbul",
      "Ankara",
      { webAra: false }
    );
  });

  it("kota dolduğunda 429 döner", async () => {
    kur();
    sinirMock.rateLimitAsync.mockResolvedValue({
      success: false,
      remaining: 0,
      retryAfter: 30,
    });

    const { status } = await yanit(await cagir("from=İstanbul&to=Ankara"));

    expect(status).toBe(429);
    expect(rotaMock.zenginRotaHesapla).not.toHaveBeenCalled();
  });
});
