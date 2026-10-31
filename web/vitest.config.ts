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
  // JSX'i OTOMATİK runtime ile derle.
  //
  // `tsconfig.json` `"jsx": "preserve"` diyor — doğrusu bu, çünkü JSX'i
  // Next derliyor. Ama vitest kendi esbuild'ini kullanıyor ve `preserve`
  // gördüğünde klasik runtime'a düşüp `React.createElement` üretiyor;
  // dosyada `import React` olmadığı için test "React is not defined" ile
  // patlıyordu. `automatic` runtime import'u kendi ekliyor.
  esbuild: { jsx: "automatic" },
  test: {
    // isomorphic-dompurify kendi jsdom'unu getiriyor; ayrı bir DOM ortamına
    // gerek yok, testler Node altında koşuyor.
    environment: "node",
    // `.tsx` de dahil: bazı testler bir React bileşenini
    // `renderToStaticMarkup` ile basıp çıktısını doğruluyor
    // (bkz. tests/butce-dokumu.test.tsx). jsdom gerekmiyor — bileşenin
    // etkileşimi yok, tek yaptığı veriyi biçimlendirmek.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Yardımcılar test değil; `include` deseni zaten .test.ts arıyor ama
    // açıkça dışlamak yeni bir yardımcı eklendiğinde sürprizi engelliyor.
    //
    // `*.canli.test.ts` VARSAYILAN KOŞUDA YOK: bu testler gerçek dış
    // servislere (Tavily) çıkıyor. Ağa bağımlı bir test süiti hem yavaş
    // hem de sağlayıcı kesintisinde kırmızı yanar — CI'da yanlış alarm
    // üretir. `npm run test:canli` ile bilinçli olarak çalıştırılıyor.
    exclude: [
      "tests/helpers/**",
      "node_modules/**",
      "e2e/**",
      "tests/**/*.canli.test.ts",
      "tests/**/*.canli.test.tsx",
    ],
    // Sayaçları process belleğinde tutan modüller (rate-limit) var; her test
    // dosyası kendi modül kaydını görsün diye izolasyon açık bırakılıyor.
    isolate: true,
  },
});
