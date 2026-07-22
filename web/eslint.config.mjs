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
];

export default eslintConfig;
