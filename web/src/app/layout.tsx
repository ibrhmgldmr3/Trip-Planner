import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";
import MobileMenu from "@/components/MobileMenu";
import AuthProvider from "@/providers/AuthProvider";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={`dark ${geistSans.variable} ${geistMono.variable} ${roboto.variable}`}>
      <body className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white min-h-screen">
        <AuthProvider>
          <MobileMenu />
          <main className="relative">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

