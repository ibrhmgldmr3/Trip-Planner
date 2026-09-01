import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

/**
 * `.env.local` / `.env` dosyalarını bu SÜREÇE de yükle.
 *
 * Next.js bunu kendi sunucusunda otomatik yapıyor ama Playwright'in
 * yapılandırma dosyası ayrı bir Node süreci: `process.env.DATABASE_URL`
 * burada tanımsızdı ve aşağıdaki `env` bloğu sunucuya boş string
 * geçiriyordu. Sonuç, teşhisi zor bir hataydı — sayfalar açılıyor ama her
 * API isteği env doğrulamasında patlıyordu.
 */
loadEnvConfig(process.cwd());

/**
 * Uçtan uca test yapılandırması (Aşama 2).
 *
 * Birim ve handler testleri (vitest) Prisma'yı taklit ediyor; buradaki
 * testler GERÇEK veritabanına ve gerçek Next.js sunucusuna karşı koşuyor.
 * İkisi farklı soruları cevaplıyor:
 *
 *   vitest  → "bu handler doğru sorguyu mu yazıyor?"
 *   e2e     → "kullanıcı gerçekten kayıt olup plan görebiliyor mu?"
 *
 * ÇALIŞTIRMA
 *   1. Boş bir PostgreSQL veritabanı hazırlayın.
 *   2. `E2E_DATABASE_URL` (yoksa `DATABASE_URL`) ile şemayı uygulayın:
 *        npx prisma migrate deploy
 *   3. npm run test:e2e
 *
 * Testler kendi kullanıcılarını kayıt akışıyla oluşturuyor; hazır veri
 * (fixture) gerektirmiyor. AI plan üretimi dışarıdaki OpenRouter'a bağlı
 * olduğu için e2e'de KAPSANMIYOR — akış manuel planlayıcı üzerinden
 * doğrulanıyor (bkz. e2e/plan-akisi.spec.ts).
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const VERITABANI_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

if (!VERITABANI_URL) {
  // Boş string geçirmek sunucuyu AYAĞA KALDIRIYOR ama her API isteğini
  // env doğrulamasında düşürüyordu; testler "buton çalışmıyor" gibi
  // görünen bir hatayla patlıyordu. Burada erken ve net duruyoruz.
  throw new Error(
    "E2E için veritabanı adresi bulunamadı. `.env.local` içinde DATABASE_URL " +
      "tanımlayın ya da E2E_DATABASE_URL ortam değişkenini verin."
  );
}

export default defineConfig({
  testDir: "./e2e",
  // Aynı kullanıcı havuzunu paylaşan testler yarışmasın.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    // Hata ayıklamayı ucuz tut: yalnızca başarısız denemede iz ve ekran
    // görüntüsü saklanıyor.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Sunucuyu Playwright başlatıyor. `reuseExistingServer` yerelde açık bir
  // dev sunucusu varsa onu kullanır; CI'da her zaman temiz başlar.
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: VERITABANI_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-test-secret-degistirin",
      NEXTAUTH_URL: BASE_URL,
      // AI ucu e2e'de çağrılmıyor; env doğrulaması geçsin diye yer tutucu.
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "e2e-placeholder",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "e2e-placeholder",
      // Testler tek IP'den (127.0.0.1) art arda birçok kullanıcı açıyor;
      // üretimdeki saatte-5 sınırı burada testleri boğardı.
      REGISTER_RATE_LIMIT_PER_HOUR: process.env.REGISTER_RATE_LIMIT_PER_HOUR ?? "1000",
      // TOGETHER_API_KEY / TAVILY_API_KEY / GOOGLE_MAPS_SERVER_API_KEY
      // BİLEREK geçirilmiyor: agentic üretim, web arama ve geocoding
      // e2e'de dış servislere gerçek istek atardı. Üçü de tanımsızken
      // uygulamanın çalışmaya devam etmesi zaten test edilmek istenen
      // davranış.
    },
  },
});
