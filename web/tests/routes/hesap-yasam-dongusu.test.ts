import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { istek, jsonIstek, oturum, oturumYok, yanit } from "../helpers/route-harness";
import { sahtePrismaKur, type SahteVeritabani } from "../helpers/fake-prisma";

/**
 * HESAP YAŞAM DÖNGÜSÜ UÇLARI (B9).
 *
 * Şifre sıfırlama, e-posta doğrulama ve hesap silme. Üçü de hesabın
 * kendisini hedef alan işlemler; bir hata burada "yanlış sayı gösterme"
 * değil, HESAP ELE GEÇİRME ya da VERİ KAYBI demek.
 *
 * Bu dosyanın koruduğu sözleşmeler:
 *  - Sıfırlama ucu hesabın VARLIĞINI sızdırmıyor.
 *  - Doğrulama jetonu şifre sıfırlamada kullanılamıyor (ve tersi).
 *  - Yanlış onayla hesap silinmiyor.
 *  - Doğrulanmamış hesabın saatlik plan hakkı 1.
 */

// Süreç-içi hız sınırlayıcı gerçek. Dosyadaki testler aynı IP'den defalarca
// çağırıyor; sınıra dayanmak testi "kaç tane it() var" sorusuna bağlardı.
process.env.RESET_RATE_LIMIT_PER_HOUR = "1000";

const { prismaMock, authMock, epostaMock } = vi.hoisted(() => ({
  prismaMock: { current: null as unknown },
  authMock: { requireUser: vi.fn() },
  epostaMock: { gonder: vi.fn(), yapilandirilmis: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return prismaMock.current;
  },
}));

vi.mock("@/lib/auth-session", () => ({
  requireUser: authMock.requireUser,
}));

vi.mock("@/lib/eposta", async (asliniAl) => {
  const asil = await asliniAl<typeof import("@/lib/eposta")>();
  return {
    ...asil,
    epostaGonder: (...a: unknown[]) => epostaMock.gonder(...a),
    epostaYapilandirilmisMi: () => epostaMock.yapilandirilmis(),
  };
});

/**
 * `after()` TESTTE HEMEN ÇALIŞIYOR.
 *
 * Sıfırlama ucu jetonu ve postayı bilerek `after()` içine koyuyor: kayıtlı
 * bir adres için sağlayıcıya gidip beklemek, kayıtsız adrese göre ölçülebilir
 * bir süre farkı yaratır ve hesabın varlığını ZAMAN KANALINDAN sızdırır.
 * Testte gerçek `after()` bir istek bağlamı beklediği için çalışmıyor;
 * geri çağrıyı doğrudan çağırmak hem sorunu çözüyor hem de jetonun
 * gerçekten yazıldığını doğrulanabilir kılıyor.
 */
vi.mock("next/server", async (asliniAl) => {
  const asil = await asliniAl<typeof import("next/server")>();
  return { ...asil, after: (fn: () => unknown) => void fn() };
});

/** Şifre 4 turla hash'leniyor: bcrypt.compare tur sayısından bağımsız. */
const SIFRE = "DogruSifre123";
const SIFRE_HASH = bcrypt.hashSync(SIFRE, 4);

const AHMET = "kullanici-ahmet";
const AHMET_EPOSTA = "ahmet@ornek.test";

function veri(): SahteVeritabani {
  return {
    user: [
      {
        id: AHMET,
        email: AHMET_EPOSTA,
        name: "Ahmet",
        password: SIFRE_HASH,
        emailVerified: null,
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
      },
      {
        // Yalnızca Google ile açılmış hesap: sıfırlanacak şifresi yok.
        id: "kullanici-google",
        email: "google@ornek.test",
        name: "Google Kullanıcısı",
        password: null,
        emailVerified: new Date(2026, 0, 1),
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
      },
    ],
    verificationToken: [],
    tripPlan: [],
  };
}

function kur(baslangic: SahteVeritabani = veri()) {
  const { prisma, kayitlar } = sahtePrismaKur(baslangic);
  prismaMock.current = prisma;
  return { kayitlar };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  epostaMock.yapilandirilmis.mockReturnValue(true);
  epostaMock.gonder.mockResolvedValue(true);
  authMock.requireUser.mockResolvedValue(oturum(AHMET));
});

/* ========================================================================== */
/* Şifre sıfırlama isteği                                                     */
/* ========================================================================== */

describe("POST /api/auth/reset-request", () => {
  const cagir = async (email: string) => {
    const { POST } = await import("@/app/api/auth/reset-request/route");
    return yanit(await POST(jsonIstek("/api/auth/reset-request", "POST", { email })));
  };

  it("e-posta yapılandırılmamışsa 503 döner", async () => {
    // "Gönderdik" deyip hiç göndermemek, kullanıcıyı olmayan bir postayı
    // beklemeye mahkûm ederdi.
    epostaMock.yapilandirilmis.mockReturnValue(false);
    kur();

    const { status } = await cagir(AHMET_EPOSTA);
    expect(status).toBe(503);
    expect(epostaMock.gonder).not.toHaveBeenCalled();
  });

  it("kayıtlı adrese jeton üretip posta gönderir", async () => {
    const { kayitlar } = kur();

    const { status } = await cagir(AHMET_EPOSTA);

    expect(status).toBe(200);
    expect(kayitlar("verificationToken")).toHaveLength(1);
    expect(kayitlar("verificationToken")[0].identifier).toBe(
      `sifre-sifirlama:${AHMET_EPOSTA}`
    );
    expect(epostaMock.gonder).toHaveBeenCalledTimes(1);
  });

  it("KAYITSIZ adreste de AYNI yanıtı verir", async () => {
    // En kritik iddia: bu uç bir "bu e-posta bu sitede kayıtlı mı"
    // sorgulayıcısına dönüşmemeli.
    const { kayitlar } = kur();

    const kayitli = await cagir(AHMET_EPOSTA);
    const kayitsiz = await cagir("kimse@ornek.test");

    expect(kayitsiz.status).toBe(kayitli.status);
    expect(kayitsiz.body.message).toBe(kayitli.body.message);
    // Ama arka planda hiçbir şey yapılmıyor.
    expect(kayitlar("verificationToken")).toHaveLength(1);
    expect(epostaMock.gonder).toHaveBeenCalledTimes(1);
  });

  it("ŞİFRESİZ (Google) hesaba sıfırlama göndermez", async () => {
    // Bağlantı gönderirsek kullanıcı şifre belirleyip sonra "neden Google
    // ile giremiyorum" durumuna düşerdi.
    const { kayitlar } = kur();

    const { status } = await cagir("google@ornek.test");

    expect(status).toBe(200);
    expect(kayitlar("verificationToken")).toHaveLength(0);
    expect(epostaMock.gonder).not.toHaveBeenCalled();
  });

  it("geçersiz e-postada 400 döner", async () => {
    kur();
    const { status } = await cagir("bu-bir-eposta-degil");
    expect(status).toBe(400);
  });
});

/* ========================================================================== */
/* Şifre sıfırlama                                                            */
/* ========================================================================== */

describe("POST /api/auth/reset", () => {
  const cagir = async (token: string, password: string) => {
    const { POST } = await import("@/app/api/auth/reset/route");
    return yanit(
      await POST(jsonIstek("/api/auth/reset", "POST", { token, password }))
    );
  };

  /** Sıfırlama akışını başlatıp ham jetonu döndürür. */
  async function jetonAl() {
    const { jetonOlustur, JETON_AMACLARI, SIFRE_SIFIRLAMA_OMRU_MS } = await import(
      "@/lib/dogrulama-jetonu"
    );
    return jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      AHMET_EPOSTA,
      SIFRE_SIFIRLAMA_OMRU_MS
    );
  }

  it("geçerli jetonla şifreyi değiştirir", async () => {
    const { kayitlar } = kur();
    const jeton = await jetonAl();

    const { status } = await cagir(jeton, "YeniSifre456");

    expect(status).toBe(200);

    const kullanici = kayitlar("user").find((k) => k.id === AHMET);
    expect(await bcrypt.compare("YeniSifre456", String(kullanici!.password))).toBe(true);
    expect(await bcrypt.compare(SIFRE, String(kullanici!.password))).toBe(false);
  });

  it("jeton TEK KULLANIMLIK", async () => {
    kur();
    const jeton = await jetonAl();

    expect((await cagir(jeton, "YeniSifre456")).status).toBe(200);
    expect((await cagir(jeton, "BaskaSifre789")).status).toBe(400);
  });

  it("uydurma jetonda 400 döner ve şifre DEĞİŞMEZ", async () => {
    const { kayitlar } = kur();

    const { status } = await cagir("bu-jeton-hic-uretilmedi", "YeniSifre456");

    expect(status).toBe(400);
    const kullanici = kayitlar("user").find((k) => k.id === AHMET);
    expect(kullanici!.password).toBe(SIFRE_HASH);
  });

  it("DOĞRULAMA jetonu şifre sıfırlamada KULLANILAMAZ", async () => {
    // Bu kontrol olmasaydı, elinde eski bir doğrulama bağlantısı olan biri
    // hesabın şifresini değiştirebilirdi.
    const { kayitlar } = kur();
    const { jetonOlustur, JETON_AMACLARI } = await import("@/lib/dogrulama-jetonu");
    const dogrulama = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      AHMET_EPOSTA,
      10_000
    );

    const { status } = await cagir(dogrulama, "YeniSifre456");

    expect(status).toBe(400);
    expect(kayitlar("user").find((k) => k.id === AHMET)!.password).toBe(SIFRE_HASH);
  });

  it("KAYIT KURALLARINI aşan şifreyi reddeder", async () => {
    // Kayıt ve sıfırlama aynı kuralı paylaşıyor; iki ayrı kopya,
    // sıfırlama yoluyla kayıtta kabul edilmeyen bir şifre konabilmesi
    // demekti.
    kur();
    const jeton = await jetonAl();

    expect((await cagir(jeton, "kisa1")).status).toBe(400);
    // Rakamsız şifre de reddedilmeli.
    expect((await cagir(jeton, "yalnizcaharf")).status).toBe(400);
  });
});

/* ========================================================================== */
/* E-posta doğrulama                                                          */
/* ========================================================================== */

describe("POST /api/auth/verify", () => {
  const cagir = async (token: string) => {
    const { POST } = await import("@/app/api/auth/verify/route");
    return yanit(await POST(jsonIstek("/api/auth/verify", "POST", { token })));
  };

  it("geçerli jetonla emailVerified'ı doldurur", async () => {
    const { kayitlar } = kur();
    const { jetonOlustur, JETON_AMACLARI, EPOSTA_DOGRULAMA_OMRU_MS } = await import(
      "@/lib/dogrulama-jetonu"
    );
    const jeton = await jetonOlustur(
      JETON_AMACLARI.epostaDogrulama,
      AHMET_EPOSTA,
      EPOSTA_DOGRULAMA_OMRU_MS
    );

    const { status } = await cagir(jeton);

    expect(status).toBe(200);
    expect(kayitlar("user").find((k) => k.id === AHMET)!.emailVerified).toBeInstanceOf(
      Date
    );
  });

  it("SIFIRLAMA jetonu doğrulamada KULLANILAMAZ", async () => {
    const { kayitlar } = kur();
    const { jetonOlustur, JETON_AMACLARI } = await import("@/lib/dogrulama-jetonu");
    const sifirlama = await jetonOlustur(
      JETON_AMACLARI.sifreSifirlama,
      AHMET_EPOSTA,
      10_000
    );

    const { status } = await cagir(sifirlama);

    expect(status).toBe(400);
    expect(kayitlar("user").find((k) => k.id === AHMET)!.emailVerified).toBeNull();
  });
});

describe("POST /api/auth/verify-request", () => {
  const cagir = async () => {
    const { POST } = await import("@/app/api/auth/verify-request/route");
    return yanit(await POST());
  };

  it("oturum yoksa 401 döner", async () => {
    authMock.requireUser.mockResolvedValue(oturumYok());
    kur();

    expect((await cagir()).status).toBe(401);
    expect(epostaMock.gonder).not.toHaveBeenCalled();
  });

  it("e-posta yapılandırılmamışsa 503 döner", async () => {
    epostaMock.yapilandirilmis.mockReturnValue(false);
    kur();

    expect((await cagir()).status).toBe(503);
  });

  it("ZATEN DOĞRULANMIŞ hesaba posta göndermez", async () => {
    authMock.requireUser.mockResolvedValue(oturum("kullanici-google"));
    kur();

    const { status } = await cagir();

    // 200: kullanıcının istediği durum (doğrulanmış olmak) zaten sağlanmış.
    expect(status).toBe(200);
    expect(epostaMock.gonder).not.toHaveBeenCalled();
  });

  it("doğrulanmamış hesaba jeton üretip gönderir", async () => {
    const { kayitlar } = kur();

    const { status } = await cagir();

    expect(status).toBe(200);
    expect(kayitlar("verificationToken")[0].identifier).toBe(
      `eposta-dogrulama:${AHMET_EPOSTA}`
    );
    expect(epostaMock.gonder).toHaveBeenCalledTimes(1);
  });

  it("sağlayıcı hata verirse 502 döner", async () => {
    // Kullanıcıya "gönderildi" demek, gelmeyen bir postayı beklemesine
    // yol açardı.
    epostaMock.gonder.mockResolvedValue(false);
    kur();

    expect((await cagir()).status).toBe(502);
  });
});

/* ========================================================================== */
/* Hesap silme                                                                */
/* ========================================================================== */

describe("DELETE /api/profile", () => {
  const cagir = async (onay: string) => {
    const { DELETE } = await import("@/app/api/profile/route");
    return yanit(await DELETE(jsonIstek("/api/profile", "DELETE", { onay })));
  };

  it("YANLIŞ şifreyle hesabı SİLMEZ", async () => {
    const { kayitlar } = kur();

    const { status } = await cagir("YanlisSifre999");

    expect(status).toBe(401);
    expect(kayitlar("user").some((k) => k.id === AHMET)).toBe(true);
  });

  it("doğru şifreyle hesabı siler", async () => {
    const { kayitlar } = kur();

    const { status } = await cagir(SIFRE);

    expect(status).toBe(200);
    expect(kayitlar("user").some((k) => k.id === AHMET)).toBe(false);
  });

  it("ŞİFRESİZ hesapta E-POSTA ADRESİ isteniyor", async () => {
    // Google hesabında doğrulanacak şifre yok; adresi elle yazdırmak,
    // kazara silmenin önüne geçen en yakın karşılık.
    authMock.requireUser.mockResolvedValue(oturum("kullanici-google"));
    const { kayitlar } = kur();

    expect((await cagir("uydurma@ornek.test")).status).toBe(401);
    expect(kayitlar("user").some((k) => k.id === "kullanici-google")).toBe(true);

    expect((await cagir("GOOGLE@ornek.test")).status).toBe(200);
    expect(kayitlar("user").some((k) => k.id === "kullanici-google")).toBe(false);
  });

  it("onay alanı boşsa 400 döner", async () => {
    kur();
    expect((await cagir("")).status).toBe(400);
  });

  it("oturum yoksa 401 döner", async () => {
    authMock.requireUser.mockResolvedValue(oturumYok());
    const { kayitlar } = kur();

    expect((await cagir(SIFRE)).status).toBe(401);
    expect(kayitlar("user").some((k) => k.id === AHMET)).toBe(true);
  });
});

/* ========================================================================== */
/* Doğrulama durumu plan kotasını belirliyor                                  */
/* ========================================================================== */

describe("POST /api/trip-plan-model — kota", () => {
  const govde = { city: "Roma" };

  async function planIste(userId: string) {
    const { POST } = await import("@/app/api/trip-plan-model/route");
    return yanit(
      await POST(jsonIstek("/api/trip-plan-model", "POST", govde) as never)
    );
  }

  beforeEach(() => {
    vi.doMock("@/lib/plan-job", () => ({
      devamEdenIs: vi.fn().mockResolvedValue(null),
      isOlustur: vi.fn().mockResolvedValue({ id: "is-1", status: "QUEUED" }),
      calistir: vi.fn(),
    }));
  });

  it("DOĞRULANMAMIŞ hesapta saatlik hak 1", async () => {
    // Sahte adreslerle açılan hesapların LLM maliyetini sınırlıyor:
    // bir plan üretimi en kötü durumda 8 ardışık model çağrısı.
    const id = `dogrulanmamis-${Date.now()}`;
    authMock.requireUser.mockResolvedValue(oturum(id));
    kur({
      user: [{ id, email: `${id}@ornek.test`, password: SIFRE_HASH, emailVerified: null }],
    });

    expect((await planIste(id)).status).toBe(202);

    const ikinci = await planIste(id);
    expect(ikinci.status).toBe(429);
    // Kullanıcıya ÇIKIŞ YOLU gösteriliyor.
    expect(String(ikinci.body.error)).toContain("doğrularsanız");
    expect(ikinci.body.emailVerified).toBe(false);
  });

  it("DOĞRULANMIŞ hesapta ikinci istek de geçiyor", async () => {
    const id = `dogrulanmis-${Date.now()}`;
    authMock.requireUser.mockResolvedValue(oturum(id));
    kur({
      user: [
        {
          id,
          email: `${id}@ornek.test`,
          password: SIFRE_HASH,
          emailVerified: new Date(2026, 0, 1),
        },
      ],
    });

    expect((await planIste(id)).status).toBe(202);
    expect((await planIste(id)).status).toBe(202);
  });
});
