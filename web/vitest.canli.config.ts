import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * CANLI testler — gerçek dış servislere çıkar.
 *
 * NEDEN AYRI YAPILANDIRMA: bu testler ağ, anahtar ve sağlayıcı erişimi
 * ister. Varsayılan süite karıştıklarında CI, kendi kodumuzda hiçbir şey
 * bozulmamışken Tavily kesintisi yüzünden kırmızı yanıyordu. Mock'lu
 * testler kodun sözleşmesini, canlı testler sözleşmenin gerçek dünyada
 * tuttuğunu doğruluyor; ikisi de gerekli ama aynı anda değil.
 *
 * Anahtar tanımsızsa testler kendini atlar (`describe.skipIf`).
 */

/**
 * `.env` / `.env.local` dosyalarını `process.env`e taşır.
 *
 * NEDEN GEREKLİ: Vite kendiliğinden yalnızca `VITE_` önekli değişkenleri ve
 * yalnızca `import.meta.env` içine yüklüyor. Canlı testler ise anahtarları
 * `process.env.OPENROUTER_API_KEY` gibi doğrudan okuyor. Bu satır olmadan
 * anahtarlar `.env.local`de dururken bile tanımsız görünüyor ve testler
 * `skipIf` ile SESSİZCE ATLANIYORDU — yani "canlı test yeşil" sanılırken
 * aslında hiç koşmuyorlardı.
 *
 * Üçüncü argüman olan boş önek "hepsini yükle" demek; bu dosya yalnızca
 * yerel/zamanlanmış canlı koşumda kullanılıyor, bundle'a hiçbir şey
 * gömülmüyor.
 */
const yerelEnv = loadEnv("", process.cwd(), "");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.canli.test.ts"],
    // Dış servis çağrıları saniyeler sürebiliyor.
    testTimeout: 40_000,
    isolate: true,
    // Kabuktan gelen değer `.env.local`i EZER: CI'da sır yöneticisinden
    // gelen anahtar, repodaki yerel dosyadan önce gelmeli.
    env: { ...yerelEnv, ...process.env },
  },
});
