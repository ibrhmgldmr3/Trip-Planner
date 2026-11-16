"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { CalendarDays, CircleAlert, Luggage, MapPin, Route, Wallet } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import PlanCard, { PlanCardSkeleton } from "@/components/PlanCard";
import { EmptyState, PageHeader } from "@/components/States";
import { formatMoney, tripDays } from "@/lib/format";
import type { PlanSummary } from "@/lib/plan";

function MyTrips() {
  const [trips, setTrips] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Gezi defteri, "gerçekleşti" olarak işaretlenmiş planlardan oluşur.
  const fetchTrips = useCallback(async () => {
    try {
      const response = await fetch("/api/plans?status=DONE");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTrips(data.plans ?? []);
      setError(null);
    } catch {
      setError("Gezilerin yüklenemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const deleteTrip = async (trip: PlanSummary) => {
    if (!confirm(`${trip.city} gezisini ve planını kalıcı olarak silmek istediğine emin misin?`)) return;

    setBusyId(trip.id);
    try {
      const response = await fetch(`/api/plans/${trip.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Gezi silindi");
      setTrips((prev) => prev.filter((item) => item.id !== trip.id));
    } catch {
      toast.error("Gezi silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  const stats = useMemo(() => {
    const cities = new Set(trips.map((trip) => trip.city.trim().toLocaleLowerCase("tr-TR")));
    const costed = trips.filter((trip) => trip.totalCost !== null);
    return {
      count: trips.length,
      cities: cities.size,
      days: trips.reduce((sum, trip) => sum + tripDays(trip.startDate, trip.endDate), 0),
      // Tutarı olmayan gezi yoksa uydurma bir "0 ₺" yerine "—" gösterilir.
      spent: costed.length > 0 ? costed.reduce((sum, trip) => sum + (trip.totalCost ?? 0), 0) : null,
    };
  }, [trips]);

  return (
    <div>
      <PageHeader
        title="Gezi defteri"
        description="Gerçekleşti olarak işaretlediğin planlar burada birikir."
        actions={
          <Link href="/my-plans" className="btn btn-outline">
            Planlarıma git
          </Link>
        }
      />

      {error && (
        <div className="notice notice-error mb-6" role="alert">
          <CircleAlert />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Gezi defterin açılıyor…</span>
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="skeleton h-[6.5rem] rounded-[1.25rem]" />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <PlanCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : trips.length === 0 && !error ? (
        <EmptyState
          icon={<Luggage />}
          title="Defterin henüz boş"
          description="Bir planın tarihi geçtiğinde Planlarım’dan “Gerçekleşti” olarak işaretle; gezin buraya eklensin."
        >
          <Link href="/my-plans" className="btn btn-primary">
            Planlarıma git
          </Link>
          <Link href="/travel-mode" className="btn btn-outline">
            Yeni plan oluştur
          </Link>
        </EmptyState>
      ) : trips.length > 0 ? (
        <>
          <dl className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatTile index={0} icon={<Route />} label="Gezi" value={String(stats.count)} />
            <StatTile index={1} icon={<MapPin />} label="Şehir" value={String(stats.cities)} />
            <StatTile index={2} icon={<CalendarDays />} label="Gün" value={String(stats.days)} />
            <StatTile index={3} icon={<Wallet />} label="Toplam bütçe" value={formatMoney(stats.spent)} />
          </dl>

          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip, index) => (
              <li key={trip.id} className="rise" style={{ "--i": Math.min(index + 2, 10) } as React.CSSProperties}>
                <PlanCard plan={trip} busy={busyId === trip.id} onDelete={() => deleteTrip(trip)} journal />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function StatTile({ icon, label, value, index }: { icon: ReactNode; label: string; value: string; index: number }) {
  return (
    <div className="card rise flex min-w-0 flex-col gap-3 p-4 md:p-5" style={{ "--i": index } as React.CSSProperties}>
      <span
        className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:h-[1.1rem] [&_svg]:w-[1.1rem]"
        aria-hidden="true"
      >
        {icon}
      </span>
      {/* dt önce gelmeli; görsel sırada değer üstte durur. */}
      <div className="flex min-w-0 flex-col-reverse">
        <dt className="mt-0.5 text-sm text-ink-2">{label}</dt>
        <dd className="tabular truncate font-display text-xl font-extrabold leading-tight text-ink sm:text-2xl md:text-[1.7rem]">
          {value}
        </dd>
      </div>
    </div>
  );
}

export default function MyTripsPage() {
  return (
    <AuthGate reason="Gezi defterini görebilmek için hesabına giriş yapmalısın.">
      <MyTrips />
    </AuthGate>
  );
}
