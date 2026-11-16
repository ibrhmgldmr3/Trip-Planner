import { Plane } from "lucide-react";

const ROUTE = "M12 208C96 196 150 120 236 128s128 54 198-8 70-82 74-96";

/**
 * Hero'nun sağ üstündeki süs: kesik çizgili uçak rotası yavaşça çizilir, uçak hafifçe süzülür.
 * Kesik çizgi doğrudan `draw` ile canlandırılamaz (draw tek parça bir çizgi varsayar); bu yüzden
 * kesikli yol, kendisi çizilen düz bir yolun maskesiyle açığa çıkarılır.
 */
export default function HeroRoute() {
  return (
    <div
      className="pointer-events-none absolute right-[4%] top-24 hidden w-[min(34vw,30rem)] xl:block xl:top-28"
      aria-hidden="true"
    >
      <svg viewBox="0 0 520 220" fill="none" className="h-auto w-full overflow-visible">
        <defs>
          <mask id="hero-route-reveal" maskUnits="userSpaceOnUse" x="-20" y="-20" width="560" height="260">
            <path d={ROUTE} pathLength={1} stroke="#fff" strokeWidth="8" className="draw" />
          </mask>
        </defs>
        <path
          d={ROUTE}
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.75"
          className="route-dash"
          mask="url(#hero-route-reveal)"
        />
        <circle cx="12" cy="208" r="4" fill="#fff" fillOpacity="0.6" />
      </svg>
      <div className="drift absolute -right-3 -top-7">
        <Plane className="h-9 w-9 rotate-12 fill-white/90 text-white/90 drop-shadow-[0_4px_10px_rgb(15_14_31/0.35)]" />
      </div>
    </div>
  );
}
