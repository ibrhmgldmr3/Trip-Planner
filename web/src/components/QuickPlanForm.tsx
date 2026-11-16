"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, CalendarDays, Landmark, MapPin, Mountain, Sun, Castle } from "lucide-react";
import { todayISO, tripDays } from "@/lib/format";

const POPULAR: { name: string; icon: ReactNode }[] = [
  { name: "İstanbul", icon: <Landmark /> },
  { name: "Kapadokya", icon: <Mountain /> },
  { name: "Antalya", icon: <Sun /> },
  { name: "Mardin", icon: <Castle /> },
];

/** Ana sayfadaki hızlı başlangıç: yalnızca şehir ve tarihle AI planlayıcıya geçer. */
export default function QuickPlanForm() {
  const router = useRouter();
  const { status } = useSession();
  const [city, setCity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const today = todayISO();
  const days = tripDays(start, end);
  const submitLabel = days > 0 ? `${days} günlük plan oluştur` : "Planı oluştur";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    const query = params.toString();
    const target = query ? `/ai-planner?${query}` : "/ai-planner";
    router.push(status === "authenticated" ? target : `/login?callbackUrl=${encodeURIComponent(target)}`);
  };

  const dateInput =
    "w-full min-w-0 bg-transparent text-[0.95rem] font-medium text-ink outline-none [&::-webkit-calendar-picker-indicator]:opacity-60";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Beyaz arama çubuğu: geniş ekranda tek satır hap, dar ekranda alt alta */}
      <div className="flex flex-col gap-1 rounded-[1.5rem] bg-surface p-2 text-ink shadow-float sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-1.5 sm:pl-2">
        <label
          htmlFor="quick-city"
          className="flex min-w-0 flex-[1.2] cursor-text items-center gap-3 rounded-2xl px-3 py-2 transition-colors focus-within:bg-canvas-2 sm:rounded-full sm:px-4"
        >
          <MapPin className="h-5 w-5 flex-none text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink-3">Nereye?</span>
            <input
              id="quick-city"
              className="w-full min-w-0 bg-transparent text-[0.95rem] font-medium text-ink outline-none placeholder:text-ink-3 placeholder:font-normal"
              placeholder="Şehir yaz, ör. İzmir"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              autoComplete="off"
              required
            />
          </span>
        </label>

        <span className="mx-3 h-px bg-line sm:mx-0 sm:h-9 sm:w-px" aria-hidden="true" />

        <div role="group" aria-labelledby="quick-when" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 transition-colors focus-within:bg-canvas-2 sm:rounded-full sm:px-4">
          <CalendarDays className="h-5 w-5 flex-none text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span id="quick-when" className="block text-xs font-semibold text-ink-3">
              Ne zaman?
            </span>
            <span className="flex items-center gap-1.5">
              <label htmlFor="quick-start" className="sr-only">
                Gidiş tarihi
              </label>
              <input
                id="quick-start"
                type="date"
                className={dateInput}
                min={today}
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  if (end && event.target.value > end) setEnd("");
                }}
              />
              <span className="text-ink-3" aria-hidden="true">
                –
              </span>
              <label htmlFor="quick-end" className="sr-only">
                Dönüş tarihi
              </label>
              <input
                id="quick-end"
                type="date"
                className={dateInput}
                min={start || today}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </span>
          </span>
        </div>

        {/* Dar ekranda yazılı tam genişlik düğme, geniş ekranda yuvarlak ok */}
        <button type="submit" className="btn btn-primary mt-1 w-full sm:hidden">
          {submitLabel}
          <ArrowRight />
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-icon hidden h-12 w-12 flex-none sm:ml-1 sm:inline-flex"
          aria-label={submitLabel}
          title={submitLabel}
        >
          <ArrowRight />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {POPULAR.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setCity(item.name)}
            aria-pressed={city.trim() === item.name}
            className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors hover:bg-white/25 aria-pressed:bg-white/30 [&_svg]:h-4 [&_svg]:w-4"
          >
            {item.icon}
            {item.name}
          </button>
        ))}
      </div>
    </form>
  );
}
