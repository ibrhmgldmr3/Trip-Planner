"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import CityCover from "@/components/CityCover";
import { EmptyState, PageHeader, PageLoader } from "@/components/States";
import { formatDateRange, formatMoney, tripDays } from "@/lib/format";
import {
  BUDGET_CATEGORIES,
  BUDGET_COLOR,
  BUDGET_LABEL,
  parseLegacyBudget,
  sumAmounts,
  sumByCategory,
  type BudgetCategory,
  type BudgetLine,
  type PlanDetail,
  type PlanSummary,
} from "@/lib/plan";

function Budget() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("plan");

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [planLines, setPlanLines] = useState<BudgetLine[]>([]);
  const [expenses, setExpenses] = useState<BudgetLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ category: "TRANSPORT" as BudgetCategory, description: "", amount: "" });

  // Plan listesini getir.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/plans");
        if (!response.ok) throw new Error();
        const data = await response.json();
        const list: PlanSummary[] = data.plans ?? [];
        setPlans(list);
        const initial = list.find((plan) => plan.id === requestedId) ?? list[0];
        if (initial) setSelectedId(initial.id);
      } catch {
        setError("Planların yüklenemedi. Bağlantını kontrol edip tekrar dene.");
      } finally {
        setLoading(false);
      }
    })();
    // İlk seçim yalnızca sayfa açılışında yapılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seçili planın tahmini kalemlerini ve kayıtlı harcamalarını getir.
  const loadPlan = useCallback(async (planId: string) => {
    setLinesLoading(true);
    try {
      const response = await fetch(`/api/plans/${planId}`);
      if (!response.ok) throw new Error();
      const plan: PlanDetail = (await response.json()).plan;
      setPlanLines(plan.estimates.length > 0 ? plan.estimates : parseLegacyBudget(plan.legacy?.budget));
      setExpenses(plan.expenses);
    } catch {
      setPlanLines([]);
      setExpenses([]);
      toast.error("Planın bütçesi yüklenemedi");
    } finally {
      setLinesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadPlan(selectedId);
  }, [selectedId, loadPlan]);

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;

  const addExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Açıklama ve sıfırdan büyük bir tutar gir.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/plans/${selectedId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: draft.category, description: draft.description.trim(), amount }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      setExpenses((prev) => [...prev, data.expense]);
      setDraft({ ...draft, description: "", amount: "" });
    } catch (err) {
      toast.error((err instanceof Error && err.message) || "Harcama eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (item: BudgetLine) => {
    // İyimser güncelleme: sunucu reddederse geri alınır.
    const flip = (paid: boolean) =>
      setExpenses((prev) => prev.map((line) => (line.id === item.id ? { ...line, isPaid: paid } : line)));
    flip(!item.isPaid);
    try {
      const response = await fetch(`/api/plans/${selectedId}/expenses/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !item.isPaid }),
      });
      if (!response.ok) throw new Error();
    } catch {
      flip(item.isPaid);
      toast.error("Ödeme durumu güncellenemedi");
    }
  };

  const removeExpense = async (item: BudgetLine) => {
    try {
      const response = await fetch(`/api/plans/${selectedId}/expenses/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setExpenses((prev) => prev.filter((line) => line.id !== item.id));
    } catch {
      toast.error("Harcama silinemedi");
    }
  };

  const totals = useMemo(() => {
    const estimate = selected?.totalCost || sumAmounts(planLines);
    const spent = sumAmounts(expenses);
    const paid = sumAmounts(expenses.filter((item) => item.isPaid));
    const days = selected ? tripDays(selected.startDate, selected.endDate) : 0;
    return { estimate, spent, paid, remaining: estimate - spent, days };
  }, [planLines, expenses, selected]);

  const planByCategory = useMemo(() => sumByCategory(planLines), [planLines]);
  const spentByCategory = useMemo(() => {
    const map = new Map<BudgetCategory, number>();
    for (const item of expenses) map.set(item.category, (map.get(item.category) ?? 0) + item.amount);
    return map;
  }, [expenses]);

  if (loading) return <PageLoader label="Bütçen hazırlanıyor…" />;

  if (plans.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Bütçe" title="Bütçe takibi" />
        {error ? (
          <div className="notice notice-error" role="alert">
            <CircleAlert />
            <span>{error}</span>
          </div>
        ) : (
          <EmptyState
            icon={<Wallet />}
            title="Önce bir plan gerekli"
            description="Bütçe, bir planın tahmini üzerinden takip edilir. İlk planını oluşturunca burada görünecek."
          >
            <Link href="/travel-mode" className="btn btn-primary">
              Plan oluştur
            </Link>
          </EmptyState>
        )}
      </div>
    );
  }

  const usedShare = totals.estimate > 0 ? Math.min(100, (totals.spent / totals.estimate) * 100) : 0;
  const over = totals.estimate > 0 && totals.spent > totals.estimate;

  return (
    <div>
      <PageHeader
        eyebrow="Bütçe"
        title="Bütçe takibi"
        description="Planın tahminini bütçen olarak al, yaptığın harcamaları ekledikçe ne kadar payın kaldığını gör."
        actions={
          <div className="flex w-full items-end gap-3 sm:w-auto">
            {selected && (
              <CityCover
                key={selected.id}
                city={selected.city}
                country={selected.country}
                eager
                className="h-12 w-12 flex-none rounded-2xl shadow-soft"
              />
            )}
            <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
              <label htmlFor="planSelect" className="field-label">
                Plan
              </label>
              <select
                id="planSelect"
                className="input"
                value={selectedId ?? ""}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  router.replace(`/budget?plan=${event.target.value}`, { scroll: false });
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.city} · {formatDateRange(plan.startDate, plan.endDate)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      {/* Özet kutucukları */}
      <section aria-label="Bütçe özeti" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Tile
          index={0}
          icon={<Wallet />}
          label="Plan tahmini"
          value={formatMoney(totals.estimate || null)}
          hint="Bütçen"
        />
        <Tile
          index={1}
          icon={<Receipt />}
          label="Harcanan"
          value={formatMoney(totals.spent)}
          hint={`${formatMoney(totals.paid)} ödendi`}
        />
        <Tile
          index={2}
          icon={over ? <TrendingUp /> : <PiggyBank />}
          label={over ? "Aşım" : "Kalan"}
          value={totals.estimate > 0 ? formatMoney(Math.abs(totals.remaining)) : "—"}
          tone={totals.estimate > 0 ? (over ? "rose" : "mint") : undefined}
          hint={totals.estimate > 0 ? `%${Math.round((totals.spent / totals.estimate) * 100)} kullanıldı` : undefined}
        />
        <Tile
          index={3}
          icon={<CalendarDays />}
          label="Günlük ortalama"
          value={totals.days > 0 && totals.estimate > 0 ? formatMoney(totals.estimate / totals.days) : "—"}
          hint={totals.days > 0 ? `${totals.days} gün` : undefined}
        />
      </section>

      {/* Kullanım çubuğu: harcanan / tahmin */}
      <section className="card rise mt-4 p-5 md:p-6" style={{ "--i": 4 } as CSSProperties}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-base font-bold text-ink">Bütçe kullanımı</p>
          {totals.estimate > 0 && (
            <p className={`tabular text-sm font-semibold ${over ? "text-rose" : "text-ink-2"}`}>
              {formatMoney(totals.spent)} / {formatMoney(totals.estimate)}
            </p>
          )}
        </div>
        <div
          className="meter !h-3"
          role="progressbar"
          aria-label="Bütçe kullanımı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedShare)}
        >
          <span style={{ width: `${usedShare}%`, ...(over ? { background: "var(--rose)" } : {}) }} />
        </div>
        <p className={`mt-2.5 text-sm ${over ? "font-medium text-rose" : "text-ink-3"}`}>
          {totals.estimate > 0
            ? over
              ? "Harcamaların planın tahminini aştı."
              : `Tahminin %${Math.round(usedShare)} kadarını kullandın.`
            : "Bu planda toplam tahmin bulunmuyor; harcamalarını yine de kaydedebilirsin."}
        </p>
      </section>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Harcamalar */}
        <section className="card @container p-5 sm:p-6 md:p-8">
          <h2 className="font-display text-xl font-extrabold text-ink md:text-2xl">Harcamaların</h2>
          <p className="mt-1 text-sm text-ink-2">
            {selected ? `${selected.city} için kaydettiğin giderler.` : ""}
          </p>

          <form
            onSubmit={addExpense}
            className="mt-6 grid items-end gap-3 rounded-2xl bg-canvas-2 p-4 @md:grid-cols-2 @2xl:grid-cols-[10rem_minmax(0,1fr)_8rem_auto]"
          >
            <div>
              <label htmlFor="expCategory" className="field-label">
                Kategori
              </label>
              <select
                id="expCategory"
                className="input"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value as BudgetCategory })}
              >
                {BUDGET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {BUDGET_LABEL[category]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expDescription" className="field-label">
                Açıklama
              </label>
              <input
                id="expDescription"
                className="input"
                placeholder="Örn. Müze bileti"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="expAmount" className="field-label">
                Tutar (₺)
              </label>
              <input
                id="expAmount"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="input tabular"
                placeholder="0"
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <Plus />}
              Ekle
            </button>
          </form>

          {expenses.length === 0 ? (
            <div className="mt-6 rounded-[1.25rem] border border-dashed border-line-2 px-5 py-10 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand [&_svg]:h-5 [&_svg]:w-5">
                <Receipt />
              </span>
              <p className="mt-3 font-display font-bold text-ink">Henüz harcama eklemedin</p>
              <p className="mt-1 text-sm text-ink-2">Yukarıdaki formdan ilk giderini ekleyebilirsin.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {expenses.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.isPaid}
                    aria-label={`${item.description}: ${item.isPaid ? "ödendi" : "ödenmedi"}`}
                    title={item.isPaid ? "Ödendi" : "Ödendi olarak işaretle"}
                    onClick={() => togglePaid(item)}
                    data-done={item.isPaid}
                    className="check !h-6 !w-6 transition-colors hover:border-mint"
                  >
                    <Check strokeWidth={3} />
                  </button>
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: BUDGET_COLOR[item.category] }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${item.isPaid ? "text-ink-3 line-through" : "text-ink"}`}>
                      {item.description}
                    </p>
                    <p className="text-xs text-ink-3">{BUDGET_LABEL[item.category]}</p>
                  </div>
                  <span className="tabular flex-none text-sm font-bold text-ink">{formatMoney(item.amount)}</span>
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon !h-8 !w-8 flex-none hover:!text-rose"
                    onClick={() => removeExpense(item)}
                    aria-label={`${item.description} kalemini sil`}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Plandaki tahmin */}
        <aside className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold text-ink">Plandaki tahmin</h2>
          <p className="mt-1 text-sm text-ink-2">Kategori bazında harcanan / tahmin.</p>
          {linesLoading ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-ink-2">
              <span className="spinner" />
              Yükleniyor…
            </p>
          ) : planByCategory.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-canvas-2 px-4 py-5 text-sm leading-relaxed text-ink-2">
              Bu planda kategori dökümü bulunmuyor.
            </p>
          ) : (
            <ul className="mt-5 space-y-5">
              {planByCategory.map(({ category, total }) => {
                const spent = spentByCategory.get(category) ?? 0;
                const share = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
                const exceeded = spent > total;
                return (
                  <li key={category}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                        <span
                          className="h-2.5 w-2.5 flex-none rounded-full"
                          style={{ background: BUDGET_COLOR[category] }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{BUDGET_LABEL[category]}</span>
                      </span>
                      <span className={`tabular flex-none text-xs ${exceeded ? "font-semibold text-rose" : "text-ink-2"}`}>
                        {formatMoney(spent)} / {formatMoney(total)}
                      </span>
                    </div>
                    <div className="meter">
                      <span
                        style={{ width: `${share}%`, background: exceeded ? "var(--rose)" : BUDGET_COLOR[category] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {selected && (
            <Link href={`/plan-detail/${selected.id}`} className="btn btn-outline btn-sm mt-6 w-full">
              Planı aç
              <ArrowRight />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

interface TileProps {
  index: number;
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "rose" | "mint";
}

function Tile({ index, icon, label, value, hint, tone }: TileProps) {
  const toneClass = tone === "rose" ? "text-rose" : tone === "mint" ? "text-mint" : "text-ink";
  const iconClass =
    tone === "rose" ? "bg-rose-soft text-rose" : tone === "mint" ? "bg-mint-soft text-mint" : "bg-brand-soft text-brand";
  return (
    <div className="card rise min-w-0 p-4 sm:p-5" style={{ "--i": index } as CSSProperties}>
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 flex-none place-items-center rounded-full [&_svg]:h-4 [&_svg]:w-4 ${iconClass}`}>
          {icon}
        </span>
        <p className="truncate text-sm font-medium text-ink-2">{label}</p>
      </div>
      <p className={`tabular mt-3 truncate font-display text-xl font-extrabold sm:text-2xl ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export default function BudgetPage() {
  return (
    <AuthGate reason="Bütçeni takip edebilmek için hesabına giriş yapmalısın.">
      <Suspense fallback={<PageLoader />}>
        <Budget />
      </Suspense>
    </AuthGate>
  );
}
