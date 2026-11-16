import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import AppProviders from "@/providers/AppProviders";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { themeInitScript } from "@/lib/theme";

// Türkçe karakterler (ğ, ş, ı, İ) için latin-ext alt kümesi şart.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TripPlanner — Şehri ve tarihi söyle, rotan hazır",
    template: "%s · TripPlanner",
  },
  description:
    "Tarih, şehir, bütçe ve ilgi alanlarına göre gün gün gezi planı, mekan önerileri ve bütçe tahmini oluşturan seyahat planlayıcı.",
  keywords: ["seyahat planlama", "gezi rotası", "günlük gezi planı", "bütçe tahmini", "AI seyahat planlayıcı"],
  authors: [{ name: "İbrahim Güldemir" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0e1f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      className={`${manrope.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProviders>
          <a
            href="#icerik"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-brand"
          >
            İçeriğe geç
          </a>
          <SiteHeader />
          <div id="icerik" className="flex flex-1 flex-col">
            {children}
          </div>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
