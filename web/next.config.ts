import type { NextConfig } from "next";

/**
 * Uygulama genelinde uygulanan güvenlik başlıkları.
 *
 * CSP burada bilinçli olarak tanımlı DEĞİL: harita sayfaları Google Maps JS
 * API'sini runtime'da <script> enjekte ederek yüklüyor ve inline style
 * kullanıyor. Anlamlı bir CSP için önce nonce tabanlı bir script yükleme
 * stratejisine geçilmeli — aksi halde 'unsafe-inline' içeren, koruma
 * sağlamayan bir CSP yazmış oluruz.
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

  // Repo kökünde başka bir lockfile varsa Next yanlış kökü seçebiliyor.
  outputFileTracingRoot: __dirname,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
