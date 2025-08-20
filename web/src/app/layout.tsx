import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileMenu from "@/components/MobileMenu";

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
  authors: [{ name: "AnkaGeo" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <MobileMenu />
        {children}
      </body>
    </html>
  )
}
