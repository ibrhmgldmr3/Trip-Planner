import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Birim ve handler test yapılandırması.
 *
 * İki katman var:
 *  - `tests/*.test.ts`        → saf fonksiyonlar ve şemalar
 *  - `tests/routes/*.test.ts` → route handler'lar; Prisma ve oturum
 *                               `vi.mock` ile değiştiriliyor
 *                               (bkz. tests/helpers/fake-prisma.ts)
 *
 * Gerçek veritabanına dokunan uçtan uca akış Playwright'in konusu (e2e/).
 *
 * `@/*` alias'ı tsconfig'deki `paths` ile aynı hedefe çözülmeli: baseUrl
 * `./src` olduğu için `@/lib/x` pratikte `src/lib/x` dosyasına iniyor.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // isomorphic-dompurify kendi jsdom'unu getiriyor; ayrı bir DOM ortamına
    // gerek yok, testler Node altında koşuyor.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Yardımcılar test değil; `include` deseni zaten .test.ts arıyor ama
    // açıkça dışlamak yeni bir yardımcı eklendiğinde sürprizi engelliyor.
    exclude: ["tests/helpers/**", "node_modules/**", "e2e/**"],
    // Sayaçları process belleğinde tutan modüller (rate-limit) var; her test
    // dosyası kendi modül kaydını görsün diye izolasyon açık bırakılıyor.
    isolate: true,
  },
});
