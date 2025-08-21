import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileMenu from "@/components/MobileMenu";
import AuthProvider from "@/providers/AuthProvider";
import { ThemeProvider } from "@/context/ThemeContext";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trip Planner - Seyahat Planlayıcı",
  description: "Seyahatlerinizi planlamanın en kolay yolu",
  keywords: "seyahat planlama, gezi rotası, harita, POI, şehir gezisi",
  authors: [{ name: "İbrahim Güldemir" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark')
            } else {
              document.documentElement.classList.remove('dark')
            }
          `}
        </Script>
      </head>
      <body className="transition-colors">
        <AuthProvider>
          <ThemeProvider>
            <MobileMenu />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
