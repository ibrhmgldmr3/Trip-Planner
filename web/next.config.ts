import type { NextConfig } from "next";

/**
 * Uygulama genelinde uygulanan güvenlik başlıkları.
 *
 * CSP BURADA DEĞİL: nonce her istekte değiştiği için politika statik
 * olamaz; `src/middleware.ts` üretiyor. Buradakiler istekten bağımsız,
 * sabit başlıklar.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Konum izni harita sayfasında kullanılıyor, kendi origin'imize açık.
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  // Sunucu sürüm bilgisini sızdırma.
  poweredByHeader: false,

  // Docker imajı için: node_modules'ün tamamı yerine yalnızca gereken
  // dosyaları içeren, kendi kendine yeten bir çıktı üretir.
  output: "standalone",

  // Repo kökünde başka bir lockfile varsa Next yanlış kökü seçebiliyor.
  outputFileTracingRoot: __dirname,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
