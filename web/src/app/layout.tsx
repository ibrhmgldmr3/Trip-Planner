import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";
import MobileMenu from "@/components/MobileMenu";
import AuthProvider from "@/providers/AuthProvider";
import ThemeProvider from "@/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto({
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
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

