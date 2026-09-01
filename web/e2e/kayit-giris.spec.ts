import { expect, test } from "@playwright/test";
import { yeniKullanici, kayitOl, girisYap, cikisYap } from "./yardimcilar";

/**
 * Kimlik akışı.
 *
 * Denetimde bu akışta üç hata bulunmuştu; her biri burada bir testle
 * karşılanıyor:
 *   - Şemadaki Türkçe doğrulama mesajları kullanıcıya hiç ulaşmıyordu
 *     (`format()._errors[0]` alan hatalarında daima undefined).
 *   - Korumalı sayfalar yalnızca istemcide korunuyordu; giriş yapmamış
 *     kullanıcı sayfayı bir an görüyordu.
 *   - "Kullanıcı yok" ile "şifre yanlış" ayrımı numaralandırmaya açıktı.
 */

test.describe("kayıt ve giriş", () => {
  test("yeni kullanıcı kayıt olup giriş yapabilir", async ({ page }) => {
    const kullanici = yeniKullanici();

    await kayitOl(page, kullanici);
    await girisYap(page, kullanici);

    // Giriş sonrası korumalı bir sayfa açılabiliyor.
    await page.goto("/my-plans");
    await expect(page).toHaveURL(/\/my-plans/);
  });

  test("zayıf şifre için TÜRKÇE hata gösterilir", async ({ page }) => {
    const kullanici = yeniKullanici();

    await page.goto("/register");
    await page.locator("#name").fill(kullanici.name);
    await page.locator("#email").fill(kullanici.email);

    // Rakam içermeyen şifre: şema "Şifre en az bir rakam içermelidir" diyor.
    await page.locator("#password").fill("sadeceharfler");
    const sifreTekrari = page.locator("#confirmPassword");
    if (await sifreTekrari.count()) {
      await sifreTekrari.fill("sadeceharfler");
    }

    const sartlar = page.locator("#terms");
    if (await sartlar.count()) {
      await sartlar.check();
    }

    // `button[type="submit"]`: rol adı eşleştirmesi "Google ile Kayıt
    // Ol" butonuyla çakışıyordu (regex kısmi eşleşme yapıyor).
    await page.locator('button[type="submit"]').click();

    // Eskiden burada İngilizce "Form validation failed" görünüyordu.
    await expect(page.getByText(/rakam|karakter|geçerli/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Form validation failed/i)).toHaveCount(0);
  });

  test("hatalı şifre, kullanıcının varlığını ele vermez", async ({ page }) => {
    const kullanici = yeniKullanici();
    await kayitOl(page, kullanici);
    await cikisYap(page);

    // Kayıtlı e-posta + yanlış şifre
    await page.goto("/login");
    await page.locator("#email").fill(kullanici.email);
    await page.locator("#password").fill("kesinlikleYanlis1");
    // Aynı çakışma "Google ile Giriş Yap" için de geçerli.
    await page.locator('button[type="submit"]').click();

    const kayitliMesaj = await page
      .getByText(/hatalı|geçersiz/i)
      .first()
      .textContent({ timeout: 10_000 });

    // Hiç kayıtlı olmayan e-posta + herhangi bir şifre
    await page.goto("/login");
    await page.locator("#email").fill(`yok-${Date.now()}@ornek.test`);
    await page.locator("#password").fill("kesinlikleYanlis1");
    // Aynı çakışma "Google ile Giriş Yap" için de geçerli.
    await page.locator('button[type="submit"]').click();

    const kayitsizMesaj = await page
      .getByText(/hatalı|geçersiz/i)
      .first()
      .textContent({ timeout: 10_000 });

    // İki mesaj AYNI olmalı; farklı olması hangi e-postaların kayıtlı
    // olduğunu söyler.
    expect(kayitsizMesaj?.trim()).toBe(kayitliMesaj?.trim());
  });
});

test.describe("korumalı rotalar", () => {
  const korumali = [
    "/my-plans",
    "/budget",
    "/daily-planner",
    "/manual-planner",
    "/ai-planner",
    "/profile",
  ];

  for (const yol of korumali) {
    test(`giriş yapmadan ${yol} açılamaz`, async ({ page }) => {
      await page.goto(yol);

      // Middleware sunucu tarafında yönlendiriyor; sayfa hiç görünmüyor.
      await expect(page).toHaveURL(/\/login/);
      // callbackUrl uygulama içi bir yol olmalı, tam URL değil
      // (açık yönlendirme yüzeyi).
      const url = new URL(page.url());
      const callback = url.searchParams.get("callbackUrl");
      expect(callback?.startsWith("/")).toBe(true);
    });
  }
});
