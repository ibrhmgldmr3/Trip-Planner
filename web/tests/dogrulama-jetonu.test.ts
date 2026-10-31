import { beforeEach, describe, expect, it, vi } from "vitest";
import { sahtePrismaKur } from "./helpers/fake-prisma";

/**
 * TEK KULLANIMLIK DOĞRULAMA JETONLARI (B9).
 *
 * Bu jetonlar bir paroladan daha güçlü: elinde olan, hesabın şifresini
 * değiştirebiliyor. O yüzden burada test edilen şey "çalışıyor mu" değil,
 * KÖTÜYE KULLANILAMIYOR MU:
 *
 *  - Veritabanında ham jeton durmuyor (sızan yedek hesap vermiyor).
 *  - E-posta doğrulama jetonu şifre sıfırlamada KULLANILAMIYOR.
 *  - Aynı jeton iki kez tüketilemiyor.
 *  - Süresi dolmuş jeton çalışmıyor ve satırı da temizleniyor.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

import {
  EPOSTA_DOGRULAMA_OMRU_MS,
  JETON_AMACLARI,
  SIFRE_SIFIRLAMA_OMRU_MS,
  jetonOlustur,
  jetonOzeti,
  jetonuTuket,
} from "@/lib/dogrulama-jetonu";

function kur() {
  const { prisma, kayitlar } = sahtePrismaKur({ verificationToken: [] });
  prismaMock.current = prisma;
  return { satirlar: () => kayitlar("verificationToken") };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("jetonOlustur", () => {
  it("HAM JETONU veritabanına yazmaz", async () => {
    // En kritik iddia: yedek dosyası ya da SQL sızıntısı hâlinde satırlar
    // doğrudan kullanılabilir bağlantılar taşımamalı.
    const { satirlar } = kur();

    const ham = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      "ahmet@ornek.test",
      SIFRE_SIFIRLAMA_OMRU_MS
    );

    const kayit = satirlar()[0];
    expect(kayit.token).not.toBe(ham);
    expect(kayit.token).toBe(jetonOzeti(ham));
  });

  it("amacı ve adresi identifier'a yazar", async () => {
    const { satirlar } = kur();
    await jetonOlustur(JETON_AMACLARI.epostaDogrulama, "Ahmet@Ornek.Test", 1000);

    expect(satirlar()[0].identifier).toBe("eposta-dogrulama:ahmet@ornek.test");
  });

  it("aynı amaç için ESKİ jetonu siler", async () => {
    // İki geçerli bağlantının bir arada durması, ilk postaya erişen birinin
    // penceresini uzatırdı.
    const { satirlar } = kur();

    await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", 1000);
    await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", 1000);

    expect(satirlar()).toHaveLength(1);
  });

  it("FARKLI amaçlar birbirini silmez", async () => {
    const { satirlar } = kur();

    await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", 1000);
    await jetonOlustur(JETON_AMACLARI.epostaDogrulama, "a@ornek.test", 1000);

    expect(satirlar()).toHaveLength(2);
  });

  it("her çağrıda farklı jeton üretir", async () => {
    kur();

    const bir = await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", 1000);
    const iki = await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "b@ornek.test", 1000);

    expect(bir).not.toBe(iki);
    // 32 bayt base64url = 43 karakter.
    expect(bir).toHaveLength(43);
  });
});

describe("jetonuTuket", () => {
  it("geçerli jetonda adresi döndürür", async () => {
    kur();
    const ham = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      "ahmet@ornek.test",
      SIFRE_SIFIRLAMA_OMRU_MS
    );

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ham)).toBe(
      "ahmet@ornek.test"
    );
  });

  it("AYNI JETON İKİ KEZ tüketilemez", async () => {
    kur();
    const ham = await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", 10_000);

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ham)).toBe("a@ornek.test");
    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ham)).toBeNull();
  });

  it("BAŞKA AKIŞIN jetonu kabul edilmez", async () => {
    // Bu kontrol olmasaydı, elinde eski bir DOĞRULAMA bağlantısı olan biri
    // hesabın ŞİFRESİNİ değiştirebilirdi.
    kur();
    const dogrulama = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      "a@ornek.test",
      10_000
    );

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, dogrulama)).toBeNull();
  });

  it("yanlış akışta denenen jeton TÜKENMEZ", async () => {
    // Reddedilen deneme, meşru kullanıcının bağlantısını yakmamalı.
    kur();
    const dogrulama = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      "a@ornek.test",
      10_000
    );

    await jetonuTuket(JETON_AMACLARI.sifreSifirlama, dogrulama);

    expect(await jetonuTuket(JETON_AMACLARI.epostaDogrulama, dogrulama)).toBe(
      "a@ornek.test"
    );
  });

  it("SÜRESİ DOLMUŞ jeton reddedilir ve satırı silinir", async () => {
    const { satirlar } = kur();
    const ham = await jetonOlustur(JETON_AMACLARI.sifreSifirlama, "a@ornek.test", -1000);

    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, ham)).toBeNull();
    // Tablo kendi kendini toplasın: süresi dolan satır birikmemeli.
    expect(satirlar()).toHaveLength(0);
  });

  it("bilinmeyen jetonda null döner", async () => {
    kur();
    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, "uydurma-jeton")).toBeNull();
  });

  it("boş jetonda SORGU BİLE ATMAZ", async () => {
    kur();
    expect(await jetonuTuket(JETON_AMACLARI.sifreSifirlama, "")).toBeNull();
  });
});

describe("ömürler", () => {
  it("şifre sıfırlama KISA, doğrulama UZUN", () => {
    // Sıfırlama jetonu hesabı ele geçirmeye yetiyor; doğrulama jetonunun
    // riski düşük ve kullanıcı postayı ertesi gün açabiliyor.
    expect(SIFRE_SIFIRLAMA_OMRU_MS).toBe(60 * 60 * 1000);
    expect(EPOSTA_DOGRULAMA_OMRU_MS).toBe(24 * 60 * 60 * 1000);
    expect(SIFRE_SIFIRLAMA_OMRU_MS).toBeLessThan(EPOSTA_DOGRULAMA_OMRU_MS);
  });
});
