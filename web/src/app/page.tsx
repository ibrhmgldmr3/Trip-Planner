import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Map as MapIcon,
  BookOpen,
  Mouse,
  PencilLine,
  ReceiptText,
  Sparkles,
  Wallet,
} from "lucide-react";
import QuickPlanForm from "@/components/QuickPlanForm";
import CityCover from "@/components/CityCover";
import HeroRoute from "@/components/landing/HeroRoute";
import { coverKey, getCityCovers, type CityCover as Cover } from "@/server/covers";
import { coverRef, findDestination, formatDays, type Destination } from "@/lib/destinations";

export const dynamic = "force-dynamic";

const HERO_CITY = "Kapadokya";
const POPULAR = ["İstanbul", "İzmir", "Antalya", "Mardin"]
  .map(findDestination)
  .filter((destination): destination is Destination => Boolean(destination));

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

type Covers = Map<string, Cover>;

async function loadCovers(): Promise<Covers> {
  // Kapaklar yalnızca süs: veritabanı ya da Wikipedia yanıt vermezse renk geçişleri görünür.
  try {
    const hero = findDestination(HERO_CITY);
    return await getCityCovers([hero ? coverRef(hero) : { city: HERO_CITY }, ...POPULAR.map(coverRef)]);
  } catch (error) {
    console.warn("[home] Kapaklar alınamadı:", error instanceof Error ? error.message : error);
    return new Map();
  }
}

const coverOf = (covers: Covers, city: string) => covers.get(coverKey(city)) ?? { imageUrl: null, pageUrl: null };

export default async function Home() {
  const covers = await loadCovers();

  return (
    <main>
      <Hero cover={coverOf(covers, HERO_CITY)} />
      <PopularRoutes covers={covers} />
      <PlanContents />
      <HowItWorks />
      <Modes />
      <ClosingCall />
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Hero({ cover }: { cover: Cover }) {
  return (
    // Yapışkan başlık (h-16) şeffaf olarak fotoğrafın üzerine biner: bölüm sayfanın en üstünden başlar.
    <section className="-mt-16">
      <CityCover
        city={HERO_CITY}
        src={cover.imageUrl}
        pageUrl={cover.pageUrl}
        eager
        credit
        className="min-h-[40rem] rounded-b-[1.75rem] text-white md:min-h-[88vh] md:rounded-b-[2.25rem]"
      >
        <div className="scrim-left absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[rgb(15_14_31/0.55)] via-transparent to-[rgb(15_14_31/0.35)]"
          aria-hidden="true"
        />

        <HeroRoute />

        <div className="relative mx-auto flex min-h-[inherit] max-w-7xl flex-col justify-center px-5 pb-20 pt-28 md:px-8 md:pb-24 md:pt-36">
          <div className="max-w-2xl">
            <h1
              className="rise font-display text-[2.6rem] font-extrabold leading-[1.05] sm:text-6xl lg:text-[4.4rem]"
              style={stagger(0)}
            >
              Sıradaki <span className="text-lav">maceran</span>
              <br />
              seni bekliyor
            </h1>
            <p className="rise mt-5 max-w-xl text-lg leading-relaxed text-white/85" style={stagger(1)}>
              Şehri ve tarihleri yaz; gün gün duraklar, harita ve bütçe tahmini içeren gezi planın hazırlansın.
            </p>
          </div>

          <div className="rise mt-9 max-w-3xl" style={stagger(2)}>
            <QuickPlanForm />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 hidden md:block">
          <div className="mx-auto max-w-7xl px-8">
            <a
              href="#populer"
              className="pointer-events-auto inline-flex items-center gap-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              <Mouse className="h-5 w-5" aria-hidden="true" />
              Keşfetmek için kaydır
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </CityCover>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-ink md:text-[2.5rem]">{title}</h2>
      {lead && <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-2">{lead}</p>}
    </div>
  );
}

function PopularRoutes({ covers }: { covers: Covers }) {
  return (
    <section id="populer" className="mx-auto w-full max-w-7xl scroll-mt-20 px-5 pt-20 md:px-8 md:pt-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="İlham al"
          title="Popüler rotalar"
          lead="Birini seç, şehir hazır gelsin; tarihleri ve tercihlerini planlayıcıda eklersin."
        />
        <Link href="/explore" className="btn btn-outline shrink-0 self-start sm:self-auto">
          Tümünü keşfet
          <ArrowRight />
        </Link>
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POPULAR.map((destination, index) => {
          const cover = coverOf(covers, destination.name);
          return (
            <li key={destination.name} className="rise" style={stagger(index)}>
              <Link
                href={`/ai-planner?city=${encodeURIComponent(destination.name)}`}
                className="card card-lift group block overflow-hidden"
              >
                <CityCover
                  city={destination.name}
                  src={cover.imageUrl}
                  pageUrl={cover.pageUrl}
                  imageClassName="zoom-img"
                  className="h-60 rounded-t-[1.25rem]"
                >
                  <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold">
                    {destination.region}
                  </span>
                </CityCover>
                <div className="flex items-center gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-bold text-ink">{destination.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                      <CalendarDays className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      <span className="tabular">{formatDays(destination.days)}</span>
                    </p>
                  </div>
                  <span
                    className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-on-brand"
                    aria-hidden="true"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PlanContents() {
  const items = [
    {
      icon: <CalendarDays />,
      title: "Gün gün duraklar",
      text: "Her gün için sabah, öğle ve akşam durakları; ne kadar süreceği ve hangi sırayla gezileceği.",
      wide: true,
    },
    {
      icon: <MapIcon />,
      title: "Harita",
      text: "Durakların harita üzerinde gün gün işaretlenmiş hâli; rotayı bir bakışta görürsün.",
      wide: true,
    },
    {
      icon: <BookOpen />,
      title: "Rehberler",
      text: "Şehir rehberi, yeme-içme önerileri ve ulaşım, güvenlik gibi pratik bilgiler.",
    },
    {
      icon: <Wallet />,
      title: "Bütçe tahmini",
      text: "Ulaşım, konaklama, yeme-içme ve giriş ücretleri kalem kalem; toplamıyla birlikte.",
    },
    {
      icon: <ReceiptText />,
      title: "Harcama takibi",
      text: "Gezi sırasında yaptığın harcamaları ekle, tahminle karşılaştır.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <SectionHeading
        eyebrow="Tek girdi, tam plan"
        title="Bir planın içinde neler var?"
        lead="Oluşturduğun her plan hesabına kaydedilir; dilediğin zaman açar, düzenler ya da tamamlandı olarak işaretlersin."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-6">
        {items.map((item, index) => (
          <article
            key={item.title}
            className={`card card-lift rise p-7 ${item.wide ? "md:col-span-3" : "md:col-span-2"}`}
            style={stagger(index)}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand [&_svg]:h-5 [&_svg]:w-5">
              {item.icon}
            </span>
            <h3 className="mt-5 font-display text-xl font-bold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Nereye, ne zaman?",
      text: "Şehri ve tarihleri gir. İstersen bütçeni, seyahat tarzını ve ilgi alanlarını da ekle.",
    },
    {
      title: "Planın oluşsun",
      text: "Yapay zekâ gün gün programını çıkarsın ya da ulaşım, konaklama ve aktiviteleri kendin seç.",
    },
    {
      title: "Kaydet, yolda takip et",
      text: "Planın hesabında durur: yaklaşan, devam eden ve gerçekleşen gezilerini tek yerden izle.",
    },
  ];

  return (
    <section className="border-y border-line bg-canvas-2/60">
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
        <SectionHeading eyebrow="Nasıl çalışır?" title="Üç adımda plan" />

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span
            className="absolute left-6 right-[calc(33%-1.5rem)] top-6 hidden border-t-2 border-dashed border-line-2 md:block"
            aria-hidden="true"
          />
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="tabular relative z-10 grid h-12 w-12 place-items-center rounded-full bg-brand font-display text-lg font-extrabold text-on-brand shadow-soft">
                {index + 1}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Modes() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <SectionHeading
        eyebrow="İki yol"
        title="Hazırlatmak mı, kurmak mı?"
        lead="Aynı yere iki yoldan varılır. Hangisini seçersen seç, planın aynı yerde saklanır."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <article className="card card-lift glow overflow-hidden p-8">
          <span className="tag tag-brand">
            <Sparkles />
            En hızlısı
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold text-ink">AI ile planla</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Şehri, tarihleri ve tercihlerini yaz; şehir rehberinden bütçe tahminine kadar eksiksiz bir plan hazırlansın.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink-2">
            <Bullet>Sadece şehir girerek de çalışır</Bullet>
            <Bullet>İlgi alanlarına göre kişiselleşir</Bullet>
            <Bullet>Otomatik kaydedilir</Bullet>
          </ul>
          <Link href="/ai-planner" className="btn btn-primary mt-7">
            AI ile başla
            <ArrowRight />
          </Link>
        </article>

        <article className="card card-lift overflow-hidden p-8">
          <span className="tag tag-brand">
            <PencilLine />
            Tam kontrol
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold text-ink">Adım adım kendin kur</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Ulaşımı ve konaklamayı seç, her güne saatli aktiviteler ekle; bütçen sen ilerledikçe kendiliğinden
            hesaplansın.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink-2">
            <Bullet>Altı adımlı rehberli akış</Bullet>
            <Bullet>Saat ve maliyetle aktivite ekleme</Bullet>
            <Bullet>Hedef bütçeyle karşılaştırma</Bullet>
          </ul>
          <Link href="/manual-planner" className="btn btn-outline mt-7">
            Kendim planlayacağım
            <ArrowRight />
          </Link>
        </article>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-lav" />
      {children}
    </li>
  );
}

function ClosingCall() {
  return (
    <section className="px-5 pb-20 md:px-8 md:pb-28">
      <div className="glow relative mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand to-accent px-6 py-16 text-center text-on-brand shadow-lift md:px-12 md:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight md:text-5xl">
          Bir sonraki rotan nereye?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[1.02rem] leading-relaxed opacity-85">
          Ücretsiz bir hesap aç, ilk planını birkaç dakikada oluştur.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/travel-mode" className="btn btn-white btn-lg">
            Planlamaya başla
            <ArrowRight />
          </Link>
          <Link
            href="/register"
            className="btn btn-lg border-on-brand/40 bg-transparent text-on-brand hover:bg-on-brand/10"
          >
            Hesap oluştur
          </Link>
        </div>
      </div>
    </section>
  );
}
