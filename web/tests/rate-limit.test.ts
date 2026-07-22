import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * DİKKAT: `rate-limit` sayaçları modül seviyesinde bir Map'te tutuyor ve
 * `Date.now()` okuyor. Bu yüzden her test kendi key'ini kullanıyor ve zaman
 * sahte zamanlayıcıyla kontrol ediliyor.
 */

const PENCERE = 60_000;

let sayac = 0;
/** Her test için çakışmayan bir key üretir. */
function yeniKey(ad: string): string {
  sayac += 1;
  return `${ad}:${sayac}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit — pencere içi sayım", () => {
  it("ilk istekte limit-1 hak kalır ve retryAfter 0'dır", () => {
    const sonuc = rateLimit(yeniKey("ilk"), 3, PENCERE);
    expect(sonuc).toEqual({ success: true, remaining: 2, retryAfter: 0 });
  });

  it("kalan hak her istekte bir azalır ve limitte 0'a iner", () => {
    const key = yeniKey("azalma");
    expect(rateLimit(key, 3, PENCERE).remaining).toBe(2);
    expect(rateLimit(key, 3, PENCERE).remaining).toBe(1);

    const sonuncu = rateLimit(key, 3, PENCERE);
    expect(sonuncu.success).toBe(true);
    expect(sonuncu.remaining).toBe(0);
  });

  it("limit=1 iken ikinci istek reddedilir", () => {
    const key = yeniKey("tek");
    expect(rateLimit(key, 1, PENCERE).success).toBe(true);
    expect(rateLimit(key, 1, PENCERE).success).toBe(false);
  });
});

describe("rateLimit — pencere dolunca reddetme", () => {
  it("limit aşıldığında success false, remaining 0 döner", () => {
    const key = yeniKey("asim");
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(key, 3, PENCERE).success).toBe(true);
    }

    const asan = rateLimit(key, 3, PENCERE);
    expect(asan.success).toBe(false);
    expect(asan.remaining).toBe(0);
  });

  it("aşımdan sonraki her istek de reddedilmeye devam eder", () => {
    const key = yeniKey("israrli");
    rateLimit(key, 2, PENCERE);
    rateLimit(key, 2, PENCERE);

    expect(rateLimit(key, 2, PENCERE).success).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(rateLimit(key, 2, PENCERE).success).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(rateLimit(key, 2, PENCERE).success).toBe(false);
  });
});

describe("rateLimit — retryAfter hesabı", () => {
  it("pencerenin başında reddedilirse tüm pencere kadar bekletir", () => {
    const key = yeniKey("retry-bas");
    rateLimit(key, 1, PENCERE);

    const red = rateLimit(key, 1, PENCERE);
    expect(red.success).toBe(false);
    // 60_000 ms pencere, hemen ardından red → 60 saniye.
    expect(red.retryAfter).toBe(60);
  });

  it("pencere ilerledikçe retryAfter azalır", () => {
    const key = yeniKey("retry-azalan");
    rateLimit(key, 1, PENCERE);

    vi.advanceTimersByTime(20_000);
    expect(rateLimit(key, 1, PENCERE).retryAfter).toBe(40);

    vi.advanceTimersByTime(30_000);
    expect(rateLimit(key, 1, PENCERE).retryAfter).toBe(10);
  });

  it("küsuratlı kalan süre yukarı yuvarlanır (Retry-After tam saniye olmalı)", () => {
    const key = yeniKey("retry-kusurat");
    rateLimit(key, 1, PENCERE);

    // 59_500 ms kaldı → 59.5 sn → 60 sn.
    vi.advanceTimersByTime(500);
    expect(rateLimit(key, 1, PENCERE).retryAfter).toBe(60);

    // 500 ms kaldı → 0.5 sn → 1 sn. Asla 0 dönmemeli, yoksa istemci
    // hiç beklemeden yeniden dener.
    vi.advanceTimersByTime(59_000);
    expect(rateLimit(key, 1, PENCERE).retryAfter).toBe(1);
  });

  it("başarılı isteklerde retryAfter her zaman 0'dır", () => {
    const key = yeniKey("retry-basarili");
    expect(rateLimit(key, 5, PENCERE).retryAfter).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(rateLimit(key, 5, PENCERE).retryAfter).toBe(0);
  });
});

describe("rateLimit — pencere sıfırlanması", () => {
  it("pencere dolunca hak yeniden açılır", () => {
    const key = yeniKey("sifirlama");
    rateLimit(key, 2, PENCERE);
    rateLimit(key, 2, PENCERE);
    expect(rateLimit(key, 2, PENCERE).success).toBe(false);

    vi.advanceTimersByTime(PENCERE);

    const yeni = rateLimit(key, 2, PENCERE);
    expect(yeni.success).toBe(true);
    // Sayaç sıfırdan başlamalı; devam ederse ilk istek zaten reddedilirdi.
    expect(yeni.remaining).toBe(1);
  });

  it("pencere dolmadan bir milisaniye önce hâlâ reddeder", () => {
    const key = yeniKey("sinir");
    rateLimit(key, 1, PENCERE);

    vi.advanceTimersByTime(PENCERE - 1);
    expect(rateLimit(key, 1, PENCERE).success).toBe(false);

    vi.advanceTimersByTime(1);
    expect(rateLimit(key, 1, PENCERE).success).toBe(true);
  });

  it("yeni pencere kendi süresini baştan başlatır", () => {
    const key = yeniKey("kayan-pencere");
    rateLimit(key, 1, PENCERE);
    vi.advanceTimersByTime(PENCERE);

    // Yeni pencere burada açılıyor; 59 sn sonra hâlâ aynı pencere içindeyiz.
    rateLimit(key, 1, PENCERE);
    vi.advanceTimersByTime(59_000);
    const red = rateLimit(key, 1, PENCERE);
    expect(red.success).toBe(false);
    expect(red.retryAfter).toBe(1);
  });
});

describe("rateLimit — key izolasyonu", () => {
  it("farklı key'ler birbirinin kotasını tüketmez", () => {
    const a = yeniKey("izole-a");
    const b = yeniKey("izole-b");

    rateLimit(a, 1, PENCERE);
    expect(rateLimit(a, 1, PENCERE).success).toBe(false);

    // b hiç kullanılmadı; a'nın aşımı onu etkilememeli.
    const bSonuc = rateLimit(b, 1, PENCERE);
    expect(bSonuc.success).toBe(true);
    expect(bSonuc.remaining).toBe(0);
  });

  it("aynı ön ek farklı kullanıcı ayrı sayaç demektir", () => {
    const ali = yeniKey("register") + ":1.2.3.4";
    const veli = yeniKey("register") + ":5.6.7.8";

    rateLimit(ali, 2, PENCERE);
    rateLimit(ali, 2, PENCERE);
    expect(rateLimit(ali, 2, PENCERE).success).toBe(false);
    expect(rateLimit(veli, 2, PENCERE).success).toBe(true);
  });

  it("bir key'in penceresi sıfırlanınca diğerininki etkilenmez", () => {
    const a = yeniKey("pencere-a");
    const b = yeniKey("pencere-b");

    rateLimit(a, 1, PENCERE);
    // b daha uzun pencereli.
    rateLimit(b, 1, 5 * PENCERE);

    vi.advanceTimersByTime(PENCERE);
    expect(rateLimit(a, 1, PENCERE).success).toBe(true);
    expect(rateLimit(b, 1, 5 * PENCERE).success).toBe(false);
  });
});

describe("clientIp", () => {
  it("x-forwarded-for zincirinin ilk adresini alır", () => {
    const request = new Request("https://ornek.test/api", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientIp(request)).toBe("203.0.113.7");
  });

  it("tek adresli x-forwarded-for'da boşlukları kırpar", () => {
    const request = new Request("https://ornek.test/api", {
      headers: { "x-forwarded-for": "  203.0.113.7  " },
    });
    expect(clientIp(request)).toBe("203.0.113.7");
  });

  it("x-forwarded-for yoksa x-real-ip'e düşer", () => {
    const request = new Request("https://ornek.test/api", {
      headers: { "x-real-ip": "198.51.100.4" },
    });
    expect(clientIp(request)).toBe("198.51.100.4");
  });

  it("hiçbir başlık yoksa 'unknown' döner", () => {
    const request = new Request("https://ornek.test/api");
    expect(clientIp(request)).toBe("unknown");
  });

  it("başlıksız isteklerde tüm istemciler aynı kovaya düşer", () => {
    // Bu bilinçli bir ödün: proxy arkasında değilken sınır global olur.
    const a = new Request("https://ornek.test/a");
    const b = new Request("https://ornek.test/b");
    expect(clientIp(a)).toBe(clientIp(b));
  });
});
