import { expect, type Page } from "@playwright/test";

/**
 * E2E testleri için ortak akışlar.
 *
 * Testler hazır veri (fixture) kullanmıyor; her test kendi kullanıcısını
 * kayıt akışıyla oluşturuyor. Böylece testler birbirinden bağımsız ve
 * veritabanı durumuna duyarsız kalıyor.
 */

export interface TestKullanicisi {
  name: string;
  email: string;
  password: string;
}

let sayac = 0;

/** Her çağrıda benzersiz bir kullanıcı üretir. */
export function yeniKullanici(): TestKullanicisi {
  sayac += 1;
  const damga = `${Date.now()}-${sayac}`;

  return {
    name: `Test Kullanıcı ${sayac}`,
    email: `e2e-${damga}@ornek.test`,
    // Şema en az 8 karakter + bir harf + bir rakam istiyor.
    password: "Deneme12345",
  };
}

export async function kayitOl(page: Page, kullanici: TestKullanicisi) {
  await page.goto("/register");

  // Label metnine göre eşleştirme (`/ad/i`) KIRILGAN: gerçek etiket "İsim",
  // içinde "ad" alt dizisi yok. `id` alanları formun asıl sözleşmesi;
  // buradan eşleştirmek Türkçe metin/regex uyuşmazlıklarına dayanıklı.
  await page.locator("#name").fill(kullanici.name);
  await page.locator("#email").fill(kullanici.email);
  await page.locator("#password").fill(kullanici.password);

  const sifreTekrari = page.locator("#confirmPassword");
  if (await sifreTekrari.count()) {
    await sifreTekrari.fill(kullanici.password);
  }

  // "Kullanım şartları" onay kutusu `required`: işaretlenmezse tarayıcı
  // native doğrulaması submit'i JS handler'a hiç ulaştırmadan durduruyor.
  const sartlar = page.locator("#terms");
  if (await sartlar.count()) {
    await sartlar.check();
  }

  // `button[type="submit"]`: rol adı eşleştirmesi "Google ile Kayıt
  // Ol" butonuyla çakışıyordu (regex kısmi eşleşme yapıyor).
  await page.locator('button[type="submit"]').click();

  // Başarılı kayıttan 2 sn sonra sayfa `signIn("credentials", { callbackUrl:
  // "/" })` çağırıyor ve tam sayfa yönlendirmesi yapıyor; /login'e değil
  // doğrudan "/" adresine düşüyoruz.
  await expect(page).not.toHaveURL(/\/register/, { timeout: 15_000 });
}

export async function girisYap(page: Page, kullanici: TestKullanicisi) {
  await page.goto("/login");

  await page.locator("#email").fill(kullanici.email);
  await page.locator("#password").fill(kullanici.password);
  // Aynı çakışma "Google ile Giriş Yap" için de geçerli.
  await page.locator('button[type="submit"]').click();

  // Oturum kurulunca korumalı sayfa açılabiliyor olmalı.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function cikisYap(page: Page) {
  // NextAuth'un çıkış ucu; menüyü açmaya gerek kalmıyor.
  await page.goto("/api/auth/signout");
  const buton = page.getByRole("button", { name: /sign out|çıkış/i });
  if (await buton.count()) {
    await buton.first().click();
  }
  await page.goto("/");
}

/** Bugünden `gunSonra` gün sonrasının YYYY-MM-DD karşılığı. */
export function ileriTarih(gunSonra: number): string {
  const d = new Date();
  d.setDate(d.getDate() + gunSonra);
  const ay = String(d.getMonth() + 1).padStart(2, "0");
  const gun = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${ay}-${gun}`;
}
