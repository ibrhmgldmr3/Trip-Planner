'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import { BagDugme, Dugme, Ikon, Kart, OkBag, Rozet } from "@/components/ui";

/**
 * Ana sayfa.
 *
 * Bu turda ne değişti ve NEDEN:
 *  - Altı farklı aksan rengi (mavi, indigo, yeşil, kırmızı, mor, sarı) tek
 *    bir aksana indi. Renk artık dekor değil, ANLAM taşıyor; her kartı
 *    farklı renge boyamak "bunlar farklı türde şeyler" diyordu, oysa hepsi
 *    aynı türde: bir araca giden bağlantı.
 *  - Kartlar aynı yapıya oturdu. İlk ikisi büyük (p-8, 2xl köşe, 2xl başlık),
 *    diğer dördü küçük (p-6, xl köşe, xl başlık) idi; ızgara düzensiz
 *    görünüyordu.
 *  - Hero'daki soyut gradient kutusu, ürünün GERÇEKTEN ürettiği şeyin
 *    küçük bir örneğiyle değişti. Soyut bir görsel "güzel" olabilir ama
 *    hiçbir şey anlatmıyordu.
 *  - Nabız atan blob'lar, süzülen kartlar ve dönen gradient metin kalktı.
 */

interface Ozellik {
  baslik: string;
  aciklama: string;
  href: string;
  bagEtiketi: string;
  /** Kimlik doğrulaması gerekiyorsa tıklama yönlendirmeden geçiyor. */
  girisGerekli?: boolean;
  ikon: React.ReactNode;
}

const ikonSinifi = "h-5 w-5";

const OZELLIKLER: Ozellik[] = [
  {
    baslik: "Rota planlama",
    aciklama:
      "Gezmek istediğiniz yerleri seçin, gün içindeki sıraya göre haritada yürüme rotanızı çizelim.",
    href: "/map",
    bagEtiketi: "Haritayı aç",
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    baslik: "Bütçe takibi",
    aciklama:
      "Ulaşım, konaklama ve aktivite kalemlerini tek yerde toplayın; toplam ve günlük ortalama otomatik hesaplansın.",
    href: "/budget",
    bagEtiketi: "Bütçeye git",
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    baslik: "Günlük program",
    aciklama:
      "Sabah, öğle ve akşam aktivitelerini saatleriyle planlayın; değişiklik yaptığınızda bütçe kendini günceller.",
    href: "/daily-planner",
    bagEtiketi: "Planlayıcıya git",
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    baslik: "Yapay zekâ önerileri",
    aciklama:
      "İlgi alanlarınıza göre gezilecek yerler, restoranlar ve pratik bilgilerden oluşan bir taslak plan alın.",
    href: "/ai-planner",
    bagEtiketi: "Plan oluştur",
    girisGerekli: true,
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    baslik: "Ulaşım seçenekleri",
    aciklama:
      "Uçak, otobüs ve tren alternatiflerini yan yana karşılaştırın, planınıza uygun olanı kaydedin.",
    href: "/transportation",
    bagEtiketi: "Seçenekleri gör",
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 19a2 2 0 002 2h8a2 2 0 002-2m-12 0V7a2 2 0 012-2h8a2 2 0 012 2v12m-12 0h12M9 21v-2m6 2v-2M8 9h8m-8 4h8" />
      </svg>
    ),
  },
  {
    baslik: "Konaklama",
    aciklama:
      "Bütçenize uygun konaklama alternatiflerini planınıza ekleyin ve maliyeti bütçeye yansıtın.",
    href: "/accommodation",
    bagEtiketi: "Konaklamayı aç",
    ikon: (
      <svg className={ikonSinifi} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10.5V19a1 1 0 001 1h16a1 1 0 001-1v-8.5M3 10.5h18M3 10.5l1.2-4.2A2 2 0 016.12 4.8h11.76a2 2 0 011.92 1.5l1.2 4.2M7.5 14.5h3" />
      </svg>
    ),
  },
];

const ADIMLAR = [
  {
    baslik: "Seyahatinizi tarif edin",
    aciklama: "Şehir, tarih aralığı, bütçe ve ilgi alanlarınızı girin. Bir dakikadan kısa sürer.",
  },
  {
    baslik: "Taslağı gözden geçirin",
    aciklama:
      "Günlük program, yeme-içme önerileri ve kalem kalem bütçe hazır gelir. Beğenmediğinizi değiştirin.",
  },
  {
    baslik: "Planı kullanın",
    aciklama:
      "Rotayı haritada görün, harcamaları yolda işaretleyin. Plan sizinle birlikte güncellenir.",
  },
];

export default function Home() {
  const router = useRouter();
  const { status } = useSession();

  const planaGit = (rota: string) => {
    if (status === "unauthenticated") {
      toast.error("Plan oluşturmak için önce giriş yapmanız gerekiyor");
      router.push("/login");
      return;
    }
    router.push(rota);
  };

  return (
    <div className="bg-[var(--bg)]">
      {/* ---------------------------------------------------------------- */}
      {/* Giriş                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              {/* Başlığın üstünde etiket YOK: eyebrow, başlığın taşıdığı
                  ağırlığı bölen boş bir alışkanlık. */}
              <h1 className="font-[family-name:var(--font-serif)] text-4xl md:text-5xl leading-[1.12] text-[var(--fg)] text-balance">
                Seyahatinizi baştan sona planlayın,
                <br className="hidden sm:block" /> tek bir yerde.
              </h1>

              <p className="text-lg text-[var(--fg-muted)] mt-5 max-w-xl leading-relaxed">
                Şehir, tarih ve bütçenizi söyleyin; günlük program, rota ve kalem kalem
                bütçe çıkaralım. Beğenmediğiniz her şeyi kendiniz düzenleyebilirsiniz.
              </p>

              <div className="flex flex-wrap gap-3 mt-8">
                {/* Tek birincil eylem: üç eşit ağırlıkta düğme kullanıcıyı
                    nereden başlayacağı konusunda kararsız bırakıyordu. */}
                <Dugme boy="lg" onClick={() => planaGit("/travel-mode")}>
                  Planlamaya başla
                </Dugme>
                <BagDugme href="/map" tur="ikincil" boy="lg">
                  Haritayı incele
                </BagDugme>
              </div>

              <p className="text-sm text-[var(--fg-subtle)] mt-5">
                Ücretsiz · Kayıt olmadan haritayı deneyebilirsiniz
              </p>
            </div>

            {/* Soyut bir gradient kutu yerine ürünün çıktısının küçük bir
                örneği: ne alacağını göstermek, anlatmaktan iyi. */}
            <Kart className="overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                    Roma, İtalya
                  </p>
                  <p className="text-sm text-[var(--fg-muted)]">15–17 Mayıs · 3 gün</p>
                </div>
                <Rozet ton="olumlu">Hazır</Rozet>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-b border-[var(--line)]">
                <div className="px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">Toplam</p>
                  <p className="font-[family-name:var(--font-serif)] text-2xl text-[var(--accent)] tabular-nums mt-1">
                    ₺46.700
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">Günlük</p>
                  <p className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] tabular-nums mt-1">
                    ₺15.567
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-[var(--line)]">
                {[
                  { saat: "09:00", ad: "Kolezyum", yer: "Piazza del Colosseo" },
                  { saat: "13:30", ad: "Roma Forumu", yer: "Via della Salara Vecchia" },
                  { saat: "19:00", ad: "Akşam yemeği", yer: "Trastevere" },
                ].map((satir) => (
                  <li key={satir.saat} className="flex gap-4 px-5 py-3">
                    <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--fg-subtle)] tabular-nums pt-0.5">
                      {satir.saat}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[var(--fg)]">{satir.ad}</span>
                      <span className="block text-sm text-[var(--fg-muted)] truncate">
                        {satir.yer}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <p className="px-5 py-3 text-xs text-[var(--fg-subtle)] bg-[var(--surface-2)]">
                Örnek plan · gerçek çıktıdan alınmıştır
              </p>
            </Kart>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Özellikler                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] text-balance">
            Planlamanın her adımı için bir araç
          </h2>
          <p className="text-[var(--fg-muted)] mt-3 leading-relaxed">
            Hepsi aynı plana bağlı: birinde yaptığınız değişiklik diğerlerine yansır.
          </p>
        </div>

        {/*
          KART IZGARASI DEĞİL, KURALLI SATIRLAR.

          Altı eşit kutu "bunlar birbirinin aynı altı şey" diyordu ve
          başlıkların nefes alacak yeri yoktu. Satır düzeni başlığa genişlik
          veriyor, ince çizgiler kutuya gerek kalmadan ayırıyor ve mobilde
          doğal olarak alt alta diziliyor.
        */}
        <ul className="mt-10 border-t border-[var(--line)]">
          {OZELLIKLER.map((ozellik) => (
            <li
              key={ozellik.href}
              className="grid sm:grid-cols-[auto_1fr_auto] items-start gap-x-5 gap-y-3 py-6 border-b border-[var(--line)]"
            >
              <span className="inline-grid place-items-center w-9 h-9 rounded-[var(--radius)] bg-[var(--accent-soft)] text-[var(--accent)]">
                {ozellik.ikon}
              </span>

              <div className="min-w-0">
                <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
                  {ozellik.baslik}
                </h3>
                <p className="text-[var(--fg-muted)] mt-1.5 max-w-xl leading-relaxed">
                  {ozellik.aciklama}
                </p>
              </div>

              <div className="sm:pt-1.5">
                {ozellik.girisGerekli ? (
                  <button
                    type="button"
                    onClick={() => planaGit(ozellik.href)}
                    className="group inline-flex items-center gap-1.5 py-2.5 -my-2.5 text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {ozellik.bagEtiketi}
                    <Ikon.Sag className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <OkBag href={ozellik.href}>{ozellik.bagEtiketi}</OkBag>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Nasıl çalışır                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] max-w-2xl text-balance">
            Nasıl çalışır?
          </h2>

          <ol className="grid md:grid-cols-3 gap-8 md:gap-10 mt-10">
            {ADIMLAR.map((adim, i) => (
              <li key={adim.baslik} className="border-t-2 border-[var(--accent)] pt-4">
                <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mt-2">
                  {adim.baslik}
                </h3>
                <p className="text-[var(--fg-muted)] mt-2 leading-relaxed">{adim.aciklama}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Kapanış çağrısı                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="rounded-[var(--radius-lg)] bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-12 md:px-12 md:py-14 text-center">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl text-balance">
            Bir sonraki seyahatinizi bugün planlayın
          </h2>
          <p className="mt-4 max-w-xl mx-auto opacity-90 leading-relaxed">
            Birkaç dakikada kişiselleştirilmiş, bütçesi hesaplanmış bir plan çıkarın.
          </p>
          <button
            type="button"
            onClick={() => planaGit("/ai-planner")}
            className="mt-8 inline-flex items-center justify-center px-6 py-3 rounded-[var(--radius)] bg-[var(--accent-contrast)] text-[var(--accent)] font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-contrast)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)]"
          >
            Ücretsiz planlayıcıyı kullan
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Alt bilgi                                                        */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]"
            >
              Trip Planner
            </Link>

            <nav aria-label="Alt bilgi bağlantıları">
              {/* -my ile dokunma alani buyuyor, gorsel aralik korunuyor. */}
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {[
                  { href: "/map", etiket: "Harita" },
                  { href: "/daily-planner", etiket: "Günlük plan" },
                  { href: "/budget", etiket: "Bütçe" },
                  { href: "/terms", etiket: "Kullanım koşulları" },
                  { href: "/privacy", etiket: "Gizlilik" },
                ].map((bag) => (
                  <li key={bag.href}>
                    <Link
                      href={bag.href}
                      className="inline-block py-2.5 -my-2.5 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {bag.etiket}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="text-sm text-[var(--fg-subtle)] mt-8 pt-6 border-t border-[var(--line)]">
            © {new Date().getFullYear()} AnkaGeo Trip Planner
          </p>
        </div>
      </footer>
    </div>
  );
}
