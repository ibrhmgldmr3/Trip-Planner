'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  BagDugme,
  Damga,
  Dugme,
  Ikon,
  Kocan,
  KonturDoku,
  OkBag,
  Olcum,
  Pusula,
} from "@/components/ui";

/**
 * Ana sayfa — belgenin kendisi.
 *
 * TEZ: bir seyahat planlayıcısı ürettiği BELGEYE benzemeli. İlk ekran soyut
 * bir görsel ya da özellik listesi değil, gerçek çıktının küçük ama tam bir
 * örneği: tarihli, damgalı, rotası çizilmiş, bütçesi hesaplanmış bir plan.
 * "Ne alacaksınız" anlatılmıyor, gösteriliyor.
 *
 * REDDEDİLEN DÜZEN: altı eşit ikon+başlık+metin kartından oluşan ızgara.
 * Yerine harita LEJANTI — altı araç, bir haritanın sembol açıklaması gibi
 * okunuyor. Lejant "bunlar aynı türden altı kutu" değil, "bu yüzeydeki her
 * işaret şu anlama gelir" diyor.
 *
 * TEK KOREOGRAFİ ANI: rota çizgisi çiziliyor ve HAZIR damgası oturuyor.
 * Her bölüme ayrı giriş animasyonu dağıtmak hareketi anlamsızlaştırır.
 */

/* -------------------------------------------------------------------------- */
/* Lejant — araçlar                                                           */
/* -------------------------------------------------------------------------- */

interface LejantKaydi {
  baslik: string;
  aciklama: string;
  href: string;
  bagEtiketi: string;
  /** Kimlik doğrulaması gerekiyorsa tıklama yönlendirmeden geçiyor. */
  girisGerekli?: boolean;
  /** Lejant sembolü: 24×24 kutuda, tek çizgi kalınlığında. */
  sembol: React.ReactNode;
}

const sembolOrtak = {
  className: "h-5 w-5",
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const LEJANT: LejantKaydi[] = [
  {
    baslik: "Rota planlama",
    aciklama:
      "Gezmek istediğiniz yerleri seçin, gün içindeki sıraya göre haritada yürüme rotanızı çizelim.",
    href: "/map",
    bagEtiketi: "Haritayı aç",
    // Rota: iki durak arasında kıvrılan çizgi.
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M5 18c3.5 0 3.5-5 7-5s3.5-6 7-6" strokeDasharray="3 2.5" />
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="7" r="2" />
      </svg>
    ),
  },
  {
    baslik: "Bütçe takibi",
    aciklama:
      "Ulaşım, konaklama ve aktivite kalemlerini tek yerde toplayın; toplam ve günlük ortalama otomatik hesaplansın.",
    href: "/budget",
    bagEtiketi: "Bütçeye git",
    // Bütçe: üst üste binmiş kalemler.
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M3 7a2 2 0 012-2h11a1 1 0 011 1v2M3 7v11a2 2 0 002 2h14a1 1 0 001-1v-3M3 7h17a1 1 0 011 1v3h-5a2 2 0 100 4h5" />
      </svg>
    ),
  },
  {
    baslik: "Günlük program",
    aciklama:
      "Sabah, öğle ve akşam aktivitelerini saatleriyle planlayın; değişiklik yaptığınızda bütçe kendini günceller.",
    href: "/daily-planner",
    bagEtiketi: "Planlayıcıya git",
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
        <path d="M8 14h3" />
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
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
        <path d="M18.5 15l.7 1.9 1.8.6-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.6z" />
      </svg>
    ),
  },
  {
    baslik: "Ulaşım seçenekleri",
    aciklama:
      "Uçak, otobüs ve tren alternatiflerini yan yana karşılaştırın, planınıza uygun olanı kaydedin.",
    href: "/transportation",
    bagEtiketi: "Seçenekleri gör",
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2m-12 0V7a2 2 0 012-2h8a2 2 0 012 2v12m-12 0h12M9 21v-2m6 2v-2M8 9h8" />
      </svg>
    ),
  },
  {
    baslik: "Konaklama",
    aciklama:
      "Bütçenize uygun konaklama alternatiflerini planınıza ekleyin ve maliyeti bütçeye yansıtın.",
    href: "/accommodation",
    bagEtiketi: "Konaklamayı aç",
    sembol: (
      <svg {...sembolOrtak}>
        <path d="M3 10.5V19a1 1 0 001 1h16a1 1 0 001-1v-8.5M3 10.5h18M3 10.5l1.2-4.2A2 2 0 016.12 4.8h11.76a2 2 0 011.92 1.5l1.2 4.2M7.5 14.5h3" />
      </svg>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Örnek plan verisi                                                          */
/* -------------------------------------------------------------------------- */

/**
 * SENTETİK GÖSTERİM VERİSİ — tam sadakatle yazılmış, ama uydurma.
 * Kartın altındaki not bunu açıkça söylüyor; iddia uydurulmaz.
 */
const ORNEK_DURAKLAR = [
  { saat: "09:00", ad: "Kolezyum", yer: "Piazza del Colosseo", tutar: "₺1.240" },
  { saat: "13:30", ad: "Roma Forumu", yer: "Via della Salara Vecchia", tutar: "₺680" },
  { saat: "19:00", ad: "Akşam yemeği", yer: "Trastevere", tutar: "₺1.450" },
];

/** Rota eskizindeki durak noktaları — SVG koordinatları. */
const ESKIZ_NOKTALARI = [
  { x: 48, y: 96 },
  { x: 150, y: 52 },
  { x: 262, y: 88 },
];

/**
 * Rota eskizi.
 *
 * Ürünün asıl yaptığı iş bu: duraklar arasına bir hat çiziyor. Kartın
 * içinde küçük ama gerçek bir örneği duruyor ve sayfa açılırken bir kez
 * çiziliyor — mekanizmayı anlatmak yerine yapıyor.
 */
function RotaEskizi() {
  return (
    <svg
      viewBox="0 0 320 140"
      className="w-full h-auto block"
      role="img"
      aria-label="Üç duraklı örnek yürüme rotası: Kolezyum, Roma Forumu, Trastevere."
    >
      {/* Harita ızgarası — sayfa zeminindeki ağın aynısı, eskiz ölçeğinde. */}
      <defs>
        <pattern id="eskiz-izgara" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="var(--izgara-ana)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="140" fill="url(#eskiz-izgara)" />

      {/* Eşyükselti kırıntısı: yüzeyin harita olduğunu söyleyen ikinci katman. */}
      <g fill="none" stroke="var(--kontur)" strokeWidth="1">
        <path d="M196 128c26-6 44-24 40-46s-30-34-54-28-38 26-32 46 20 33 46 28z" />
        <path d="M198 118c18-4 30-17 27-32s-21-24-38-20-26 18-22 32 15 24 33 20z" />
      </g>

      {/* Rota: macenta, kesikli, açılışta çiziliyor. */}
      <path
        d="M48 96C85 100 110 70 150 52S225 60 262 88"
        fill="none"
        stroke="var(--route-vivid)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray="300"
        className="rota-ciz"
        style={{ ["--rota-uzunluk" as string]: "300" }}
      />

      {/* Duraklar: numaralı, kâğıt zeminde oturan noktalar. */}
      {ESKIZ_NOKTALARI.map((nokta, i) => (
        <g key={i}>
          <circle
            cx={nokta.x}
            cy={nokta.y}
            r="9"
            fill="var(--surface)"
            stroke="var(--route-vivid)"
            strokeWidth="2"
          />
          <text
            x={nokta.x}
            y={nokta.y + 3.5}
            textAnchor="middle"
            fill="var(--route)"
            fontSize="10"
            fontWeight="600"
            fontFamily="var(--font-geist-mono), monospace"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Adımlar                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Numaralandırma burada HAK EDİLMİŞ: bu üç adım gerçekten sıralı ve sıra
 * kullanıcı için bilgi taşıyor. (Sırası olmayan listelere numara koymak
 * boş bir alışkanlıktır.)
 */
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

/* -------------------------------------------------------------------------- */

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
      {/* ================================================================== */}
      {/* Giriş — tez                                                        */}
      {/* ================================================================== */}
      <section className="harita-zemin-sonen relative overflow-hidden border-b border-[var(--line)]">
        {/* Kontur dokusu: sayfanın kimliği, içerik olmadan da tanınır. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <KonturDoku yogunluk={0.85} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-[1.02fr_0.98fr] gap-12 lg:gap-16 items-center">
            <div>
              {/* Başlığın üstünde etiket YOK: eyebrow, başlığın taşıdığı
                  ağırlığı bölen boş bir alışkanlık. */}
              <h1 className="font-[family-name:var(--font-serif)] text-[2.5rem] leading-[1.08] md:text-[3.5rem] md:leading-[1.05] tracking-[-0.02em] text-[var(--fg)] text-balance">
                Seyahatinizi baştan sona planlayın,{" "}
                <span className="text-[var(--accent)]">tek bir yerde.</span>
              </h1>

              <p className="text-lg text-[var(--fg-muted)] mt-6 max-w-[58ch] leading-relaxed">
                Şehir, tarih ve bütçenizi söyleyin; günlük program, rota ve kalem kalem
                bütçe çıkaralım. Beğenmediğiniz her şeyi kendiniz düzenleyebilirsiniz.
              </p>

              <div className="flex flex-wrap gap-3 mt-9">
                {/* Tek birincil eylem: eşit ağırlıkta üç düğme kullanıcıyı
                    nereden başlayacağı konusunda kararsız bırakıyordu. */}
                <Dugme boy="lg" onClick={() => planaGit("/travel-mode")}>
                  Planlamaya başla
                </Dugme>
                <BagDugme href="/map" tur="ikincil" boy="lg">
                  Haritayı incele
                </BagDugme>
              </div>

              <p className="flex items-center gap-2 text-sm text-[var(--fg-subtle)] mt-6">
                <Pusula className="h-4 w-4 shrink-0" />
                Ücretsiz · Kayıt olmadan haritayı deneyebilirsiniz
              </p>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Belge: ürünün gerçek çıktısının küçük ama TAM bir örneği.      */}
            {/* -------------------------------------------------------------- */}
            <figure className="m-0">
              <div className="relative bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-[var(--shadow-pop)]">
                {/* Üst bilgi + damga */}
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
                  {/* Başlığın üstünde etiket YOK. "Plan özeti" üst başlığı
                      kaldırıldı: kart zaten bir plan özeti olduğunu
                      gösteriyor, etiket yalnızca göze bir engel ekliyordu. */}
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-serif)] text-2xl text-[var(--fg)] leading-none">
                      Roma, İtalya
                    </p>
                    <p className="text-sm text-[var(--fg-muted)] mt-2 sayisal">
                      15–17 Mayıs · 3 gün
                    </p>
                  </div>
                  <Damga animasyonlu>Hazır</Damga>
                </div>

                {/* Koçan ayracı: koparılabilir bir belge parçasının kenarı. */}
                <div className="px-5">
                  <Kocan />
                </div>

                {/* Mekanizma: rota çiziliyor. */}
                <div className="px-5 pt-4 pb-2">
                  <RotaEskizi />
                </div>

                {/* Ölçümler */}
                <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-y border-[var(--line)]">
                  <Olcum
                    etiket="Toplam"
                    deger="₺46.700"
                    ton="aksan"
                    className="px-5 py-4"
                  />
                  <Olcum etiket="Günlük" deger="₺15.567" className="px-5 py-4" />
                </div>

                {/* Program: duraklar rota hattıyla bağlı. */}
                <ul className="px-5 py-4 space-y-3.5">
                  {ORNEK_DURAKLAR.map((durak) => (
                    <li key={durak.saat} className="rota-hat flex gap-3.5">
                      <span
                        className="mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[var(--route-vivid)] bg-[var(--surface)]"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-[var(--fg)] font-medium truncate">
                            {durak.ad}
                          </span>
                          <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[var(--fg-muted)] sayisal shrink-0">
                            {durak.tutar}
                          </span>
                        </span>
                        <span className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--route)] sayisal">
                            {durak.saat}
                          </span>
                          <span className="text-sm text-[var(--fg-subtle)] truncate">
                            {durak.yer}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <figcaption className="lejant text-[var(--fg-subtle)] mt-3 text-center">
                Örnek plan · gösterim amaçlı
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Lejant — araçlar                                                   */}
      {/* ================================================================== */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl tracking-[-0.015em] text-[var(--fg)] text-balance">
            Planlamanın her adımı için bir araç
          </h2>
          <p className="text-[var(--fg-muted)] mt-4 leading-relaxed max-w-[62ch]">
            Hepsi aynı plana bağlı: birinde yaptığınız değişiklik diğerlerine yansır.
          </p>
        </div>

        {/*
          KART IZGARASI DEĞİL, LEJANT.

          Altı eşit kutu "bunlar birbirinin aynı altı şey" diyordu. Lejant
          düzeni her sembolün ne anlama geldiğini söylüyor, başlığa genişlik
          veriyor ve mobilde doğal olarak alt alta diziliyor.
        */}
        <ul className="mt-12 border-t border-[var(--line)]">
          {LEJANT.map((kayit) => (
            <li key={kayit.href} className="group border-b border-[var(--line)]">
              <div className="grid sm:grid-cols-[auto_1fr_auto] items-start gap-x-5 gap-y-3 py-6">
                {/* Lejant anahtarı: kâğıda basılmış bir sembol kutusu. */}
                <span className="inline-grid place-items-center w-10 h-10 rounded-[var(--radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition-colors duration-200 group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-contrast)]">
                  {kayit.sembol}
                </span>

                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">
                    {kayit.baslik}
                  </h3>
                  <p className="text-[var(--fg-muted)] mt-1.5 max-w-[64ch] leading-relaxed">
                    {kayit.aciklama}
                  </p>
                </div>

                <div className="sm:pt-2">
                  {kayit.girisGerekli ? (
                    <button
                      type="button"
                      onClick={() => planaGit(kayit.href)}
                      className="group/bag inline-flex items-center gap-1.5 py-2.5 -my-2.5 text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4 decoration-[var(--accent-border)] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      {kayit.bagEtiketi}
                      <Ikon.Sag className="h-4 w-4 transition-transform duration-150 group-hover/bag:translate-x-0.5" />
                    </button>
                  ) : (
                    <OkBag href={kayit.href}>{kayit.bagEtiketi}</OkBag>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ================================================================== */}
      {/* Nasıl çalışır — üç durak, bir hat                                  */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden border-y border-[var(--line)] bg-[var(--surface)]">
        <KonturDoku yogunluk={0.55} />

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <h2 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl tracking-[-0.015em] text-[var(--fg)] max-w-2xl text-balance">
            Nasıl çalışır?
          </h2>

          {/*
            Adımlar bir ROTA olarak diziliyor: üç durak, aralarında macenta
            bir hat. Sıra burada gerçekten bilgi taşıyor — önce tarif, sonra
            gözden geçirme, sonra kullanım.
          */}
          <ol className="relative grid md:grid-cols-3 gap-10 md:gap-8 mt-14">
            {/* Duraklar arası hat — yalnızca masaüstünde, noktaların hizasında. */}
            <span
              className="hidden md:block absolute left-0 right-0 top-[7px] h-px bg-[repeating-linear-gradient(to_right,var(--route-border)_0_6px,transparent_6px_12px)]"
              aria-hidden="true"
            />

            {ADIMLAR.map((adim, i) => (
              <li key={adim.baslik} className="relative">
                <span
                  className="relative z-10 grid place-items-center h-[15px] w-[15px] rounded-full border-2 border-[var(--route-vivid)] bg-[var(--surface)]"
                  aria-hidden="true"
                />
                {/* Numara başlığın ÜSTÜNDE değil, İÇİNDE: üstte durduğunda
                    başlığın ağırlığını bölen bir üst-etiket oluyordu. Sıra
                    burada gerçek bilgi taşıdığı için numara kalıyor, ama
                    başlığın parçası olarak. */}
                <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mt-5 flex items-baseline gap-2.5">
                  <span className="lejant text-[var(--route)] shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {adim.baslik}
                </h3>
                <p className="text-[var(--fg-muted)] mt-2 leading-relaxed max-w-[46ch]">
                  {adim.aciklama}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Kapanış çağrısı                                                    */}
      {/* ================================================================== */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--accent)] text-[var(--accent-contrast)] px-6 py-14 md:px-12 md:py-16 text-center">
          {/* Aksan zemin üzerinde kontur: aynı doku, ters mürekkep. */}
          <div
            className="pointer-events-none absolute inset-0 [--kontur:rgba(255,255,255,0.14)]"
            aria-hidden="true"
          >
            <KonturDoku />
          </div>

          <div className="relative">
            <h2 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl tracking-[-0.015em] text-balance">
              Bir sonraki seyahatinizi bugün planlayın
            </h2>
            {/* Renkli zeminde ikincil metin gri değil, zeminin kendi
                tonundan açılıyor. */}
            <p className="mt-4 max-w-[52ch] mx-auto leading-relaxed text-[var(--accent-contrast)]/85">
              Birkaç dakikada kişiselleştirilmiş, bütçesi hesaplanmış bir plan çıkarın.
            </p>
            <button
              type="button"
              onClick={() => planaGit("/ai-planner")}
              className="mt-9 inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius)] bg-[var(--accent-contrast)] text-[var(--accent)] font-medium transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-contrast)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)]"
            >
              Ücretsiz planlayıcıyı kullan
              <Ikon.Sag className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Alt bilgi                                                          */}
      {/* ================================================================== */}
      <footer className="border-t border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <Link
              href="/"
              // Dikey dolgu + negatif marj: dokunma hedefi 28px'ten 44px'e
              // çıkıyor, satırın görsel yüksekliği aynı kalıyor.
              className="inline-flex items-center gap-2.5 py-2.5 -my-2.5 rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <Pusula className="h-6 w-6 text-[var(--accent)]" />
              <span className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)]">
                Trip Planner
              </span>
            </Link>

            <nav aria-label="Alt bilgi bağlantıları">
              {/* -my ile dokunma alanı büyüyor, görsel aralık korunuyor. */}
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

          <p className="lejant text-[var(--fg-subtle)] mt-10 pt-6 border-t border-[var(--line)]">
            © {new Date().getFullYear()} AnkaGeo Trip Planner
          </p>
        </div>
      </footer>
    </div>
  );
}
