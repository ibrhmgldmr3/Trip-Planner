import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Roboto, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import MobileMenu from "@/components/MobileMenu";
import AuthProvider from "@/providers/AuthProvider";
import ThemeProvider from "@/context/ThemeContext";

/**
 * DİKKAT — `latin-ext` ZORUNLU.
 *
 * Alt küme yalnızca "latin" iken ğ, ş, İ, ı, Ğ, Ş glifleri fontta yok
 * sayılıyor ve tarayıcı o harfleri yedek fonta (Arial) düşürüyordu.
 * Sonuç: Türkçe metinlerde harf harf değişen bir tipografi. Uygulamanın
 * dili `tr`; bu alt küme bir tercih değil, gereklilik.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const roboto = Roboto({
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

/**
 * Başlık fontu.
 *
 * Başlıklar serif, gövde sans: ikisi arasındaki fark hiyerarşiyi punto ve
 * kalınlık büyütmeden kuruyor. Eskiden hiyerarşi yalnızca boyutla
 * anlatılıyordu (kart içinde `text-2xl font-bold` başlıklar) ve sayfa
 * bağırıyordu.
 */
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trip Planner - Seyahat Planlayıcı",
  description: "Seyahatlerinizi planlamanın en kolay yolu",
  keywords: "seyahat planlama, gezi rotası, harita, POI, şehir gezisi",
  authors: [{ name: "İbrahim Güldemir" }],
};

/**
 * Hydration ÖNCESİ senkron çalışır: kayıtlı tercihe, yoksa sistem tercihine
 * göre <html>'e 'dark' sınıfını basar. Bu olmadan ilk boyamada yanlış tema
 * görünür (FOUC). Anahtar, ThemeContext'teki TEMA_ANAHTARI ile aynı olmalı.
 */
const temaScript = `
(function () {
  try {
    var kayitli = localStorage.getItem('theme');
    var koyu = kayitli === 'dark' ||
      (kayitli !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', koyu);
  } catch (e) {
    // Depolama engelliyse varsayılan aydınlık temayla devam edilir.
  }
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CSP nonce'u middleware üretiyor ve istek başlığına koyuyor. Satır-içi
  // tema script'i bu nonce olmadan CSP zorlama modunda çalışmaz.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} ${sourceSerif.variable}`}
    >
      <head>
        {/*
          BİLİNEN, KABUL EDİLMİŞ UYUMSUZLUK — geliştirme konsolunda
          "nonce" için bir hydration uyarısı görürsünüz.

          Sebep: tarayıcılar ayrıştırmadan sonra `nonce` ÖZNİTELİĞİNİ
          güvenlik gereği gizliyor; `getAttribute("nonce")` boş string
          dönüyor. React sunucudaki `nonce="..."` ile istemcideki `nonce=""`i
          karşılaştırıp fark buluyor. `suppressHydrationWarning` React 19'da
          bu özniteliği kapsamıyor (denendi, uyarı sürüyor).

          Neden böyle bırakıldı: uyarı DÜZELTİLEBİLİR sınıfta — script zaten
          çalışmış durumda, işlevsel etkisi yok. Nonce'u kaldırmak ise CSP
          zorlama moduna geçildiğinde tema script'ini tamamen bloke ederdi
          (FOUC + yanlış tema). Güvenlik, konsol temizliğinden önce gelir.
          Kalıcı çözüm nonce yerine CSP hash'i kullanmak; script sabit
          olduğu için mümkün, ama ayrı bir iş.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: temaScript }}
        />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          <ThemeProvider>
            <MobileMenu />
            <main className="relative">
              {children}
            </main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

