import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock, PencilLine, Sparkles } from "lucide-react";
import { Page, PageHeader } from "@/components/States";

export const metadata: Metadata = { title: "Yeni plan" };

const MODES = [
  {
    href: "/ai-planner",
    icon: <Sparkles />,
    tag: "En hızlısı",
    title: "AI ile planla",
    text: "Şehri, tarihleri ve tercihlerini yaz; planın tamamını yapay zekâ hazırlasın.",
    time: "Yaklaşık 1–2 dakika",
    points: [
      "Yalnızca şehir yazarak da başlayabilirsin",
      "Şehir rehberi, günlük program, yeme-içme, pratik bilgiler",
      "Kalem kalem bütçe tahmini",
    ],
    cta: "AI ile başla",
    button: "btn-primary",
  },
  {
    href: "/manual-planner",
    icon: <PencilLine />,
    tag: "Tam kontrol",
    title: "Adım adım kendin kur",
    text: "Ulaşımı, konaklamayı ve her günün aktivitelerini kendin belirle.",
    time: "Yaklaşık 5–10 dakika",
    points: [
      "Altı adımlı rehberli akış",
      "Her güne saat ve maliyetle aktivite ekle",
      "Bütçen sen ilerledikçe hesaplanır",
    ],
    cta: "Kendim planlayacağım",
    button: "btn-outline",
  },
];

export default function TravelModePage() {
  return (
    <Page>
      <PageHeader
        eyebrow="Yeni plan"
        title="Nasıl planlamak istersin?"
        description="İki yol da aynı yere çıkar: planın hesabına kaydedilir, Planlarım’dan takip edersin."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {MODES.map((mode, index) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="card card-lift rise group flex flex-col overflow-hidden"
            style={{ "--i": index + 1 } as React.CSSProperties}
          >
            {/* Görsel alan: yumuşak indigo → lavanta geçişi */}
            <div className="glow relative grid h-44 place-items-center overflow-hidden bg-linear-to-br from-brand-soft via-accent-soft to-lav/30 md:h-52">
              <svg
                viewBox="0 0 320 120"
                className="absolute inset-x-0 bottom-3 h-24 w-full text-brand opacity-30"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 100C70 100 80 40 150 40s90 50 160 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="route-dash"
                />
              </svg>
              <span className="zoom-img relative grid h-20 w-20 place-items-center rounded-3xl bg-surface text-brand shadow-lift [&_svg]:h-9 [&_svg]:w-9">
                {mode.icon}
              </span>
              <span className="tag absolute left-5 top-5 bg-surface text-brand shadow-soft">{mode.tag}</span>
            </div>

            <div className="flex flex-1 flex-col p-7 md:p-8">
              <h2 className="font-display text-[1.6rem] font-extrabold leading-tight text-ink md:text-[1.75rem]">
                {mode.title}
              </h2>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-2">{mode.text}</p>

              <ul className="mt-6 space-y-3">
                {mode.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-ink-2">
                    <span className="mt-px grid h-5 w-5 flex-none place-items-center rounded-full bg-brand-soft text-brand">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-7">
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
                  <span className="tabular flex items-center gap-1.5 text-sm text-ink-3">
                    <Clock className="h-4 w-4" />
                    {mode.time}
                  </span>
                  <span className={`btn ${mode.button}`}>
                    {mode.cta}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
