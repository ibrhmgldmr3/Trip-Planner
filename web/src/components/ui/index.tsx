import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Paylaşılan arayüz parçaları.
 *
 * NEDEN VAR: her sayfa kendi düğmesini, kartını ve rozetini elle yazıyordu.
 * Sonuç, aynı işi yapan ama farklı görünen onlarca öğeydi — bir sayfada
 * `rounded-lg` mavi gradient bir düğme, diğerinde `rounded-xl` yeşil düz bir
 * düğme, üçüncüsünde `rounded-2xl` mor. Kullanıcı için bu "farklı şeyler"
 * demek; oysa hepsi aynı eylemdi.
 *
 * KURAL: renk doğrudan Tailwind paletinden değil, `globals.css`'teki
 * token'lardan geliyor (`var(--accent)` vb.). Böylece tema tek yerden
 * değişiyor ve açık/koyu tema otomatik tutuyor.
 *
 * TİPOGRAFİ SINIRI: serif YALNIZCA başlıklarda ve tek tük öne çıkan
 * rakamlarda. Etiket, düğme, tablo hücresi ve form metni sans kalıyor —
 * uygulama arayüzünde iki aileyi her yere karıştırmak okunurluğu düşürüyor.
 *
 * Bu dosya bilinçli olarak SUNUCU BİLEŞENİ: hiçbiri state tutmuyor, hepsi
 * saf sunum. `"use client"` eklemek bu parçaları kullanan her sayfayı
 * gereksizce istemci tarafına çekerdi.
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
 * ekran okuyucuda metin olarak okunuyor. Gerçek ikonlar aynı `stroke-width`
 * ve aynı kutuda duruyor.
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
/* Düğme                                                                      */
/* -------------------------------------------------------------------------- */

type DugmeTuru = "birincil" | "ikincil" | "sessiz" | "tehlike";
type DugmeBoyu = "sm" | "md" | "lg";

const DUGME_TABANI =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius)] " +
  // 150ms: kullanıcı bir görevin içinde, koreografiyi beklemesin.
  "transition-colors duration-150 " +
  // Klavye odağı GÖRÜNÜR olmalı: eski düğmelerin çoğunda odak halkası
  // `outline-none` ile kapatılmış ama yerine bir şey konmamıştı.
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const DUGME_TURLERI: Record<DugmeTuru, string> = {
  birincil:
    "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] " +
    "active:bg-[var(--accent-active)]",
  ikincil:
    "bg-[var(--surface)] text-[var(--fg)] border border-[var(--line-strong)] " +
    "hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]",
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
   *
   * Sayfalar bunu `{yukleniyor ? "Kaydediliyor…" : "Kaydet"}` diye elle
   * yazıyordu; genişlik zıplıyor ve her sayfa farklı bir metin seçiyordu.
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
        // Dikey dolgu + negatif marj: dokunma hedefi 20px'ten ~40px'e
        // cikiyor, satirin gorsel yuksekligi degismiyor.
        "py-2.5 -my-2.5",
        "hover:underline underline-offset-4 rounded",
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
  /** Tıklanabilir kartlarda hafif bir hover geri bildirimi verir. */
  etkilesimli?: boolean;
}

export function Kart({ children, className, etkilesimli }: KartProps) {
  return (
    <div
      className={cx(
        // Gölge yerine kenarlık: sayfada 10 kart yan yanayken gölgeler
        // birbirine karışıp zemini kirletiyordu.
        "bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-lg)]",
        etkilesimli && "transition-colors duration-150 hover:border-[var(--line-strong)]",
        className
      )}
    >
      {children}
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
 * taşıyor, etiket yalnızca göze bir engel daha ekliyor.
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
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 mb-8 border-b border-[var(--line)]">
      <div className="min-w-0">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl md:text-4xl text-[var(--fg)] leading-tight text-balance">
          {baslik}
        </h1>
        {aciklama && (
          <p className="text-[var(--fg-muted)] mt-2 max-w-2xl leading-relaxed">{aciklama}</p>
        )}
      </div>
      {yan && <div className="shrink-0">{yan}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Rozet                                                                      */
/* -------------------------------------------------------------------------- */

type RozetTonu = "notr" | "aksan" | "olumlu" | "uyari" | "tehlike" | "bilgi";

const ROZET_TONLARI: Record<RozetTonu, string> = {
  notr: "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--line)]",
  aksan: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
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
  "transition-colors duration-150 focus:outline-none focus:border-[var(--accent)] " +
  "focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-60 " +
  "aria-[invalid=true]:border-[var(--danger)]";

export function Alan({
  etiket,
  htmlFor,
  ipucu,
  hata,
  zorunlu,
  children,
}: {
  etiket: string;
  htmlFor: string;
  /** Alanın altında görünen açıklama. */
  ipucu?: ReactNode;
  hata?: string;
  zorunlu?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--fg)] mb-1.5">
        {etiket}
        {zorunlu && (
          <span className="text-[var(--danger)] ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
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
 * Boş durum bir hata değil, bir DAVET: kullanıcıya ne olduğunu ve sıradaki
 * adımı söylüyor. Eskiden bu ekranlar ya bomboştu ya da yalnızca
 * "Henüz veri yok" yazıyordu.
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
    <div className="text-center py-14 px-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)]">
      <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--fg)]">{baslik}</h3>
      {aciklama && (
        <p className="text-[var(--fg-muted)] mt-2 max-w-md mx-auto leading-relaxed">{aciklama}</p>
      )}
      {eylem && <div className="mt-6 flex flex-wrap justify-center gap-3">{eylem}</div>}
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
 * NEDEN SPINNER DEĞİL: içeriğin ortasında dönen bir daire, sayfanın
 * neye dönüşeceği hakkında hiçbir şey söylemiyor ve yükleme bitince düzen
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
 * Standart sayfa kabuğu: zemin, genişlik sınırı ve dikey boşluk.
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
    <div className="min-h-screen bg-[var(--bg)]">
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
