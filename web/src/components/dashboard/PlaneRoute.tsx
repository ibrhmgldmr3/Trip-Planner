"use client";

import { useId } from "react";
import { Plane } from "lucide-react";

/**
 * Başlığın arkasındaki süs: yumuşak bir ışıma, kendini yavaşça çizen kesik çizgili
 * rota ve ucunda süzülen uçak. Yalnızca görseldir, ekran okuyuculardan gizlenir.
 */
export default function PlaneRoute({ className = "" }: { className?: string }) {
  const maskId = `route-${useId().replace(/:/g, "")}`;

  return (
    <div className={`pointer-events-none absolute -z-10 h-[8.5rem] w-[22rem] max-w-full ${className}`} aria-hidden="true">
      <div className="absolute -top-6 right-2 h-36 w-36 rounded-full bg-lav/25 blur-2xl" />
      <svg viewBox="0 0 352 136" fill="none" className="absolute inset-0 h-full w-full">
        <defs>
          {/* Kesik çizgi kendi dash düzenini kullandığı için çizilme efekti maske ile verilir. */}
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <path
              d="M8 126C70 128 96 76 160 78S268 70 318 28"
              pathLength={1}
              stroke="#fff"
              strokeWidth="6"
              className="draw"
            />
          </mask>
        </defs>
        <path
          d="M8 126C70 128 96 76 160 78S268 70 318 28"
          stroke="var(--brand)"
          strokeOpacity="0.35"
          strokeWidth="1.6"
          className="route-dash"
          mask={`url(#${maskId})`}
        />
      </svg>
      <div className="drift absolute right-0 top-0 text-brand opacity-45 [&_svg]:h-8 [&_svg]:w-8">
        <Plane strokeWidth={1.6} />
      </div>
    </div>
  );
}
