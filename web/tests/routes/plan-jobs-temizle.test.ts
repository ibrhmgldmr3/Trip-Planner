import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { yanit } from "../helpers/route-harness";

/**
 * `POST /api/plan-jobs/temizle` (B10)
 *
 * Zamanlanmış görevden çağrılan, KULLANICI KAPSAMSIZ bir yazma ucu. Bu iki
 * özellik birleştiği için yetkilendirmesi sıkı olmak zorunda: sır sızarsa
 * ya da kontrol atlanırsa herkes bütün kullanıcıların işlerini FAILED'a
 * çekebilir.
 *
 * Neden var: `after()` tabanlı kuyrukta sunucu yeniden başlarsa iş
 * RUNNING'de kalıyor ve `devamEdenIs` o kullanıcıyı 10 dakika boyunca yeni
 * plan üretemez hale getiriyor. Kullanıcı durumu hiç sormazsa mevcut
 * temizlik hiç çalışmıyor.
 */

const GECERLI_SIR = "a".repeat(40);

const { envMock, isMock } = vi.hoisted(() => ({
  envMock: { current: { CRON_SECRET: undefined as string | undefined } },
  isMock: { tumAsilKalanlariTemizle: vi.fn() },
}));

vi.mock("@/env", () => ({
  get env() {
    return envMock.current;
  },
}));

vi.mock("@/lib/plan-job", () => ({
  tumAsilKalanlariTemizle: isMock.tumAsilKalanlariTemizle,
}));

function istek(sir?: string): NextRequest {
  return new NextRequest(new URL("/api/plan-jobs/temizle", "http://localhost:3000"), {
    method: "POST",
    headers: sir ? { authorization: `Bearer ${sir}` } : {},
  });
}

function cagir(sir?: string) {
  return import("@/app/api/plan-jobs/temizle/route").then(({ POST }) => POST(istek(sir)));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  envMock.current = { CRON_SECRET: GECERLI_SIR };
  isMock.tumAsilKalanlariTemizle.mockResolvedValue(3);
});

describe("POST /api/plan-jobs/temizle", () => {
  it("doğru sırla temizliği çalıştırır", async () => {
    const { status, body } = await yanit(await cagir(GECERLI_SIR));

    expect(status).toBe(200);
    expect(body.temizlenen).toBe(3);
    expect(isMock.tumAsilKalanlariTemizle).toHaveBeenCalledTimes(1);
  });

  it("başlık yoksa 401 döner ve HİÇBİR ŞEY yazmaz", async () => {
    const { status } = await yanit(await cagir(undefined));

    expect(status).toBe(401);
    expect(isMock.tumAsilKalanlariTemizle).not.toHaveBeenCalled();
  });

  it("yanlış sırla 401 döner ve HİÇBİR ŞEY yazmaz", async () => {
    const { status } = await yanit(await cagir("b".repeat(40)));

    expect(status).toBe(401);
    expect(isMock.tumAsilKalanlariTemizle).not.toHaveBeenCalled();
  });

  it("farklı uzunlukta sır 401 döner, çökmez", async () => {
    // `timingSafeEqual` eşit uzunluk istiyor; kontrol edilmezse fırlatır
    // ve uç 500 dönerdi — saldırgana "uzunluk yanlış" sinyali.
    const { status } = await yanit(await cagir("kisa"));
    expect(status).toBe(401);
  });

  it("Bearer olmayan şema 401 döner", async () => {
    const r = new NextRequest(
      new URL("/api/plan-jobs/temizle", "http://localhost:3000"),
      { method: "POST", headers: { authorization: `Basic ${GECERLI_SIR}` } }
    );
    const { POST } = await import("@/app/api/plan-jobs/temizle/route");

    const { status } = await yanit(await POST(r));
    expect(status).toBe(401);
  });

  it("CRON_SECRET tanımsızsa uç KAPALI (503)", async () => {
    // Sessizce açık bırakmaktansa kapalı olduğunu söylemek doğru:
    // sırsız çalışan bir temizlik ucu, herkesin çağırabildiği bir yazma
    // ucudur.
    envMock.current = { CRON_SECRET: undefined };

    const { status } = await yanit(await cagir(GECERLI_SIR));

    expect(status).toBe(503);
    expect(isMock.tumAsilKalanlariTemizle).not.toHaveBeenCalled();
  });

  it("401 yanıtı hangi kısmın yanlış olduğunu söylemez", async () => {
    const { body: basliksiz } = await yanit(await cagir(undefined));
    const { body: yanlisSir } = await yanit(await cagir("c".repeat(40)));

    // İki durum ayırt edilemiyor; ayrım saldırgana ilerleme bilgisi verir.
    expect(basliksiz.error).toBe(yanlisSir.error);
  });

  it("temizlik fırlatırsa 500 döner, ayrıntı sızmaz", async () => {
    isMock.tumAsilKalanlariTemizle.mockRejectedValue(new Error("veritabanı düştü"));

    const { status, body } = await yanit(await cagir(GECERLI_SIR));

    expect(status).toBe(500);
    expect(String(body.error)).not.toContain("veritabanı düştü");
  });
});
