import { afterEach, describe, expect, it, vi } from "vitest";
import { hataDinleyicisiKur, logger, type HataDinleyicisi } from "@/lib/logger";

/**
 * HATA İZLEME KANCASI (B10).
 *
 * `logger.error` uygulamadaki tek hata kapısı; hata izleme sağlayıcısı da
 * oraya bağlanıyor. Kanca yerine doğrudan bir SDK çağrısı konulmadı çünkü
 * bu modül sunucu rotalarından, `"use client"` bileşenlerinden ve Edge
 * middleware'den import ediliyor — üçünde birden çalışan bir paket seçmek
 * zorunluluğu, modülün bugünkü sıfır bağımlılığını bozardı.
 *
 * Buradaki testler kancanın üç sözleşmesini koruyor: yalnızca `error`
 * tetikliyor, detay MASKELENMİŞ geliyor, ve dinleyicinin patlaması asıl
 * hatayı gizlemiyor.
 */

afterEach(() => {
  hataDinleyicisiKur(null);
  vi.restoreAllMocks();
});

/** Konsol gürültüsünü bastırır; testin kendisi log'a bakmıyor. */
function konsoluSustur() {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
}

describe("hataDinleyicisiKur", () => {
  it("logger.error dinleyiciyi tetikler", () => {
    konsoluSustur();
    const dinleyici = vi.fn<HataDinleyicisi>();
    hataDinleyicisiKur(dinleyici);

    const hata = new Error("plan üretilemedi");
    logger.error("Plan üretim işi başarısız", hata, { jobId: "is-1" });

    expect(dinleyici).toHaveBeenCalledTimes(1);
    const [mesaj, cause, detay] = dinleyici.mock.calls[0];
    expect(mesaj).toBe("Plan üretim işi başarısız");
    expect(cause).toBe(hata);
    expect(detay).toMatchObject({ jobId: "is-1" });
  });

  it("warn/info/debug dinleyiciyi TETİKLEMEZ", () => {
    // Uyarı ve bilgi satırları izleme sağlayıcısını doldurup gerçek
    // hataları gömerdi.
    konsoluSustur();
    const dinleyici = vi.fn<HataDinleyicisi>();
    hataDinleyicisiKur(dinleyici);

    logger.warn("bir şey ters gitti", new Error("x"));
    logger.info("bilgi");
    logger.debug("ayrıntı");

    expect(dinleyici).not.toHaveBeenCalled();
  });

  it("dinleyiciye giden detay MASKELENMİŞ", () => {
    // Sağlayıcıya ham PII gönderilmemeli; `redact` zaten uygulanıyor.
    konsoluSustur();
    const dinleyici = vi.fn<HataDinleyicisi>();
    hataDinleyicisiKur(dinleyici);

    logger.error("Kayıt başarısız", undefined, {
      email: "ibrahim@ornek.test",
      password: "gizli-parola",
      userId: "cmf1a2b3c4d5e6f7",
    });

    const [, , detay] = dinleyici.mock.calls[0];
    expect(detay.email).toBe("i***@ornek.test");
    expect(detay.password).toBe("[gizli]");
    expect(String(detay.userId)).not.toBe("cmf1a2b3c4d5e6f7");
  });

  it("dinleyici fırlatırsa asıl hata yine log'lanır", () => {
    // Hata izlemenin kendisi bir kesinti kaynağı olamaz.
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    hataDinleyicisiKur(() => {
      throw new Error("Sentry düştü");
    });

    expect(() => logger.error("asıl hata")).not.toThrow();
    expect(konsol).toHaveBeenCalled();
  });

  it("dinleyici kurulmazsa davranış değişmez", () => {
    const konsol = vi.spyOn(console, "error").mockImplementation(() => {});
    hataDinleyicisiKur(null);

    expect(() => logger.error("dinleyicisiz hata")).not.toThrow();
    expect(konsol).toHaveBeenCalled();
  });

  it("child logger da dinleyiciyi tetikler", () => {
    konsoluSustur();
    const dinleyici = vi.fn<HataDinleyicisi>();
    hataDinleyicisiKur(dinleyici);

    logger.child({ route: "/api/trip" }).error("alt logger hatası");

    expect(dinleyici).toHaveBeenCalledTimes(1);
    expect(dinleyici.mock.calls[0][2]).toMatchObject({ route: "/api/trip" });
  });
});
