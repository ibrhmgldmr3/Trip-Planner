import Link from "next/link";

/** Marka işareti: kâğıt uçak. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-wing" x1="2" y1="4" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b7cf6" />
          <stop offset="1" stopColor="#5446d8" />
        </linearGradient>
      </defs>
      <path d="M2.5 13.2 29 3.5 19.4 28.6l-5.2-10.2L2.5 13.2Z" fill="url(#logo-wing)" />
      <path d="M29 3.5 14.2 18.4l1.4 8.1 3.8 2.1L29 3.5Z" fill="#b9aeff" />
      <path d="m14.2 18.4 1.4 8.1 3.1-5.3-4.5-2.8Z" fill="#4337b8" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Fotoğraf ya da koyu zemin üzerinde beyaz yazı. */
  onDark?: boolean;
}

export default function Logo({ className = "", onDark = false }: LogoProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2 rounded-lg ${className}`}
      aria-label="TripPlanner ana sayfa"
    >
      <LogoMark className="h-7 w-7 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      <span
        className={`font-display text-[1.2rem] font-bold leading-none transition-colors ${onDark ? "text-white" : "text-ink"}`}
      >
        TripPlanner
      </span>
    </Link>
  );
}
