"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { CircleAlert, Compass, Plus } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import PlanCard, { PlanCardSkeleton } from "@/components/PlanCard";
import FeaturedTrip, { FeaturedTripSkeleton, pickFeatured } from "@/components/dashboard/FeaturedTrip";
import NewPlanCard from "@/components/dashboard/NewPlanCard";
import PlaneRoute from "@/components/dashboard/PlaneRoute";
import { EmptyState } from "@/components/States";
import { effectiveStatus, STATUS_LABEL, type PlanStatus, type PlanSummary, type StoredStatus } from "@/lib/plan";

type Filter = "ALL" | PlanStatus;

const FILTER_ORDER: PlanStatus[] = ["ACTIVE", "PLANNED", "COMPLETED", "DONE", "CANCELLED"];

function MyPlans() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPlans(data.plans ?? []);
      setError(null);
    } catch {
      setError("Planların yüklenemedi. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const updateStatus = async (planId: string, status: StoredStatus) => {
    if (status === "CANCELLED" && !confirm("Bu planı iptal etmek istediğine emin misin?")) return;

    setBusyId(planId);
    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      toast.success(
        status === "CANCELLED" ? "Plan iptal edildi" : status === "DONE" ? "Gezi defterine eklendi" : "Plan geri alındı"
      );
      await fetchPlans();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Plan durumu güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Bu planı kalıcı olarak silmek istediğine emin misin?")) return;

    setBusyId(planId);
    try {
      const response = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Plan silindi");
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    } catch {
      toast.error("Plan silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const map = new Map<PlanStatus, number>();
    for (const plan of plans) {
      const status = effectiveStatus(plan);
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return map;
  }, [plans]);

  const visible = useMemo(
    () => (filter === "ALL" ? plans : plans.filter((plan) => effectiveStatus(plan) === filter)),
    [plans, filter]
  );

  const featured = useMemo(() => pickFeatured(plans), [plans]);

  return (
    <div>
      <header className="relative isolate mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PlaneRoute className="right-36 top-[-1.5rem] hidden md:block" />
        <div className="rise">
          <h1 className="font-display text-[2rem] font-extrabold leading-tight text-ink md:text-[2.5rem]">Planlarım</h1>
          <p className="mt-1.5 max-w-xl text-[0.98rem] leading-relaxed text-ink-2">
            Tüm gezilerin tek yerde; sıradakinin hazırlığını buradan takip et.
          </p>
        </div>
        <div className="rise flex-none" style={{ "--i": 1 } as React.CSSProperties}>
          <Link href="/travel-mode" className="btn btn-primary">
            <Plus />
            Yeni plan
          </Link>
        </div>
      </header>

      {error && (
        <div className="notice notice-error mb-6" role="alert">
          <CircleAlert />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Planların yükleniyor…</span>
          <FeaturedTripSkeleton />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <PlanCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : plans.length === 0 && !error ? (
        <EmptyState
          icon={<Compass />}
          title="Henüz bir planın yok"
          description="İlk rotanı oluştur; gün gün programın ve bütçe tahminin burada saklansın."
        >
          <Link href="/ai-planner" className="btn btn-primary">
            AI ile planla
          </Link>
          <Link href="/manual-planner" className="btn btn-outline">
            Kendim planlayacağım
          </Link>
        </EmptyState>
      ) : plans.length > 0 ? (
        <>
          {featured && (
            <div className="rise mb-10" style={{ "--i": 2 } as React.CSSProperties}>
              <FeaturedTrip
                plan={featured}
                busy={busyId === featured.id}
                onStatus={(status) => updateStatus(featured.id, status)}
                onDelete={() => deletePlan(featured.id)}
              />
            </div>
          )}

          <section aria-labelledby="all-plans-title">
            <h2 id="all-plans-title" className="mb-4 font-display text-xl font-bold text-ink">
              Tüm planlar
            </h2>

            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Duruma göre filtrele">
              <button type="button" className="chip" aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
                Tümü
                <span className="tabular text-xs opacity-70">{plans.length}</span>
              </button>
              {FILTER_ORDER.filter((status) => counts.has(status)).map((status) => (
                <button
                  key={status}
                  type="button"
                  className="chip"
                  aria-pressed={filter === status}
                  onClick={() => setFilter(status)}
                >
                  {STATUS_LABEL[status]}
                  <span className="tabular text-xs opacity-70">{counts.get(status)}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 && <p className="mb-5 text-sm text-ink-2">Bu durumda plan bulunmuyor.</p>}

            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((plan, index) => (
                <li key={plan.id} className="rise" style={{ "--i": Math.min(index, 8) } as React.CSSProperties}>
                  <PlanCard
                    plan={plan}
                    busy={busyId === plan.id}
                    onStatus={(status) => updateStatus(plan.id, status)}
                    onDelete={() => deletePlan(plan.id)}
                  />
                </li>
              ))}
              <li className="rise" style={{ "--i": Math.min(visible.length, 8) } as React.CSSProperties}>
                <NewPlanCard />
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function MyPlansPage() {
  return (
    <AuthGate reason="Planlarını görebilmek için hesabına giriş yapmalısın.">
      <MyPlans />
    </AuthGate>
  );
}
