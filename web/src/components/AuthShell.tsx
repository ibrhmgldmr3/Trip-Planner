import type { ReactNode } from "react";
import { Check, Plane } from "lucide-react";
import CityCover from "@/components/CityCover";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

const BENEFITS = [
  "Gün gün plan ve bütçe tahmini",
  "Planların hesabında saklanır",
  "Gerçekleşen gezilerin tek yerde",
];

/** Giriş ve kayıt sayfalarının ortak düzeni: solda form, sağda şehir fotoğrafı. */
export default function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-10 px-5 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
      <div className="flex flex-col justify-center">
        <div className="rise mx-auto w-full max-w-md">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-display text-[2.2rem] font-extrabold leading-tight text-ink md:text-[2.6rem]">
            {title}
          </h1>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-2">{description}</p>

          <div className="card mt-8 p-6 sm:p-8">{children}</div>

          <p className="mt-6 text-center text-sm text-ink-2">{footer}</p>
        </div>
      </div>

      <aside className="hidden lg:block">
        <CityCover
          city="Kapadokya"
          eager
          credit
          className="h-full min-h-[38rem] rounded-[1.75rem] shadow-float"
        >
          <div className="scrim absolute inset-0" />

          {/* Fotoğrafın üst kısmında yavaşça çizilen kesik uçuş rotası */}
          <svg
            aria-hidden="true"
            viewBox="0 0 500 300"
            className="pointer-events-none absolute inset-x-0 top-0 h-[55%] w-full"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <mask id="auth-route-mask" maskUnits="userSpaceOnUse">
                <path
                  d="M30 250C110 230 130 150 220 140s170 40 240-80"
                  stroke="#fff"
                  strokeWidth="8"
                  pathLength={1}
                  className="draw"
                />
              </mask>
            </defs>
            <path
              d="M30 250C110 230 130 150 220 140s170 40 240-80"
              stroke="#fff"
              strokeWidth="2"
              opacity="0.55"
              className="route-dash"
              mask="url(#auth-route-mask)"
            />
            <circle cx="30" cy="250" r="4.5" fill="#fff" opacity="0.8" />
          </svg>
          <span aria-hidden="true" className="drift absolute right-[9%] top-[13%] text-white/90 [&_svg]:h-8 [&_svg]:w-8">
            <Plane strokeWidth={1.6} className="-rotate-12" />
          </span>

          <div className="absolute inset-x-0 bottom-0 p-10 pb-12 text-white">
            <p className="max-w-md font-display text-[2.4rem] font-extrabold leading-[1.1]">
              İyi bir yolculuk, iyi bir planla başlar.
            </p>
            <ul className="mt-7 space-y-3 text-[0.95rem] font-medium text-white/90">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/20 backdrop-blur [&_svg]:h-3.5 [&_svg]:w-3.5">
                    <Check strokeWidth={3} />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </CityCover>
      </aside>
    </main>
  );
}

/** Google ile giriş düğmesindeki marka işareti. */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1rem] w-[1.1rem]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
