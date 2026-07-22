import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Birim test yapılandırması.
 *
 * Kapsam bilinçli olarak dar: yalnızca saf fonksiyonlar ve şemalar test
 * ediliyor. Route handler'ları burada koşturulmuyor — Prisma, next-auth ve
 * OpenRouter'a bağlı oldukları için onlar entegrasyon testinin konusu.
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
    // Sayaçları process belleğinde tutan modüller (rate-limit) var; her test
    // dosyası kendi modül kaydını görsün diye izolasyon açık bırakılıyor.
    isolate: true,
  },
});
