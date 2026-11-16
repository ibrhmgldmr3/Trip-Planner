import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  {
    title: "Keşfet",
    items: [
      { href: "/explore", label: "Destinasyonlar" },
      { href: "/ai-planner", label: "AI ile planla" },
      { href: "/manual-planner", label: "Adım adım planla" },
    ],
  },
  {
    title: "Yolculuklarım",
    items: [
      { href: "/my-plans", label: "Planlarım" },
      { href: "/my-trips", label: "Gezi defteri" },
      { href: "/budget", label: "Bütçe" },
    ],
  },
  {
    title: "Hesap",
    items: [
      { href: "/profile", label: "Profil ve tercihler" },
      { href: "/login", label: "Giriş yap" },
      { href: "/register", label: "Kayıt ol" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="no-print mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-2">
              Şehri ve tarihi söyle; gün gün rotan, haritan ve bütçe tahminin hazır olsun.
            </p>
          </div>

          {LINKS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="mb-3 text-sm font-bold text-ink">{group.title}</p>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-sm text-ink-2 transition-colors hover:text-brand">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <hr className="dash-rule my-8" />

        <div className="flex flex-col items-start justify-between gap-2 text-xs text-ink-3 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} TripPlanner · İbrahim Güldemir</p>
          <p>
            Şehir fotoğrafları Wikipedia, harita verisi OpenStreetMap katkıcılarından.
          </p>
        </div>
      </div>
    </footer>
  );
}
