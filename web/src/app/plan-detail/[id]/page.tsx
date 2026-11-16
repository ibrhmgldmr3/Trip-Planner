"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  BedDouble,
  CalendarDays,
  CalendarPlus,
  Coins,
  FileText,
  Landmark,
  MapPinned,
  MoonStar,
  Plane,
  Signpost,
  Sun,
  Sunrise,
  Target,
  Utensils,
  Wallet,
  Compass,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import Markdown from "@/components/Markdown";
import PlanHero from "@/components/plan/PlanHero";
import { EmptyState, Page, PageLoader } from "@/components/States";
import { addDays, formatDate, formatDateRange, formatDayLong, formatMoney, tripDays } from "@/lib/format";
import {
  BUDGET_COLOR,
  BUDGET_LABEL,
  effectiveStatus,
  parseLegacyBudget,
  SLOT_LABEL,
  splitMarkdownDays,
  stripLeadingHeading,
  styleLabel,
  sumAmounts,
  sumByCategory,
  type DaySlot,
  type PlanDay,
  type PlanDetail,
  type PlanStop,
  type StoredStatus,
} from "@/lib/plan";

// Leaflet tarayıcıya ihtiyaç duyar; harita yalnızca istemcide yüklenir.
const PlanMap = dynamic(() => import("@/components/PlanMap"), {
  ssr: false,
  loading: () => <div className="plan-map grid place-items-center text-sm text-ink-3">Harita yükleniyor…</div>,
});

type TabId = "overview" | "days" | "food" | "practical" | "budget" | "full";

const SLOT_ICON: Record<DaySlot, React.ReactNode> = {
  MORNING: <Sunrise />,
  NOON: <Sun />,
  EVENING: <MoonStar />,
};

/** Haritadaki iğnelerle aynı kural: iki koordinatı da olan durak haritada görünür. */
const isLocated = (stop: PlanStop) => stop.latitude !== null && stop.longitude !== null;

/** Sekme değiştikten sonra (panel görünür olunca) bir öğeye kaydırır. */
function scrollToId(id: string) {
  requestAnimationFrame(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}

function PlanDetailView() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [mapDay, setMapDay] = useState<number | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const response = await fetch(`/api/plans/${planId}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPlan(data.plan);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (planId) fetchPlan();
  }, [planId, fetchPlan]);

  const view = useMemo(() => {
    if (!plan) return null;
    const structured = plan.days.length > 0;
    // Yapılandırılmış veriden önce üretilmiş planlarda kalemler metinden çıkarılır.
    const estimates = plan.estimates.length > 0 ? plan.estimates : parseLegacyBudget(plan.legacy?.budget);
    const locatedStops = plan.days.reduce((sum, day) => sum + day.stops.filter(isLocated).length, 0);
    return {
      manual: plan.source === "MANUAL",
      status: effectiveStatus(plan),
      dayCount: tripDays(plan.startDate, plan.endDate) || plan.days.length,
      structured,
      legacyDays: structured ? [] : splitMarkdownDays(plan.legacy?.dayPlan),
      estimates,
      byCategory: sumByCategory(estimates),
      total: plan.totalCost ?? (estimates.length ? sumAmounts(estimates) : null),
      hasMap: locatedStops > 0,
      locatedStops,
    };
  }, [plan]);

  const updateStatus = async (status: StoredStatus) => {
    if (status === "CANCELLED" && !confirm("Bu planı iptal etmek istediğine emin misin?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      toast.success(
        status === "DONE" ? "Gezi defterine eklendi" : status === "CANCELLED" ? "Plan iptal edildi" : "Plan geri alındı"
      );
      await fetchPlan();
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Plan durumu güncellenemedi");
    } finally {
      setBusy(false);
    }
  };

  const deletePlan = async () => {
    if (!confirm("Bu planı kalıcı olarak silmek istediğine emin misin?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Plan silindi");
      router.push("/my-plans");
    } catch {
      toast.error("Plan silinemedi");
      setBusy(false);
    }
  };

  if (loading) return <PageLoader label="Plan açılıyor…" />;

  if (failed || !plan || !view) {
    return (
      <Page>
        <EmptyState
          icon={<MapPinned />}
          title="Plan bulunamadı"
          description="Bu plan silinmiş olabilir ya da sana ait değil."
        >
          <Link href="/my-plans" className="btn btn-primary">
            Planlarıma dön
          </Link>
        </EmptyState>
      </Page>
    );
  }

  const hasDays = view.structured || view.legacyDays.length > 0;
  const hasBudget = view.estimates.length > 0 || view.total !== null || !!plan.legacy?.budget;
  const dailyAverage = view.total && view.dayCount > 0 ? view.total / view.dayCount : null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; show: boolean }> = [
    { id: "overview", label: "Genel bakış", icon: <Landmark />, show: true },
    { id: "days", label: view.hasMap ? "Günlük plan ve harita" : "Günlük plan", icon: <CalendarDays />, show: hasDays },
    { id: "food", label: "Yeme-içme", icon: <Utensils />, show: !!plan.foodGuide },
    { id: "practical", label: "Pratik bilgiler", icon: <Signpost />, show: !!plan.practicalInfo },
    { id: "budget", label: "Bütçe", icon: <Wallet />, show: hasBudget },
    { id: "full", label: "Tam metin", icon: <FileText />, show: !view.structured && !!plan.legacy?.raw },
  ];

  // Kapaktaki gün kartı: sekmeyi açar, günü haritada seçer ve o güne kaydırır.
  const openDay = (dayNumber: number) => {
    const day = plan.days.find((item) => item.dayNumber === dayNumber);
    setTab("days");
    setMapDay(day?.stops.some(isLocated) ? dayNumber : null);
    scrollToId(`day-${dayNumber}`);
  };

  const openMap = () => {
    setTab("days");
    scrollToId("panel-days");
  };

  const overBudget = plan.targetBudget !== null && view.total !== null && view.total > plan.targetBudget;
  const budgetRatio =
    plan.targetBudget && view.total !== null ? Math.min(100, Math.round((view.total / plan.targetBudget) * 100)) : null;

  return (
    <Page>
      <PlanHero
        plan={plan}
        status={view.status}
        manual={view.manual}
        dayCount={view.dayCount}
        total={view.total}
        locatedStops={view.locatedStops}
        busy={busy}
        onMarkDone={() => updateStatus("DONE")}
        onCancel={() => updateStatus("CANCELLED")}
        onRestore={() => updateStatus("PLANNED")}
        onDelete={deletePlan}
        onSelectDay={openDay}
        onOpenMap={openMap}
      />

      {/* Öne çıkan sayılar */}
      <dl className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-4 md:gap-4">
        <StatTile icon={<Coins />} label="Tahmini toplam" value={formatMoney(view.total)} strong index={1} />
        <StatTile icon={<CalendarDays />} label="Günlük ortalama" value={formatMoney(dailyAverage)} index={2} />
        <StatTile icon={<Compass />} label="Tarz" value={styleLabel(plan.travelStyle) ?? "—"} index={3} />
        {plan.targetBudget ? (
          <StatTile icon={<Target />} label="Hedef bütçe" value={formatMoney(plan.targetBudget)} index={4} />
        ) : (
          <StatTile icon={<CalendarPlus />} label="Oluşturma" value={formatDate(plan.createdAt)} index={4} />
        )}
      </dl>

      {/* Sekmeler */}
      <div
        className="no-print sticky top-16 z-30 -mx-5 mt-8 overflow-x-auto overflow-y-hidden bg-canvas/85 px-5 py-3 backdrop-blur-md [scrollbar-width:none] md:-mx-8 md:px-8"
        role="tablist"
        aria-label="Plan bölümleri"
      >
        <div className="flex w-max gap-1 rounded-full border border-line bg-surface p-1 shadow-soft">
          {tabs
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`flex h-10 flex-none items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4 ${
                  tab === item.id
                    ? "bg-brand text-on-brand shadow-soft"
                    : "text-ink-2 hover:bg-brand-soft hover:text-brand"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
        </div>
      </div>

      <div className="mt-6 md:mt-8">
        {/* Genel bakış */}
        <Panel id="overview" active={tab} title="Genel bakış">
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]">
            <article className="card p-6 md:p-9">
              <h2 className="font-display text-2xl font-extrabold text-ink md:text-[1.7rem]">
                {plan.cityGuide ? "Şehir rehberi" : "Plan özeti"}
              </h2>
              <div className="mt-5 space-y-6">
                {plan.cityGuide && <Markdown>{stripLeadingHeading(plan.cityGuide)}</Markdown>}
                {(plan.transport || plan.accommodation) && <Bookings plan={plan} />}
                {!plan.cityGuide && !plan.transport && !plan.accommodation && (
                  <p className="text-sm leading-relaxed text-ink-2">
                    {view.dayCount > 0 ? `${view.dayCount} günlük` : "Esnek tarihli"} {plan.city} planı. Ayrıntılar
                    için günlük plan ve bütçe sekmelerine bak.
                  </p>
                )}
              </div>
            </article>

            <aside className="card p-6 md:p-7">
              <h2 className="font-display text-lg font-bold text-ink">Plan bilgileri</h2>
              <dl className="mt-4 divide-y divide-line text-sm">
                <InfoRow label="Tarih" value={formatDateRange(plan.startDate, plan.endDate)} />
                <InfoRow label="Süre" value={view.dayCount > 0 ? `${view.dayCount} gün` : "—"} />
                <InfoRow label="Yolcu" value={`${plan.travelers} kişi`} />
                {plan.budgetLevel && <InfoRow label="Bütçe düzeyi" value={plan.budgetLevel} />}
                {plan.stayPreference && <InfoRow label="Konaklama" value={plan.stayPreference} />}
                {plan.transportPrefs.length > 0 && <InfoRow label="Ulaşım" value={plan.transportPrefs.join(", ")} />}
                <InfoRow label="Oluşturma" value={formatDate(plan.createdAt)} />
                <InfoRow label="Yöntem" value={view.manual ? "Adım adım (manuel)" : "Yapay zekâ"} />
              </dl>
              {plan.interests.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {plan.interests.map((interest) => (
                    <li key={interest} className="tag tag-brand">
                      {interest}
                    </li>
                  ))}
                </ul>
              )}
              {plan.specialRequests && (
                <p className="mt-5 rounded-2xl bg-canvas-2 px-4 py-3 text-sm leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Özel istek:</span> {plan.specialRequests}
                </p>
              )}
            </aside>
          </div>
        </Panel>

        {/* Günlük plan */}
        {hasDays && (
          <Panel id="days" active={tab} title="Günlük plan">
            <div className={view.hasMap ? "grid items-start gap-6 lg:grid-cols-[1fr_26rem]" : ""}>
              {view.hasMap && (
                <aside className="no-print lg:sticky lg:top-36 lg:order-2">
                  <div className="h-72 overflow-hidden rounded-[1.25rem] shadow-soft lg:h-[calc(100vh-13rem)] lg:max-h-[40rem]">
                    {/* Harita yalnızca sekmesi açıkken kurulur: gizli kapsayıcıda boyut ölçülemez. */}
                    {tab === "days" && (
                      <PlanMap
                        center={
                          plan.latitude !== null && plan.longitude !== null
                            ? { latitude: plan.latitude, longitude: plan.longitude }
                            : null
                        }
                        days={plan.days}
                        activeDay={mapDay}
                      />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Haritada gösterilen gün">
                    <button
                      type="button"
                      className="chip !h-8 !px-3 !text-xs"
                      aria-pressed={mapDay === null}
                      onClick={() => setMapDay(null)}
                    >
                      Tüm günler
                    </button>
                    {plan.days.map((day, index) => (
                      <button
                        key={day.id}
                        type="button"
                        className="chip !h-8 !gap-1.5 !px-3 !text-xs"
                        aria-pressed={mapDay === day.dayNumber}
                        onClick={() => setMapDay(day.dayNumber)}
                      >
                        <span className="day-dot h-2 w-2 rounded-full" data-color={index % 5} />
                        {day.dayNumber}. gün
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-3">
                    Çizgiler durakların ziyaret sırasını gösterir, yol tarifi değildir.
                    {!view.manual && " Konumlar yapay zekâ tahminidir; yola çıkmadan önce doğrula."}
                  </p>
                </aside>
              )}

              <ol className="space-y-5">
                {view.structured
                  ? plan.days.map((day, index) => (
                      <DayCard
                        key={day.id}
                        anchor={`day-${day.dayNumber}`}
                        order={index}
                        number={day.dayNumber}
                        colorIndex={index % 5}
                        title={day.title || `${day.dayNumber}. gün`}
                        date={plan.startDate ? addDays(plan.startDate, day.dayNumber - 1) : null}
                        onShowOnMap={
                          view.hasMap && day.stops.some(isLocated) ? () => setMapDay(day.dayNumber) : undefined
                        }
                      >
                        <DayStops day={day} colorIndex={index % 5} />
                      </DayCard>
                    ))
                  : view.legacyDays.map((section, index) => (
                      <DayCard
                        key={index}
                        order={index}
                        number={section.day}
                        colorIndex={0}
                        title={section.title || (section.day ? `${section.day}. gün` : "Program")}
                        date={section.day && plan.startDate ? addDays(plan.startDate, section.day - 1) : null}
                      >
                        <Markdown>{section.body}</Markdown>
                      </DayCard>
                    ))}
              </ol>
            </div>
          </Panel>
        )}

        {/* Yeme-içme */}
        {plan.foodGuide && (
          <Panel id="food" active={tab} title="Yeme-içme">
            <article className="card p-6 md:p-9">
              <h2 className="mb-5 font-display text-2xl font-extrabold text-ink print:hidden md:text-[1.7rem]">
                Yeme-içme rehberi
              </h2>
              <Markdown>{stripLeadingHeading(plan.foodGuide)}</Markdown>
            </article>
          </Panel>
        )}

        {/* Pratik bilgiler */}
        {plan.practicalInfo && (
          <Panel id="practical" active={tab} title="Pratik bilgiler">
            <article className="card p-6 md:p-9">
              <h2 className="mb-5 font-display text-2xl font-extrabold text-ink print:hidden md:text-[1.7rem]">
                Pratik bilgiler
              </h2>
              <Markdown>{stripLeadingHeading(plan.practicalInfo)}</Markdown>
            </article>
          </Panel>
        )}

        {/* Bütçe */}
        {hasBudget && (
          <Panel id="budget" active={tab} title="Bütçe">
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]">
              <article className="card p-6 md:p-9">
                <h2 className="font-display text-2xl font-extrabold text-ink md:text-[1.7rem]">Bütçe dökümü</h2>

                {view.byCategory.length > 0 ? (
                  <>
                    <div className="mt-6 flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden>
                      {view.byCategory.map(({ category, total }) => (
                        <span
                          key={category}
                          className="rounded-full"
                          style={{ flexGrow: total, background: BUDGET_COLOR[category] }}
                        />
                      ))}
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
                      {view.byCategory.map(({ category, total }) => (
                        <li key={category} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: BUDGET_COLOR[category] }} />
                          {BUDGET_LABEL[category]}
                          <span className="tabular font-semibold text-ink">{formatMoney(total)}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-6 divide-y divide-line">
                      {view.estimates.map((line) => (
                        <li key={line.id} className="flex items-center justify-between gap-4 py-3.5">
                          <span className="flex min-w-0 items-center gap-3 text-sm">
                            <span
                              className="h-2.5 w-2.5 flex-none rounded-full"
                              style={{ background: BUDGET_COLOR[line.category] }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-ink">{line.description}</span>
                              <span className="text-xs text-ink-3">{BUDGET_LABEL[line.category]}</span>
                            </span>
                          </span>
                          <span className="tabular flex-none text-sm font-semibold text-ink">
                            {formatMoney(line.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-ink-2">Bu plan için kalem kalem bir döküm bulunmuyor.</p>
                )}

                {!view.structured && plan.legacy?.budget && (
                  <>
                    <hr className="dash-rule my-7" />
                    <h3 className="mb-3 font-display text-base font-bold text-ink">Planın bütçe notları</h3>
                    <Markdown>{stripLeadingHeading(plan.legacy.budget)}</Markdown>
                  </>
                )}
              </article>

              <aside className="card p-6 md:p-7">
                <p className="eyebrow">Özet</p>
                <p className="tabular mt-3 font-display text-4xl font-extrabold text-ink">{formatMoney(view.total)}</p>
                <p className="text-sm text-ink-2">tahmini toplam</p>

                {budgetRatio !== null && plan.targetBudget !== null && (
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="text-ink-3">Hedef bütçeye göre</span>
                      <span className={`tabular font-semibold ${overBudget ? "text-rose" : "text-ink"}`}>
                        %{Math.round(((view.total ?? 0) / plan.targetBudget) * 100)}
                      </span>
                    </div>
                    <div
                      className="meter"
                      role="progressbar"
                      aria-label="Tahmini toplamın hedef bütçeye oranı"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={budgetRatio}
                    >
                      <span
                        style={{ width: `${budgetRatio}%`, ...(overBudget ? { background: "var(--rose)" } : {}) }}
                      />
                    </div>
                  </div>
                )}

                <dl className="mt-5 divide-y divide-line text-sm">
                  <InfoRow label="Günlük ortalama" value={formatMoney(dailyAverage)} />
                  {plan.travelers > 1 && view.total !== null && (
                    <InfoRow label="Kişi başı" value={formatMoney(view.total / plan.travelers)} />
                  )}
                  {plan.targetBudget !== null && <InfoRow label="Hedef bütçe" value={formatMoney(plan.targetBudget)} />}
                </dl>
                {plan.targetBudget !== null && view.total !== null && (
                  <p className={`notice mt-5 ${overBudget ? "notice-error" : "notice-success"}`} role="status">
                    <Wallet />
                    <span>
                      {overBudget
                        ? `Tahmin, hedefini ${formatMoney(view.total - plan.targetBudget)} aşıyor.`
                        : `Hedefinin ${formatMoney(plan.targetBudget - view.total)} altında.`}
                    </span>
                  </p>
                )}
                <Link href={`/budget?plan=${plan.id}`} className="btn btn-primary no-print mt-6 w-full">
                  <Wallet />
                  Harcamaları takip et
                </Link>
                {!view.manual && (
                  <p className="mt-4 text-xs leading-relaxed text-ink-3">
                    Tutarlar yapay zekânın tahminidir; güncel fiyatlar farklı olabilir.
                  </p>
                )}
              </aside>
            </div>
          </Panel>
        )}

        {/* Tam metin (yalnızca eski planlar) */}
        {!view.structured && plan.legacy?.raw && (
          <Panel id="full" active={tab} title="Tam metin" screenOnly>
            <article className="card p-6 md:p-10">
              <Markdown>{plan.legacy.raw}</Markdown>
            </article>
          </Panel>
        )}
      </div>
    </Page>
  );
}

/* --------------------------- Alt bileşenler -------------------------- */

interface PanelProps {
  id: TabId;
  active: TabId;
  title: string;
  /** Yazdırmada tekrar etmemesi için yalnızca ekranda gösterilen bölüm. */
  screenOnly?: boolean;
  children: React.ReactNode;
}

/** Ekranda yalnızca etkin sekme görünür; yazdırırken tüm bölümler alt alta basılır. */
function Panel({ id, active, title, screenOnly = false, children }: PanelProps) {
  const visibility = active === id ? "block" : "hidden";
  const print = screenOnly ? "print:hidden" : "print:block";
  return (
    <section
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={`${visibility} ${print} scroll-mt-36 print:mt-8`}
    >
      <h2 className="mb-4 hidden font-display text-2xl font-extrabold print:block">{title}</h2>
      {children}
    </section>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
  index: number;
}

function StatTile({ icon, label, value, strong = false, index }: StatTileProps) {
  return (
    <div className="card rise flex items-center gap-3.5 p-4 md:p-5" style={{ "--i": index } as React.CSSProperties}>
      <span
        className={`grid h-10 w-10 flex-none place-items-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${
          strong ? "bg-brand text-on-brand" : "bg-brand-soft text-brand"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-ink-3">{label}</dt>
        <dd className="tabular truncate font-display text-lg font-extrabold text-ink md:text-xl">{value}</dd>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="flex-none text-ink-3">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

interface DayCardProps {
  /** Kapaktaki gün kartlarının kaydırma hedefi. */
  anchor?: string;
  order: number;
  number: number | null;
  colorIndex: number;
  title: string;
  date: Date | null;
  onShowOnMap?: () => void;
  children: React.ReactNode;
}

function DayCard({ anchor, order, number, colorIndex, title, date, onShowOnMap, children }: DayCardProps) {
  return (
    <li
      id={anchor}
      className="card rise scroll-mt-36 p-5 md:p-7"
      style={{ "--i": Math.min(order, 8) } as React.CSSProperties}
    >
      <header className="mb-5 flex items-start gap-3.5">
        <span
          className="day-dot tabular grid h-10 w-10 flex-none place-items-center rounded-full text-sm font-extrabold shadow-soft"
          data-color={colorIndex}
          aria-hidden={!number}
        >
          {number ?? <CalendarDays className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-extrabold leading-tight text-ink">{title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {date && <p className="text-sm text-ink-3">{formatDayLong(date)}</p>}
            {onShowOnMap && (
              <button
                type="button"
                onClick={onShowOnMap}
                className="no-print inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <MapPinned className="h-3.5 w-3.5" />
                Haritada göster
              </button>
            )}
          </div>
        </div>
      </header>
      {children}
    </li>
  );
}

/** Bir günün durakları: zaman dilimi varsa sabah/öğle/akşam olarak gruplanır. */
function DayStops({ day, colorIndex }: { day: PlanDay; colorIndex: number }) {
  if (day.isFree) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-canvas-2 px-4 py-3 text-sm text-ink-2">
        <MoonStar className="h-4 w-4 text-ink-3" />
        Serbest gün
      </p>
    );
  }
  if (day.stops.length === 0 && !day.notes) {
    return <p className="text-sm text-ink-3">Bu gün için aktivite eklenmemiş.</p>;
  }

  // Haritadaki iğne numarası: konumu olan duraklar arasındaki sıra.
  let pin = 0;
  const numbered = day.stops.map((stop) => ({ stop, pin: isLocated(stop) ? ++pin : null }));

  return (
    <>
      <ul className="space-y-1">
        {numbered.map(({ stop, pin: pinNumber }, index) => {
          const previous = numbered[index - 1]?.stop;
          const showSlot = stop.slot && stop.slot !== previous?.slot;
          return (
            <li key={stop.id}>
              {showSlot && stop.slot && (
                <p
                  className={`mb-2 flex items-center gap-2 text-sm font-bold text-brand [&_svg]:h-4 [&_svg]:w-4 ${
                    index > 0 ? "mt-5" : ""
                  }`}
                >
                  {SLOT_ICON[stop.slot]}
                  {SLOT_LABEL[stop.slot]}
                </p>
              )}
              <StopRow stop={stop} pin={pinNumber} colorIndex={colorIndex} last={index === numbered.length - 1} />
            </li>
          );
        })}
      </ul>
      {day.notes && (
        <p className="mt-5 rounded-2xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-ink">{day.notes}</p>
      )}
    </>
  );
}

function StopRow({
  stop,
  pin,
  colorIndex,
  last,
}: {
  stop: PlanStop;
  pin: number | null;
  colorIndex: number;
  last: boolean;
}) {
  const time = [stop.startTime, stop.endTime].filter(Boolean).join("–");
  return (
    <div className="relative flex gap-3.5 pb-4">
      {/* Duraklar arasında ince dikey çizgi */}
      {!last && <span className="absolute bottom-0 left-[0.8125rem] top-8 w-px bg-line" aria-hidden />}
      {pin !== null ? (
        <span
          className="day-dot tabular relative grid h-[1.625rem] w-[1.625rem] flex-none place-items-center rounded-full text-[0.7rem] font-bold"
          data-color={colorIndex}
          title="Haritadaki numarası"
        >
          {pin}
        </span>
      ) : (
        <span className="relative grid h-[1.625rem] w-[1.625rem] flex-none place-items-center" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full border-2 border-line-2 bg-surface" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {time && <p className="tabular text-xs font-semibold text-ink-3">{time}</p>}
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-semibold leading-snug text-ink">{stop.name}</p>
          {stop.cost !== null && stop.cost > 0 && (
            <span className="tag tag-amber tabular flex-none">{formatMoney(stop.cost)}</span>
          )}
        </div>
        {stop.description && <p className="mt-1 text-sm leading-relaxed text-ink-2">{stop.description}</p>}
        {stop.category && <span className="tag mt-2">{stop.category}</span>}
      </div>
    </div>
  );
}

/** Manuel planlarda seçilen ulaşım ve konaklama. */
function Bookings({ plan }: { plan: PlanDetail }) {
  const { transport, accommodation: stay } = plan;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-canvas-2/60 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand">
            <Plane className="h-4 w-4" />
          </span>
          Ulaşım
        </p>
        {transport ? (
          <>
            <p className="mt-3 font-display text-xl font-extrabold text-ink">{transport.type}</p>
            <p className="text-sm text-ink-2">
              {[transport.provider, transport.duration].filter(Boolean).join(" · ") || "Ayrıntı girilmedi"}
            </p>
            {(transport.departure || transport.arrival) && (
              <p className="tabular mt-2 text-xs text-ink-3">
                {transport.departure || "—"} → {transport.arrival || "—"}
              </p>
            )}
            {!!transport.price && (
              <p className="tabular mt-3 text-sm font-bold text-ink">{formatMoney(transport.price)}</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-3">Eklenmedi</p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-canvas-2/60 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand">
            <BedDouble className="h-4 w-4" />
          </span>
          Konaklama
        </p>
        {stay ? (
          <>
            <p className="mt-3 font-display text-xl font-extrabold text-ink">{stay.name || stay.type}</p>
            <p className="text-sm text-ink-2">
              {[stay.type, stay.location].filter(Boolean).join(" · ") || "Ayrıntı girilmedi"}
            </p>
            {!!stay.price && (
              <p className="tabular mt-3 text-sm font-bold text-ink">
                {formatMoney(stay.price)} <span className="font-normal text-ink-3">/ gece</span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-3">Eklenmedi</p>
        )}
      </div>
    </div>
  );
}

export default function PlanDetailPage() {
  return (
    <AuthGate reason="Planı görebilmek için hesabına giriş yapmalısın.">
      <PlanDetailView />
    </AuthGate>
  );
}
