import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Paylaşılan arayüz parçaları — KARTOGRAFİ dili.
 *
 * NEDEN VAR: her sayfa kendi düğmesini, kartını ve rozetini elle yazıyordu.
 * Sonuç, aynı işi yapan ama farklı görünen onlarca öğeydi.
 *
 * DİL: bu uygulama bir seyahat belgesi üretiyor, dolayısıyla arayüz de bir
 * belgenin parçalarından kuruluyor — eşyükselti çizgileri (KonturDoku),
 * bilet koçanı (Kocan), damga (Damga), pusula (Pusula), harita lejantı
 * (lejant sınıfı). Bunlar dekor değil: her biri bir içerik türünü
 * işaretliyor ve sayfadan sayfaya aynı şeyi söylüyor.
 *
 * KURAL: renk doğrudan Tailwind paletinden değil, `globals.css`'teki
 * token'lardan geliyor (`var(--accent)`, `var(--route)` vb.).
 *
 * TİPOGRAFİ SINIRI: serif YALNIZCA başlıklarda ve öne çıkan rakamlarda.
 * Mono yalnızca ÖLÇÜLEN şeylerde — saat, koordinat, para, mesafe ve harita
 * lejantı etiketleri. "Teknik görünsün" diye mono kullanılmıyor.
 *
 * Bu dosya bilinçli olarak SUNUCU BİLEŞENİ: hiçbiri state tutmuyor.
 */

/** Tailwind sınıflarını birleştirir; boş/false değerleri atar. */
export function cx(...parcalar: Array<string | false | null | undefined>): string {
  return parcalar.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* İkonlar                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tek çizgi kalınlığında, tek boyutta çizilmiş asgari ikon seti.
 *
 * NEDEN BİLEŞEN: arayüzde `→`, `↗`, `✓`, `×` gibi unicode karakterler ikon
 * yerine kullanılıyordu. Bunlar fonttan fonta değişiyor, hizası kayıyor ve
 * ekran okuyucuda metin olarak okunuyor.
 */
const ikonOrtak = {
  fill: "none" as const,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const Ikon = {
  Sag: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  ),
  Disari: ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
    </svg>
  ),
  Onay: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  Kapat: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  Ekle: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Sil: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
    </svg>
  ),
  Uyari: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M12 9v4M12 17h.01M10.3 4.3L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />
    </svg>
  ),
  Igne: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Takvim: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  ),
  Cuzdan: ({ className = "h-4 w-4" }: { className?: string }) => (
    <svg className={className} {...ikonOrtak}>
      <path d="M3 7a2 2 0 012-2h11a1 1 0 011 1v2M3 7v11a2 2 0 002 2h14a1 1 0 001-1v-3M3 7h17a1 1 0 011 1v3h-5a2 2 0 100 4h5" />
    </svg>
  ),
};

/** Düğme ve satır içi durumlar için dönen gösterge. */
function Donen({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={cx(
        className,
        "inline-block rounded-full border-2 border-current border-t-transparent animate-spin"
      )}
      aria-hidden="true"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Kartografik dokular ve işaretler                                           */
/* -------------------------------------------------------------------------- */

/**
 * Eşyükselti (kontur) dokusu.
 *
 * İki tepe etrafında iç içe geçmiş kapalı eğriler. Tek bir düzensiz yol
 * yazılıp ölçeklenerek çoğaltılıyor — gerçek bir topografya haritasında
 * konturlar da birbirinin benzeri ve iç içedir. Radyal maske ile kenarlara
 * doğru sönüyor ki bir çıkartma gibi durmasın.
 *
 * Süs değil: bu doku "burası bir harita yüzeyi" diyor ve sayfanın kimliğini
 * içerik olmadan da tanınır kılıyor.
 */
const TEPE_BUYUK =
  "M250 60C330 70 400 120 405 200C410 275 360 340 275 365C195 388 120 355 95 285C70 215 105 130 175 88C200 72 224 62 250 60Z";
const TEPE_KUCUK =
  "M620 190C680 195 720 240 715 295C710 350 665 390 610 385C555 380 520 335 528 280C535 228 570 192 620 190Z";

const OLCEKLER = [1, 0.85, 0.71, 0.58, 0.46, 0.35, 0.25, 0.16];

export function KonturDoku({
  className,
  yogunluk = 1,
}: {
  className?: string;
  /** 0–1 arası çarpan; yoğun içeriğin arkasında düşürülür. */
  yogunluk?: number;
}) {
  return (
    <svg
      className={cx("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ opacity: yogunluk }}
    >
      <defs>
        <radialGradient id="kontur-sonme" cx="50%" cy="45%" r="72%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="58%" stopColor="white" stopOpacity="0.65" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="kontur-maske">
          <rect width="800" height="500" fill="url(#kontur-sonme)" />
        </mask>
      </defs>

      <g
        mask="url(#kontur-maske)"
        fill="none"
        stroke="var(--kontur)"
        strokeWidth="1"
      >
        {OLCEKLER.map((olcek) => (
          <path
            key={`b${olcek}`}
            d={TEPE_BUYUK}
            transform={`translate(240 224) scale(${olcek}) translate(-240 -224)`}
          />
        ))}
        {OLCEKLER.slice(0, 6).map((olcek) => (
          <path
            key={`k${olcek}`}
            d={TEPE_KUCUK}
            transform={`translate(620 290) scale(${olcek}) translate(-620 -290)`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Pusula gülü — uygulamanın işareti.
 *
 * "TP" harfleri yerine çizilmiş bir işaret. Dört ana yön, kuzey kolu dolu:
 * bir haritada pusulanın kuzeyi her zaman ayırt edilir.
 */
export function Pusula({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.55"
      />
      {/* Doğu–batı kolu: içi boş */}
      <path
        d="M12 12 3.9 12 12 9.6 20.1 12 12 14.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        opacity="0.65"
      />
      {/* Kuzey–güney kolu: kuzey dolu */}
      <path d="M12 2.6 14.35 12 12 21.4 9.65 12Z" fill="currentColor" opacity="0.25" />
      <path d="M12 2.6 14.35 12 9.65 12Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Bilet koçanı ayracı.
 *
 * İki ucu delikli kesik çizgi. Kart içinde "üst bilgi" ile "içerik" arasını
 * ayırır. Düz bir 1px çizgi de ayırırdı; bu, ayırdığı şeyin ne olduğunu da
 * söylüyor — koparılabilir bir belge parçası.
 */
export function Kocan({ className }: { className?: string }) {
  return <div className={cx("kocan", className)} aria-hidden="true" />;
}

/**
 * Damga.
 *
 * Bir durumu "vurulmuş" gibi gösterir: hafif eğik, çift halkalı, aralıklı
 * büyük harf. Rozet'ten farkı ağırlığı — rozet bir etiket, damga bir HÜKÜM.
 * Plan durumunda ("HAZIR", "TAMAMLANDI") kullanılıyor, listelerde değil.
 */
type DamgaTonu = "aksan" | "rota" | "muhur" | "notr";

const DAMGA_TONLARI: Record<DamgaTonu, string> = {
  aksan: "text-[var(--accent)] border-[var(--accent)]",
  rota: "text-[var(--route)] border-[var(--route)]",
  muhur: "text-[var(--stamp-ink)] border-[var(--stamp)]",
  notr: "text-[var(--fg-subtle)] border-[var(--line-strong)]",
};

export function Damga({
  children,
  ton = "muhur",
  className,
  animasyonlu,
}: {
  children: ReactNode;
  ton?: DamgaTonu;
  className?: string;
  /** Ana sayfadaki tek koreografi anı için. */
  animasyonlu?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-block -rotate-6 select-none rounded-[3px] border-2 px-2.5 py-1",
        "lejant font-semibold",
        // İçteki ikinci halka: gerçek bir kauçuk damganın çift çerçevesi.
        "shadow-[inset_0_0_0_1px_currentColor]",
        DAMGA_TONLARI[ton],
        animasyonlu && "damga-bas",
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Düğme                                                                      */
/* -------------------------------------------------------------------------- */

type DugmeTuru = "birincil" | "ikincil" | "rota" | "sessiz" | "tehlike";
type DugmeBoyu = "sm" | "md" | "lg";

const DUGME_TABANI =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius)] " +
  // 150ms: kullanıcı bir görevin içinde, koreografiyi beklemesin.
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "active:translate-y-px " +
  // Klavye odağı GÖRÜNÜR olmalı.
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0";

const DUGME_TURLERI: Record<DugmeTuru, string> = {
  birincil:
    "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] " +
    "active:bg-[var(--accent-active)] shadow-[var(--shadow-kart)]",
  ikincil:
    "bg-[var(--surface)] text-[var(--fg)] border border-[var(--line-strong)] " +
    "hover:bg-[var(--surface-2)] hover:border-[var(--fg-subtle)] active:bg-[var(--surface-3)]",
  // Rota düğmesi: "harekete geçir" anlamı taşıyan ikincil eylem.
  rota:
    "bg-[var(--route-soft)] text-[var(--route)] border border-[var(--route-border)] " +
    "hover:bg-[var(--route)] hover:text-[var(--accent-contrast)] hover:border-[var(--route)]",
  sessiz:
    "bg-transparent text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] " +
    "active:bg-[var(--surface-3)]",
  tehlike:
    "bg-transparent text-[var(--danger)] border border-transparent " +
    "hover:bg-[var(--danger-soft)] active:border-[var(--danger)]",
};

const DUGME_BOYLARI: Record<DugmeBoyu, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3",
};

function dugmeSinifi(tur: DugmeTuru, boy: DugmeBoyu, ek?: string): string {
  return cx(DUGME_TABANI, DUGME_TURLERI[tur], DUGME_BOYLARI[boy], ek);
}

export interface DugmeProps extends Omit<ComponentProps<"button">, "className"> {
  tur?: DugmeTuru;
  boy?: DugmeBoyu;
  className?: string;
  /**
   * Bekleme durumu: düğme kilitlenir ve yanında dönen gösterge çıkar.
   * Sayfalar bunu `{yukleniyor ? "Kaydediliyor…" : "Kaydet"}` diye elle
   * yazıyordu; genişlik zıplıyordu.
   */
  bekliyor?: boolean;
}

export function Dugme({
  tur = "birincil",
  boy = "md",
  className,
  bekliyor,
  disabled,
  children,
  ...rest
}: DugmeProps) {
  return (
    <button
      className={dugmeSinifi(tur, boy, className)}
      disabled={disabled || bekliyor}
      aria-busy={bekliyor || undefined}
      {...rest}
    >
      {bekliyor && <Donen className={boy === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

export interface BagDugmeProps extends Omit<ComponentProps<typeof Link>, "className"> {
  tur?: DugmeTuru;
  boy?: DugmeBoyu;
  className?: string;
}

/** Görsel olarak düğme, anlamsal olarak bağlantı. */
export function BagDugme({ tur = "birincil", boy = "md", className, ...rest }: BagDugmeProps) {
  return <Link className={dugmeSinifi(tur, boy, className)} {...rest} />;
}

/** Metin bağlantısı; sonunda ok ikonu. */
export function OkBag({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]",
        // Dikey dolgu + negatif marj: dokunma hedefi ~40px, görsel yükseklik aynı.
        "py-2.5 -my-2.5",
        "hover:underline underline-offset-4 decoration-[var(--accent-border)] rounded",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        className
      )}
    >
      {children}
      <Ikon.Sag className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Kart                                                                       */
/* -------------------------------------------------------------------------- */

export interface KartProps {
  children: ReactNode;
  className?: string;
  /** Tıklanabilir kartlarda hover geri bildirimi verir. */
  etkilesimli?: boolean;
  /** Kontur dokusu taşıyan "harita kâğıdı" varyantı — öne çıkan kartlar. */
  kagit?: boolean;
}

export function Kart({ children, className, etkilesimli, kagit }: KartProps) {
  return (
    <div
      className={cx(
        "relative bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-lg)]",
        "shadow-[var(--shadow-kart)]",
        etkilesimli &&
          "transition-[border-color,box-shadow,transform] duration-200 " +
            "hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-pop)] hover:-translate-y-0.5",
        className
      )}
    >
      {kagit && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-lg)]">
          <KonturDoku yogunluk={0.7} />
        </div>
      )}
      {/* İçerik dokunun üstünde kalmalı. */}
      <div className="relative">{children}</div>
    </div>
  );
}

/** Kart içi standart iç boşluk. */
export function KartGovde({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("p-5", className)}>{children}</div>;
}

/** Kart başlığı; altında ince bir ayraçla. */
export function KartBasi({
  baslik,
  aciklama,
  yan,
}: {
  baslik: ReactNode;
  aciklama?: ReactNode;
  /** Sağ tarafa yerleşen eylem(ler). */
  yan?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-[var(--line)]">
      <div className="min-w-0">
        <h2 className="font-[family-name:var(--font-serif)] text-lg text-[var(--fg)] leading-snug">
          {baslik}
        </h2>
        {aciklama && <p className="text-sm text-[var(--fg-muted)] mt-1">{aciklama}</p>}
      </div>
      {yan && <div className="shrink-0">{yan}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sayfa başlığı                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Sayfa başlığı.
 *
 * ÜST BAŞLIK (eyebrow) PROP'U BİLİNÇLİ OLARAK YOK. Başlığın üstüne küçük
 * harfli bir etiket koymak boş bir alışkanlık: başlık kendi ağırlığını
 * taşıyor.
 *
 * Alttaki çizgi düz değil: solda aksan renginde kalın bir parça, devamında
 * ince çizgi. Harita kenarındaki ölçek çubuğunun aynısı — sayfanın nerede
 * başladığını söylüyor.
 */
export function SayfaBasi({
  baslik,
  aciklama,
  yan,
}: {
  baslik: ReactNode;
  aciklama?: ReactNode;
  yan?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] leading-tight text-balance">
            {baslik}
          </h1>
          {aciklama && (
            <p className="text-[var(--fg-muted)] mt-2 max-w-[68ch] leading-relaxed">{aciklama}</p>
          )}
        </div>
        {yan && <div className="shrink-0">{yan}</div>}
      </div>
      <div className="flex items-center" aria-hidden="true">
        <span className="h-[3px] w-14 rounded-full bg-[var(--accent)]" />
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Rozet                                                                      */
/* -------------------------------------------------------------------------- */

type RozetTonu = "notr" | "aksan" | "rota" | "olumlu" | "uyari" | "tehlike" | "bilgi";

const ROZET_TONLARI: Record<RozetTonu, string> = {
  notr: "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--line)]",
  aksan: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
  rota: "bg-[var(--route-soft)] text-[var(--route)] border-[var(--route-border)]",
  olumlu: "bg-[var(--ok-soft)] text-[var(--ok)] border-transparent",
  uyari: "bg-[var(--warn-soft)] text-[var(--warn)] border-transparent",
  tehlike: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
  bilgi: "bg-[var(--info-soft)] text-[var(--info)] border-transparent",
};

export function Rozet({
  children,
  ton = "notr",
  className,
}: {
  children: ReactNode;
  ton?: RozetTonu;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
        ROZET_TONLARI[ton],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Ölçülen değer                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Bir sayıyı etiketiyle birlikte gösterir (toplam bütçe, gün sayısı, mesafe).
 *
 * Etiket harita lejantı dilinde (mono, aralıklı, büyük harf), değer serif ve
 * tabular. İkisi arasındaki fark okumayı hızlandırıyor: göz etiketleri
 * atlayıp değerleri tarayabiliyor.
 */
export function Olcum({
  etiket,
  deger,
  birim,
  ton = "notr",
  className,
}: {
  etiket: string;
  deger: ReactNode;
  birim?: string;
  ton?: "notr" | "aksan" | "rota";
  className?: string;
}) {
  const degerRengi =
    ton === "aksan"
      ? "text-[var(--accent)]"
      : ton === "rota"
        ? "text-[var(--route)]"
        : "text-[var(--fg)]";

  return (
    <div className={className}>
      <p className="lejant text-[var(--fg-subtle)]">{etiket}</p>
      <p
        className={cx(
          "font-[family-name:var(--font-serif)] text-2xl sayisal mt-1.5 leading-none",
          degerRengi
        )}
      >
        {deger}
        {birim && (
          <span className="ml-1 text-sm font-[family-name:var(--font-geist-sans)] text-[var(--fg-muted)]">
            {birim}
          </span>
        )}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bildirim şeridi                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Satır içi bilgi/uyarı/hata şeridi.
 *
 * Sayfalar bunu her seferinde elle yazıyordu ve hepsi farklı bir renk
 * ailesi seçiyordu (turuncu, sarı, kırmızı, mavi — aynı anlam için).
 */
export function Serit({
  ton = "bilgi",
  baslik,
  children,
}: {
  ton?: "bilgi" | "uyari" | "tehlike" | "olumlu";
  baslik?: string;
  children: ReactNode;
}) {
  const tonlar = {
    bilgi: "bg-[var(--info-soft)] text-[var(--info)]",
    uyari: "bg-[var(--warn-soft)] text-[var(--warn)]",
    tehlike: "bg-[var(--danger-soft)] text-[var(--danger)]",
    olumlu: "bg-[var(--ok-soft)] text-[var(--ok)]",
  } as const;

  return (
    <div
      className={cx("rounded-[var(--radius)] px-4 py-3 text-sm", tonlar[ton])}
      role={ton === "tehlike" ? "alert" : "status"}
    >
      {baslik && <p className="font-medium mb-0.5">{baslik}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form alanları                                                              */
/* -------------------------------------------------------------------------- */

export const GIRDI_SINIFI =
  "w-full rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] " +
  "px-3 py-2.5 text-[var(--fg)] placeholder:text-[var(--fg-subtle)] " +
  "transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-[var(--accent)] " +
  "focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-60 " +
  "aria-[invalid=true]:border-[var(--danger)]";

export function Alan({
  etiket,
  htmlFor,
  ipucu,
  yardim,
  hata,
  zorunlu,
  children,
}: {
  etiket: string;
  htmlFor: string;
  /** Alanın altında görünen açıklama. */
  ipucu?: ReactNode;
  /**
   * Etiket satırının SAĞINDA duran ikincil eylem — "Şifremi unuttum" gibi.
   *
   * Neden altta değil: kullanıcı bu bağlantıya, ilgili alana baktığı anda
   * ihtiyaç duyuyor. Formun dibine koymak, şifresini hatırlamaya çalışıp
   * vazgeçen kullanıcıyı aşağı bakmaya zorluyordu.
   */
  yardim?: ReactNode;
  hata?: string;
  zorunlu?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--fg)]">
          {etiket}
          {zorunlu && (
            <span className="text-[var(--danger)] ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {yardim && <span className="text-sm shrink-0">{yardim}</span>}
      </div>
      {children}
      {/* Hata varsa ipucunun YERİNE geçiyor: ikisini birden göstermek
          kullanıcıyı hangisine bakacağı konusunda bölüyordu. */}
      {hata ? (
        <p className="flex items-start gap-1.5 text-sm text-[var(--danger)] mt-1.5">
          <Ikon.Uyari className="h-4 w-4 shrink-0 mt-0.5" />
          {hata}
        </p>
      ) : ipucu ? (
        <p className="text-sm text-[var(--fg-muted)] mt-1.5">{ipucu}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Boş durum                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Boş liste ekranı.
 *
 * Boş durum bir hata değil, bir DAVET. Kesik kenarlık burada "henüz
 * doldurulmamış bir alan" anlamına geliyor — pasaportun boş sayfası.
 */
export function BosDurum({
  baslik,
  aciklama,
  eylem,
}: {
  baslik: string;
  aciklama?: ReactNode;
  eylem?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden text-center py-14 px-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)]">
      <KonturDoku yogunluk={0.5} />
      <div className="relative">
        <Pusula className="h-8 w-8 mx-auto text-[var(--accent)] opacity-45" />
        <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)] mt-4">
          {baslik}
        </h3>
        {aciklama && (
          <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">{aciklama}</p>
        )}
        {eylem && <div className="mt-6 flex flex-wrap justify-center gap-3">{eylem}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Yükleniyor                                                                 */
/* -------------------------------------------------------------------------- */

export function Yukleniyor({ metin = "Yükleniyor…" }: { metin?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-[var(--fg-muted)]">
      <Donen />
      <span>{metin}</span>
    </div>
  );
}

/** İçerik yerine geçen iskelet; liste yüklenirken düzen sıçramasını önler. */
export function Iskelet({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-[var(--radius)] bg-[var(--surface-2)]", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Kart listesi iskeleti.
 *
 * NEDEN SPINNER DEĞİL: içeriğin ortasında dönen bir daire, sayfanın neye
 * dönüşeceği hakkında hiçbir şey söylemiyor ve yükleme bitince düzen
 * zıplıyor. İskelet gelecek düzeni şimdiden gösteriyor.
 */
export function KartIskeleti({ adet = 6 }: { adet?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
      {Array.from({ length: adet }, (_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] border border-[var(--line)] p-5 space-y-3"
        >
          <Iskelet className="h-5 w-2/3" />
          <Iskelet className="h-4 w-1/2" />
          <Iskelet className="h-8 w-1/3 mt-4" />
          <div className="space-y-2 pt-2">
            <Iskelet className="h-3 w-full" />
            <Iskelet className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sayfa kabuğu ve tekrar eden durum ekranları                                */
/* -------------------------------------------------------------------------- */

/**
 * Standart sayfa kabuğu: harita zemini, genişlik sınırı ve dikey boşluk.
 *
 * Sekiz sayfa bunu elle yazıyordu ve hiçbiri diğeriyle aynı değildi —
 * kimi `container mx-auto py-16`, kimi `max-w-7xl py-8`. Sayfadan sayfaya
 * geçerken içerik yatayda zıplıyordu.
 */
export function SayfaKabugu({
  children,
  genislik = "genis",
}: {
  children: ReactNode;
  /** `dar` form/okuma sayfaları, `genis` liste ve araç sayfaları için. */
  genislik?: "dar" | "genis";
}) {
  return (
    <div className="harita-zemin min-h-screen">
      <div
        className={cx(
          "mx-auto px-4 md:px-8 py-10 md:py-12",
          genislik === "dar" ? "max-w-3xl" : "max-w-6xl"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * "Giriş yapmanız gerekiyor" ekranı.
 *
 * Sekiz sayfada birebir kopyalanmıştı; her birinde düğme rengi ve metin
 * biraz farklıydı. Aynı engel her yerde aynı görünmeli.
 */
export function GirisGerekli({ aciklama }: { aciklama?: string }) {
  return (
    <SayfaKabugu genislik="dar">
      <BosDurum
        baslik="Giriş yapmanız gerekiyor"
        aciklama={
          aciklama ?? "Bu sayfa hesabınıza bağlı. Giriş yaptıktan sonra kaldığınız yerden devam edin."
        }
        eylem={
          <>
            <BagDugme href="/login">Giriş yap</BagDugme>
            <BagDugme href="/" tur="ikincil">
              Ana sayfa
            </BagDugme>
          </>
        }
      />
    </SayfaKabugu>
  );
}

/**
 * Hata ekranı.
 *
 * Hata metni PROBLEMİ, düğme ise ÇIKIŞ YOLUNU söylüyor — "Bir hata oluştu"
 * tek başına kullanıcıya ne olduğunu da ne yapacağını da anlatmıyordu.
 */
export function SayfaHatasi({
  mesaj,
  yenidenDene,
}: {
  mesaj: string;
  yenidenDene?: () => void;
}) {
  return (
    <SayfaKabugu genislik="dar">
      <BosDurum
        baslik="Bu sayfa yüklenemedi"
        aciklama={mesaj}
        eylem={
          <>
            {yenidenDene && <Dugme onClick={yenidenDene}>Tekrar dene</Dugme>}
            <BagDugme href="/" tur="ikincil">
              Ana sayfa
            </BagDugme>
          </>
        }
      />
    </SayfaKabugu>
  );
}
