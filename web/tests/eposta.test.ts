import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  epostaDogrulamaMesaji,
  epostaGonder,
  epostaYapilandirilmisMi,
  sifreSifirlamaMesaji,
  uygulamaAdresi,
} from "@/lib/eposta";

/**
 * İŞLEMSEL E-POSTA (B9).
 *
 * En kritik iddia BAĞLANTININ DOĞRULUĞU: akışın geri kalanı kusursuz
 * çalışsa bile yanlış bir bağlantı kullanıcıyı hesabından kilitler ve
 * bunu ancak destek kanalından öğrenebiliriz.
 *
 * İkinci iddia: gönderim HİÇ FIRLATMIYOR. Kayıt akışı doğrulama postasını
 * en iyi çaba olarak gönderiyor; buradan çıkan bir hata, kullanıcıyı
 * hesabı açılmadan geri çevirirdi.
 */

const ESKI_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EPOSTA_GONDEREN = "Trip Planner <bilgi@ornek.test>";
  process.env.APP_URL = "https://tripplanner.ornek.test";
});

afterEach(() => {
  process.env = { ...ESKI_ENV };
});

describe("epostaYapilandirilmisMi", () => {
  it("iki değişken de tanımlıysa true", () => {
    expect(epostaYapilandirilmisMi()).toBe(true);
  });

  it("BİRİ EKSİKSE false", () => {
    // Yarım yapılandırma, gönderimi sessizce başarısız kılan en yaygın
    // hata: anahtar konur, gönderen adresi unutulur.
    delete process.env.EPOSTA_GONDEREN;
    expect(epostaYapilandirilmisMi()).toBe(false);

    process.env.EPOSTA_GONDEREN = "x@ornek.test";
    delete process.env.RESEND_API_KEY;
    expect(epostaYapilandirilmisMi()).toBe(false);
  });
});

describe("uygulamaAdresi", () => {
  it("sondaki eğik çizgileri atar", () => {
    // Aksi halde bağlantı "https://site//reset-password" oluyor; çoğu
    // sunucu tolere ediyor ama bazıları 404 veriyor.
    process.env.APP_URL = "https://ornek.test///";
    expect(uygulamaAdresi()).toBe("https://ornek.test");
  });

  it("tanımsızsa yerel adrese düşer", () => {
    delete process.env.APP_URL;
    expect(uygulamaAdresi()).toBe("http://localhost:3000");
  });
});

describe("şablonlar", () => {
  it("sıfırlama bağlantısı doğru sayfaya gidiyor", () => {
    const mesaj = sifreSifirlamaMesaji("ahmet@ornek.test", "jeton-123");

    expect(mesaj.metin).toContain(
      "https://tripplanner.ornek.test/reset-password?token=jeton-123"
    );
    expect(mesaj.kime).toBe("ahmet@ornek.test");
  });

  it("doğrulama bağlantısı doğru sayfaya gidiyor", () => {
    const mesaj = epostaDogrulamaMesaji("ahmet@ornek.test", "jeton-456");

    expect(mesaj.metin).toContain(
      "https://tripplanner.ornek.test/verify-email?token=jeton-456"
    );
  });

  it("jetonu URL için KAÇIŞLIYOR", () => {
    // base64url normalde güvenli karakterler üretiyor, ama kaçışlamayı
    // şablona bırakmak jeton biçimi değiştiğinde sessizce bozulurdu.
    const mesaj = sifreSifirlamaMesaji("a@ornek.test", "a+b/c=d");
    expect(mesaj.metin).toContain("token=a%2Bb%2Fc%3Dd");
  });

  it("sıfırlama postası tek kullanımlık ve süreli olduğunu SÖYLÜYOR", () => {
    // Kullanıcı bağlantıyı bir hafta sonra açıp "site bozuk" dememeli.
    const mesaj = sifreSifirlamaMesaji("a@ornek.test", "x");
    expect(mesaj.metin).toContain("1 saat");
    expect(mesaj.metin).toContain("bir kez");
  });

  it("düz metin gövde HER ZAMAN dolu", () => {
    // HTML'i engelleyen istemcilerde ve spam puanlamasında düz metin
    // karşılığı olmayan posta ya okunmuyor ya hiç ulaşmıyor.
    expect(sifreSifirlamaMesaji("a@ornek.test", "x").metin.length).toBeGreaterThan(50);
    expect(epostaDogrulamaMesaji("a@ornek.test", "x").metin.length).toBeGreaterThan(50);
  });
});

describe("epostaGonder", () => {
  it("yapılandırma yoksa ÇAĞRI YAPMADAN false döner", async () => {
    delete process.env.RESEND_API_KEY;
    const casus = vi.spyOn(globalThis, "fetch");

    expect(await epostaGonder({ kime: "a@b.test", konu: "k", metin: "m" })).toBe(false);
    expect(casus).not.toHaveBeenCalled();
  });

  it("sağlayıcıya doğru gövdeyi gönderir", async () => {
    const casus = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    expect(
      await epostaGonder({ kime: "a@b.test", konu: "Konu", metin: "Gövde" })
    ).toBe(true);

    const [url, secenekler] = casus.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");

    const govde = JSON.parse(secenekler.body as string);
    expect(govde.to).toEqual(["a@b.test"]);
    expect(govde.subject).toBe("Konu");
    expect(govde.text).toBe("Gövde");
    // HTML verilmediyse alan HİÇ gönderilmiyor; boş string bazı
    // sağlayıcılarda boş bir HTML gövdesi olarak yorumlanıyor.
    expect(govde).not.toHaveProperty("html");
  });

  it("sağlayıcı hata dönerse false döner, FIRLATMAZ", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 422 })
    );

    await expect(
      epostaGonder({ kime: "a@b.test", konu: "k", metin: "m" })
    ).resolves.toBe(false);
  });

  it("ağ hatasında da FIRLATMAZ", async () => {
    // Kayıt akışı bu çağrıyı en iyi çaba olarak yapıyor; buradan çıkan bir
    // hata kullanıcıyı hesabı açılmadan geri çevirirdi.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ağ koptu"));

    await expect(
      epostaGonder({ kime: "a@b.test", konu: "k", metin: "m" })
    ).resolves.toBe(false);
  });
});
