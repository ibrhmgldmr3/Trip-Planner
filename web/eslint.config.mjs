import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Üretilen çıktılar lint'lenmez. (`next lint` bunları kendisi hariç
    // tutuyordu; Next 16'da kaldırılacağı için `eslint .`e geçtik.)
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Loglama tek kapıdan geçer: `@/lib/logger`. Doğrudan `console.*`
    // kullanımı hem PII maskelemesini hem de seviye filtresini atlıyor.
    rules: {
      "no-console": "error",
    },
  },
  {
    // Tek istisna: logger'ın kendisi, altında console'a yazmak zorunda.
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    /**
     * Harita sayfasında `any` YASAK.
     *
     * Bu dosya 11 yerde `(window as any).google` yazıyordu ve
     * `@types/google.maps` kurulu olduğu hâlde kullanılmıyordu. Tiplendirme
     * sırasında iki gerçek hata ortaya çıktı: `POI.geometry.location` elle
     * yazılmış bir yapıyla `LatLngLiteral` arasında karışıyordu ve rota
     * ölçüleri (`distanceMeters` / `durationMillis`) `undefined`
     * gelebildiği hâlde koşulsuz bölünüyordu — ekranda "NaN km" yazıyordu.
     *
     * Kural dosyaya özel: projenin geri kalanında `any` zaten yok, ama en
     * kırılgan ve en uzun ekran burası ve `any` buraya geri sızmamalı.
     */
    files: ["src/app/map/page.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default eslintConfig;
