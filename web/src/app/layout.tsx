import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
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

/**
 * Mono YALNIZCA ölçülen değerler için: saat, koordinat, para, mesafe ve
 * harita lejantı etiketleri. "Teknik dursun" diye kullanılmıyor.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
 *
 * NOT: Roboto kaldırıldı. Üç ağırlığı indiriliyordu ama hiçbir yerde
 * kullanılmıyordu — yalnızca gövdenin yedek listesinde duruyordu.
 */
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trip Planner — Seyahat Planlayıcı",
  description:
    "Şehir, tarih ve bütçenizi söyleyin; günlük program, rota ve kalem kalem bütçe çıkaralım.",
  keywords: "seyahat planlama, gezi rotası, harita, POI, şehir gezisi, bütçe",
  authors: [{ name: "İbrahim Güldemir" }],
};

/**
 * Tarayıcı arayüzü (adres çubuğu) sayfa zeminiyle aynı renkte olsun.
 * Mobilde kâğıt zeminin ekranın tepesinde kesilmesini engelliyor.
 */
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1420" },
  ],
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

/**
 * Yön sözleşmesi.
 *
 * Üretim çıktısında da duruyor: tasarım kararının kaynağı, kodun yanında.
 * React yorum düğümü basamadığı için gizli bir kapsayıcıya gömülüyor.
 */
const YON_SOZLESMESI = `<!--
IMPECCABLE / kartografi-seyahat-gunlugu

THESIS: Bir seyahat planlayıcısı ürettiği BELGEYE benzemeli. Yüzey harita ve
seyahat evrakının dilini alır. Reddettiği düzen: altı eşit ikon+başlık+metin
kartından oluşan SaaS ızgarası ve düz gri-beyaz zemin.

OWN-WORLD: Soğuk mavi-gri deniz haritası kâğıdı #eff3f5 üzerinde 34px
koordinat ızgarası. Mürekkep prusya mavisi #14456b, rota macenta #9c3f6a,
damga pirinç #b8892c. Source Serif 4 başlık / Geist Sans gövde / Geist Mono
yalnızca ölçülen değerlerde. Kontur SVG dokusu, delikli koçan ayraçları,
eğik çift halkalı damgalar, pusula gülü işareti.

STORY: Ziyaretçi ilk ekranda ürünün GERÇEK çıktısını görür — tarihli,
damgalı, bütçesi hesaplanmış bir plan. Anlatılmaz, gösterilir.

FIRST VIEWPORT: Solda serif başlık ve tek birincil eylem; sağda gerçek bir
plan belgesi (üst bilgi + HAZIR damgası, koçan ayracı, iki ölçüm, macenta
rota hattıyla üç duraklı program). Zeminde kontur ve ızgara.

FORM: Belge/evrak formu; sıralı listede 1. sıra; kullanıcı kilidi
"Kartografi / Seyahat Günlüğü".

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
-->`;

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
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable}`}
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
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: temaScript }}
        />
      </head>
      <body className="min-h-screen">
        <div hidden dangerouslySetInnerHTML={{ __html: YON_SOZLESMESI }} />
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
