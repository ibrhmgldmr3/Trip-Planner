import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Birim testleri veritabanına ya da dış servise bağlanmaz.
    env: {
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
