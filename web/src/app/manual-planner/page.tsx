"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  Bus,
  CalendarDays,
  Car,
  Check,
  Clock,
  Hotel,
  MapPin,
  Minus,
  MoonStar,
  Plane,
  Plus,
  Save,
  TentTree,
  TrainFront,
  Trash2,
  Wallet,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import ChipGroup, { type ChipOption } from "@/components/ChipGroup";
import DestinationPreview from "@/components/planner/DestinationPreview";
import { Page, PageHeader } from "@/components/States";
import {
  addDays,
  formatDateRange,
  formatDayLong,
  formatMoney,
  todayISO,
  tripDays,
  tripNights,
} from "@/lib/format";
import { BUDGET_COLOR, BUDGET_LABEL, manualBudget, styleLabel, type BudgetCategory } from "@/lib/plan";

/* ------------------------------ Tipler ------------------------------ */

interface BasicInfo {
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelStyle: string;
}

interface TransportDraft {
  type: string;
  provider: string;
  price: string;
  departure: string;
  arrival: string;
}

interface StayDraft {
  type: string;
  name: string;
  price: string;
  location: string;
}

interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  cost: number;
  description: string;
}

interface DayPlan {
  day: number;
  activities: Activity[];
  notes: string;
  isEmpty: boolean;
}

const STEPS = [
  { id: 1, title: "Temel bilgiler", icon: <MapPin /> },
  { id: 2, title: "Ulaşım", icon: <Plane /> },
  { id: 3, title: "Konaklama", icon: <BedDouble /> },
  { id: 4, title: "Günlük plan", icon: <CalendarDays /> },
  { id: 5, title: "Bütçe", icon: <Wallet /> },
  { id: 6, title: "Özet", icon: <Check /> },
];

const STYLE_OPTIONS: ChipOption[] = [
  { value: "standard", label: "Standart" },
  { value: "budget", label: "Ekonomik" },
  { value: "luxury", label: "Lüks" },
  { value: "adventure", label: "Macera" },
  { value: "cultural", label: "Kültürel" },
];

const TRANSPORT_TYPES = [
  { value: "Uçak", icon: <Plane /> },
  { value: "Otobüs", icon: <Bus /> },
  { value: "Tren", icon: <TrainFront /> },
  { value: "Kendi aracım", icon: <Car /> },
];

const STAY_TYPES = [
  { value: "Otel", icon: <Hotel /> },
  { value: "Butik otel", icon: <Building2 /> },
  { value: "Hostel", icon: <BedDouble /> },
  { value: "Apart / ev", icon: <Building2 /> },
  { value: "Kamp", icon: <TentTree /> },
];

const toAmount = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/* ------------------------------ Sayfa ------------------------------- */

function ManualPlanner() {
  const router = useRouter();
  const today = todayISO();

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [basic, setBasic] = useState<BasicInfo>({
    destination: "",
    country: "",
    startDate: "",
    endDate: "",
    travelers: 1,
    travelStyle: "standard",
  });
  const [transport, setTransport] = useState<TransportDraft>({
    type: "",
    provider: "",
    price: "",
    departure: "",
    arrival: "",
  });
  const [stay, setStay] = useState<StayDraft>({ type: "", name: "", price: "", location: "" });
  const [days, setDays] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [foodPerDay, setFoodPerDay] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [targetBudget, setTargetBudget] = useState("");

  const dayCount = tripDays(basic.startDate, basic.endDate);
  const nights = tripNights(basic.startDate, basic.endDate);

  // Tarihler değişince gün listesini yeniden boyutlandır; yazılanlar korunur.
  useEffect(() => {
    setDays((prev) => {
      if (prev.length === dayCount) return prev;
      return Array.from({ length: dayCount }, (_, index) =>
        prev[index] ?? { day: index + 1, activities: [], notes: "", isEmpty: false }
      );
    });
    setActiveDay((current) => Math.min(current, Math.max(0, dayCount - 1)));
  }, [dayCount]);

  // Sunucunun kaydederken kullandığı hesabın aynısı (bkz. manualBudget).
  const { breakdown, total } = useMemo(() => {
    const { lines, total } = manualBudget({
      startDate: basic.startDate,
      endDate: basic.endDate,
      transport: transport.type ? { price: toAmount(transport.price) } : null,
      accommodation: stay.type ? { price: toAmount(stay.price) } : null,
      days: days.map((day) => ({ isFree: day.isEmpty, stops: day.activities })),
      foodPerDay: toAmount(foodPerDay),
      otherCost: toAmount(otherCost),
    });
    const amount = (category: string) => lines.find((line) => line.category === category)?.amount ?? 0;
    return {
      breakdown: {
        transport: amount("TRANSPORT"),
        accommodation: amount("ACCOMMODATION"),
        activities: amount("ACTIVITIES"),
        food: amount("FOOD"),
        other: amount("OTHER"),
      },
      total,
    };
  }, [basic.startDate, basic.endDate, days, transport, stay, foodPerDay, otherCost]);

  const target = toAmount(targetBudget);

  const validateBasics = (): string | null => {
    if (!basic.destination.trim()) return "Lütfen gidilecek şehri yaz.";
    if (!basic.startDate || !basic.endDate) return "Lütfen gidiş ve dönüş tarihlerini seç.";
    if (basic.startDate < today) return "Gidiş tarihi bugünden önce olamaz.";
    if (basic.startDate > basic.endDate) return "Dönüş tarihi gidişten önce olamaz.";
    return null;
  };

  const goTo = (next: number) => {
    if (next > 1) {
      const problem = validateBasics();
      if (problem) {
        toast.error(problem);
        setStep(1);
        return;
      }
    }
    setStep(next);
    setMaxStep((current) => Math.max(current, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateDay = (index: number, patch: Partial<DayPlan>) =>
    setDays((prev) => prev.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  const savePlan = async () => {
    const problem = validateBasics();
    if (problem) {
      toast.error(problem);
      setStep(1);
      return;
    }

    setSaving(true);
    // Tutarlar sunucuda bu kalemlerden yeniden hesaplanır.
    const payload = {
      city: basic.destination.trim(),
      country: basic.country.trim(),
      startDate: basic.startDate,
      endDate: basic.endDate,
      travelers: basic.travelers,
      travelStyle: basic.travelStyle,
      transport: transport.type
        ? {
            type: transport.type,
            provider: transport.provider.trim(),
            price: toAmount(transport.price),
            departure: transport.departure,
            arrival: transport.arrival,
          }
        : null,
      accommodation: stay.type
        ? {
            type: stay.type,
            name: stay.name.trim(),
            location: stay.location.trim(),
            price: toAmount(stay.price),
          }
        : null,
      days: days.map((day) => ({
        notes: day.notes,
        isFree: day.isEmpty,
        stops: day.activities.map((activity) => ({
          name: activity.name,
          description: activity.description,
          startTime: activity.startTime,
          endTime: activity.endTime,
          cost: activity.cost,
        })),
      })),
      foodPerDay: toAmount(foodPerDay),
      otherCost: toAmount(otherCost),
      targetBudget: target > 0 ? target : undefined,
    };

    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Plan kaydedilirken bir hata oluştu");

      toast.success("Planın kaydedildi!");
      router.push(data.id ? `/plan-detail/${data.id}` : "/my-plans");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan kaydedilirken bir hata oluştu");
      setSaving(false);
    }
  };

  const cancel = () => {
    if (confirm("Plandan çıkmak istediğine emin misin? Girdiğin bilgiler kaybolacak.")) {
      router.push("/travel-mode");
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Adım adım planla"
        title="Planını kendin kur"
        description="Her adım isteğe bağlı ayrıntılar içerir; boş bıraktıkların plana dahil edilmez."
        actions={
          <button type="button" className="btn btn-quiet" onClick={cancel}>
            Vazgeç
          </button>
        }
      />

      <Stepper step={step} maxStep={maxStep} onSelect={goTo} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card p-5 sm:p-6 md:p-8" key={step}>
          {step === 1 && (
            <StepBody title="Nereye, ne zaman, kaç kişi?" lead="Planın iskeleti bu bilgilerden oluşur.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="destination" className="field-label">
                    Şehir <span className="text-accent-2">*</span>
                  </label>
                  <input
                    id="destination"
                    className="input"
                    placeholder="Örn. Kapadokya"
                    value={basic.destination}
                    onChange={(event) => setBasic({ ...basic, destination: event.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="field-label">
                    Ülke
                  </label>
                  <input
                    id="country"
                    className="input"
                    placeholder="Örn. Türkiye"
                    value={basic.country}
                    onChange={(event) => setBasic({ ...basic, country: event.target.value })}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="startDate" className="field-label">
                    Gidiş <span className="text-accent-2">*</span>
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    className="input"
                    min={today}
                    value={basic.startDate}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      setBasic({
                        ...basic,
                        startDate,
                        endDate: basic.endDate && startDate > basic.endDate ? "" : basic.endDate,
                      });
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="field-label">
                    Dönüş <span className="text-accent-2">*</span>
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    className="input"
                    min={basic.startDate || today}
                    value={basic.endDate}
                    onChange={(event) => setBasic({ ...basic, endDate: event.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
                <div>
                  <span className="field-label">Kişi sayısı</span>
                  <div className="inline-flex items-center gap-1 rounded-full border border-line-2 bg-surface p-1">
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon !h-9 !w-9"
                      onClick={() => setBasic({ ...basic, travelers: Math.max(1, basic.travelers - 1) })}
                      disabled={basic.travelers <= 1}
                      aria-label="Kişi sayısını azalt"
                    >
                      <Minus />
                    </button>
                    <span className="tabular w-8 text-center text-base font-bold text-ink" aria-live="polite">
                      {basic.travelers}
                    </span>
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon !h-9 !w-9"
                      onClick={() => setBasic({ ...basic, travelers: Math.min(10, basic.travelers + 1) })}
                      disabled={basic.travelers >= 10}
                      aria-label="Kişi sayısını artır"
                    >
                      <Plus />
                    </button>
                  </div>
                </div>
                <ChipGroup
                  label="Seyahat tarzı"
                  options={STYLE_OPTIONS}
                  value={basic.travelStyle}
                  onChange={(travelStyle) => setBasic({ ...basic, travelStyle })}
                />
              </div>
            </StepBody>
          )}

          {step === 2 && (
            <StepBody
              title="Oraya nasıl gideceksin?"
              lead="Biletini aldıysan ya da fiyatını biliyorsan gir; bütçene eklensin. Henüz belli değilse bu adımı geç."
            >
              <TypeCards
                label="Ulaşım türü"
                options={TRANSPORT_TYPES}
                value={transport.type}
                onChange={(type) => setTransport({ ...transport, type })}
              />

              {transport.type && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="provider" className="field-label">
                      {transport.type === "Kendi aracım" ? "Not" : "Firma"}
                    </label>
                    <input
                      id="provider"
                      className="input"
                      placeholder={transport.type === "Kendi aracım" ? "Örn. Otoyol üzerinden" : "Örn. firma adı"}
                      value={transport.provider}
                      onChange={(event) => setTransport({ ...transport, provider: event.target.value })}
                    />
                  </div>
                  <MoneyField
                    id="transportPrice"
                    label={transport.type === "Kendi aracım" ? "Yakıt ve yol gideri (toplam)" : "Bilet tutarı (tüm yolcular)"}
                    value={transport.price}
                    onChange={(price) => setTransport({ ...transport, price })}
                  />
                  <div>
                    <label htmlFor="departure" className="field-label">
                      Kalkış saati
                    </label>
                    <input
                      id="departure"
                      type="time"
                      className="input"
                      value={transport.departure}
                      onChange={(event) => setTransport({ ...transport, departure: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="arrival" className="field-label">
                      Varış saati
                    </label>
                    <input
                      id="arrival"
                      type="time"
                      className="input"
                      value={transport.arrival}
                      onChange={(event) => setTransport({ ...transport, arrival: event.target.value })}
                    />
                  </div>
                </div>
              )}
            </StepBody>
          )}

          {step === 3 && (
            <StepBody
              title="Nerede kalacaksın?"
              lead={
                nights > 0
                  ? `${nights} gece konaklama için gecelik fiyatı gir; toplam kendiliğinden hesaplanır.`
                  : "Günübirlik bir gezi planlıyorsun; konaklama eklemeden devam edebilirsin."
              }
            >
              <TypeCards
                label="Konaklama türü"
                options={STAY_TYPES}
                value={stay.type}
                onChange={(type) => setStay({ ...stay, type })}
              />

              {stay.type && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="stayName" className="field-label">
                      Tesis adı
                    </label>
                    <input
                      id="stayName"
                      className="input"
                      placeholder="Örn. kalacağın yerin adı"
                      value={stay.name}
                      onChange={(event) => setStay({ ...stay, name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="stayLocation" className="field-label">
                      Konum
                    </label>
                    <input
                      id="stayLocation"
                      className="input"
                      placeholder="Örn. şehir merkezi"
                      value={stay.location}
                      onChange={(event) => setStay({ ...stay, location: event.target.value })}
                    />
                  </div>
                  <MoneyField
                    id="stayPrice"
                    label="Gecelik fiyat (tüm grup)"
                    value={stay.price}
                    onChange={(price) => setStay({ ...stay, price })}
                  />
                  <div className="flex items-end">
                    <p className="w-full rounded-2xl bg-canvas-2 px-4 py-3 text-sm text-ink-2">
                      <span className="tabular font-semibold text-ink">
                        {nights} gece × {formatMoney(toAmount(stay.price))}
                      </span>
                      <br />
                      Toplam {formatMoney(breakdown.accommodation)}
                    </p>
                  </div>
                </div>
              )}
            </StepBody>
          )}

          {step === 4 && (
            <StepBody title="Günlerini doldur" lead="Her güne saatli aktiviteler ekle; maliyetler bütçene yansır.">
              <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
                {days.map((day, index) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setActiveDay(index)}
                    aria-pressed={activeDay === index}
                    className="chip !h-auto flex-none flex-col !items-start !gap-0.5 !rounded-2xl !px-4 !py-2.5"
                  >
                    <span className="text-xs font-semibold opacity-80">{day.day}. gün</span>
                    <span className="tabular text-sm font-bold">
                      {addDays(basic.startDate, index).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      {day.isEmpty ? " · boş" : day.activities.length ? ` · ${day.activities.length}` : ""}
                    </span>
                  </button>
                ))}
              </div>

              {days[activeDay] && (
                <DayEditor
                  key={days[activeDay].day}
                  day={days[activeDay]}
                  date={addDays(basic.startDate, activeDay)}
                  onChange={(patch) => updateDay(activeDay, patch)}
                />
              )}
            </StepBody>
          )}

          {step === 5 && (
            <StepBody
              title="Bütçeni tamamla"
              lead="Ulaşım, konaklama ve aktiviteler önceki adımlardan geldi. Kalan kalemleri sen belirle."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyField
                  id="foodPerDay"
                  label="Günlük yeme-içme (tüm grup)"
                  value={foodPerDay}
                  onChange={setFoodPerDay}
                />
                <MoneyField id="otherCost" label="Diğer giderler" value={otherCost} onChange={setOtherCost} />
                <MoneyField id="targetBudget" label="Hedef bütçen" value={targetBudget} onChange={setTargetBudget} />
              </div>

              <div className="mt-8">
                <BudgetBars breakdown={breakdown} total={total} />
              </div>

              {target > 0 && <TargetCompare total={total} target={target} />}
            </StepBody>
          )}

          {step === 6 && (
            <StepBody title="Son bir bakış" lead="Her şey doğruysa planını kaydet; sonra Planlarım’dan açabilirsin.">
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <SummaryItem label="Rota">
                  {basic.destination}
                  {basic.country ? `, ${basic.country}` : ""}
                </SummaryItem>
                <SummaryItem label="Tarih">
                  {formatDateRange(basic.startDate, basic.endDate)} · {dayCount} gün
                </SummaryItem>
                <SummaryItem label="Yolcular">
                  {basic.travelers} kişi · {styleLabel(basic.travelStyle)}
                </SummaryItem>
                <SummaryItem label="Ulaşım">
                  {transport.type
                    ? `${transport.type}${transport.provider ? ` · ${transport.provider}` : ""} · ${formatMoney(breakdown.transport)}`
                    : "Eklenmedi"}
                </SummaryItem>
                <SummaryItem label="Konaklama">
                  {stay.type
                    ? `${stay.name || stay.type} · ${nights} gece · ${formatMoney(breakdown.accommodation)}`
                    : "Eklenmedi"}
                </SummaryItem>
                <SummaryItem label="Aktiviteler">
                  {days.reduce((sum, day) => sum + (day.isEmpty ? 0 : day.activities.length), 0)} aktivite ·{" "}
                  {formatMoney(breakdown.activities)}
                </SummaryItem>
              </dl>

              <hr className="dash-rule my-7" />
              <BudgetBars breakdown={breakdown} total={total} />
              {target > 0 && <TargetCompare total={total} target={target} />}
            </StepBody>
          )}

          <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-6">
            <button type="button" className="btn btn-outline" onClick={() => goTo(step - 1)} disabled={step === 1}>
              <ArrowLeft />
              Geri
            </button>
            {step < STEPS.length ? (
              <button type="button" className="btn btn-primary" onClick={() => goTo(step + 1)}>
                {step === 2 && !transport.type ? "Bu adımı geç" : step === 3 && !stay.type ? "Bu adımı geç" : "Devam et"}
                <ArrowRight />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={savePlan} disabled={saving}>
                {saving ? <span className="spinner" /> : <Save />}
                {saving ? "Kaydediliyor…" : "Planı kaydet"}
              </button>
            )}
          </div>
        </section>

        {/* Canlı özet */}
        <aside className="card overflow-hidden shadow-lift lg:sticky lg:top-24">
          <DestinationPreview
            city={basic.destination}
            country={basic.country}
            eyebrow="Planın"
            meta={basic.country.trim() || undefined}
          />
          <div className="p-6">
            <dl className="space-y-3 text-sm">
              <FactRow label="Tarihler" value={formatDateRange(basic.startDate || null, basic.endDate || null)} />
              <FactRow
                label="Süre"
                value={dayCount > 0 ? `${dayCount} gün${nights > 0 ? ` · ${nights} gece` : ""}` : "—"}
              />
              <FactRow label="Yolcu" value={`${basic.travelers} kişi`} />
              <FactRow label="Tarz" value={styleLabel(basic.travelStyle) ?? "—"} />
              <FactRow label="Ulaşım" value={transport.type || "Eklenmedi"} />
              <FactRow label="Konaklama" value={stay.type ? stay.name.trim() || stay.type : "Eklenmedi"} />
            </dl>
          </div>
          <div className="border-t border-line p-6 pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink-2">Tahmini toplam</p>
              <p className="tabular font-display text-2xl font-extrabold text-ink">{formatMoney(total)}</p>
            </div>
            {target > 0 && (
              <>
                <TargetMeter total={total} target={target} className="mt-3" />
                <p className="tabular mt-1.5 text-xs text-ink-3">Hedef: {formatMoney(target)}</p>
              </>
            )}
            {dayCount > 0 && total > 0 && (
              <p className="tabular mt-3 text-xs leading-relaxed text-ink-3">
                Günlük ortalama {formatMoney(total / dayCount)}
                {basic.travelers > 1 ? ` · kişi başı ${formatMoney(total / basic.travelers)}` : ""}
              </p>
            )}
          </div>
        </aside>
      </div>
    </Page>
  );
}

/* --------------------------- Alt bileşenler -------------------------- */

function Stepper({ step, maxStep, onSelect }: { step: number; maxStep: number; onSelect: (step: number) => void }) {
  // Çizgi ilk ve son dairenin merkezleri arasında uzanır (her adım eşit genişlikte).
  const edge = `${100 / (STEPS.length * 2)}%`;
  return (
    <nav aria-label="Planlama adımları" className="mb-8">
      <div className="mb-4 md:hidden">
        <p className="text-sm font-semibold text-ink">
          <span className="tabular text-brand">
            Adım {step}/{STEPS.length}
          </span>{" "}
          · {STEPS[step - 1].title}
        </p>
        <div className="meter mt-2" aria-hidden="true">
          <span style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
      </div>
      <ol className="relative flex items-start justify-between gap-1">
        <span className="absolute top-5 h-0.5 rounded-full bg-line" style={{ left: edge, right: edge }} aria-hidden="true">
          <span
            className="block h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </span>
        {STEPS.map((item) => {
          const state = item.id === step ? "current" : item.id < step ? "done" : "todo";
          const reachable = item.id <= maxStep;
          return (
            <li key={item.id} className="relative z-10 flex flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => reachable && onSelect(item.id)}
                disabled={!reachable}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={`${item.id}. adım: ${item.title}`}
                className={`grid h-10 w-10 place-items-center rounded-full border-2 transition-colors [&_svg]:h-4 [&_svg]:w-4 ${
                  state === "current"
                    ? "border-brand bg-surface text-brand ring-4 ring-brand-soft"
                    : state === "done"
                      ? "border-brand bg-brand text-on-brand"
                      : reachable
                        ? "border-line-2 bg-surface text-ink-2 hover:border-brand hover:text-brand"
                        : "border-line bg-surface text-ink-3"
                } ${reachable ? "cursor-pointer" : "cursor-default"}`}
              >
                {state === "done" ? <Check /> : item.icon}
              </button>
              <span
                className={`mt-2 hidden text-center text-xs font-semibold md:block ${
                  state === "todo" ? "text-ink-3" : state === "current" ? "text-brand" : "text-ink"
                }`}
              >
                {item.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepBody({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="rise">
      <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
      <p className="mb-7 mt-1.5 text-sm leading-relaxed text-ink-2">{lead}</p>
      {children}
    </div>
  );
}

interface TypeCardsProps {
  label: string;
  options: Array<{ value: string; icon: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
}

/** Büyük ikonlu tür seçimi; seçili karta tekrar basmak seçimi kaldırır. */
function TypeCards({ label, options, value, onChange }: TypeCardsProps) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? "" : option.value)}
              className={`relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition-colors ${
                on
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line-2 bg-surface text-ink-2 hover:border-lav hover:text-ink"
              }`}
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl [&_svg]:h-5 [&_svg]:w-5 ${
                  on ? "bg-brand text-on-brand" : "bg-canvas-2 text-ink-2"
                }`}
              >
                {option.icon}
              </span>
              {option.value}
              {on && (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-brand text-on-brand">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          className="input tabular pr-9"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">₺</span>
      </div>
    </div>
  );
}

function DayEditor({ day, date, onChange }: { day: DayPlan; date: Date; onChange: (patch: Partial<DayPlan>) => void }) {
  const [draft, setDraft] = useState({ name: "", startTime: "", endTime: "", cost: "", description: "" });
  const sorted = [...day.activities].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const canAdd = draft.name.trim() !== "" && draft.startTime !== "";

  const addActivity = () => {
    if (!canAdd) return;
    const activity: Activity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: draft.name.trim(),
      startTime: draft.startTime,
      endTime: draft.endTime,
      cost: toAmount(draft.cost),
      description: draft.description.trim(),
    };
    onChange({ activities: [...day.activities, activity] });
    setDraft({ name: "", startTime: "", endTime: "", cost: "", description: "" });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl font-extrabold text-ink">{day.day}. gün</p>
          <p className="text-sm text-ink-2">{formatDayLong(date)}</p>
        </div>
        <button
          type="button"
          className="chip"
          aria-pressed={day.isEmpty}
          onClick={() => onChange({ isEmpty: !day.isEmpty })}
        >
          <MoonStar />
          Serbest gün
        </button>
      </div>

      {day.isEmpty ? (
        <p className="mt-5 rounded-2xl bg-canvas-2 px-5 py-8 text-center text-sm text-ink-2">
          Bu gün serbest bırakıldı; plana aktivite eklenmeyecek.
        </p>
      ) : (
        <>
          {sorted.length > 0 && (
            <ol className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {sorted.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3 bg-surface px-4 py-3.5 sm:gap-4">
                  <p className="tabular flex w-[4.5rem] flex-none items-center gap-1.5 pt-0.5 text-sm font-bold text-brand sm:w-28">
                    <Clock className="hidden h-3.5 w-3.5 flex-none sm:block" />
                    <span>
                      {activity.startTime}
                      {activity.endTime ? <span className="font-medium text-ink-3"> – {activity.endTime}</span> : null}
                    </span>
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-ink">{activity.name}</p>
                    {activity.description && (
                      <p className="mt-0.5 break-words text-sm leading-relaxed text-ink-2">{activity.description}</p>
                    )}
                    {activity.cost > 0 && (
                      <span className="tag tag-amber tabular mt-2 sm:hidden">{formatMoney(activity.cost)}</span>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    {activity.cost > 0 && (
                      <span className="tag tag-amber tabular hidden sm:inline-flex">{formatMoney(activity.cost)}</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon !h-8 !w-8 hover:!bg-rose-soft hover:!text-rose"
                      onClick={() =>
                        onChange({ activities: day.activities.filter((item) => item.id !== activity.id) })
                      }
                      aria-label={`${activity.name} aktivitesini kaldır`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 rounded-[1.25rem] bg-canvas-2 p-4 sm:p-5">
            <p className="mb-4 flex items-center gap-2 font-display text-base font-bold text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand">
                <Plus className="h-4 w-4" />
              </span>
              Aktivite ekle
            </p>
            <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
              <div>
                <label htmlFor="actName" className="field-label">
                  Aktivite
                </label>
                <input
                  id="actName"
                  className="input"
                  placeholder="Örn. Müze ziyareti"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addActivity();
                    }
                  }}
                />
              </div>
              <div>
                <label htmlFor="actStart" className="field-label">
                  Başlangıç
                </label>
                <input
                  id="actStart"
                  type="time"
                  className="input"
                  value={draft.startTime}
                  onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="actEnd" className="field-label">
                  Bitiş
                </label>
                <input
                  id="actEnd"
                  type="time"
                  className="input"
                  value={draft.endTime}
                  onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                />
              </div>
              <MoneyField
                id="actCost"
                label="Maliyet"
                value={draft.cost}
                onChange={(cost) => setDraft({ ...draft, cost })}
              />
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="actDesc" className="field-label">
                  Not (isteğe bağlı)
                </label>
                <input
                  id="actDesc"
                  className="input"
                  placeholder="Bilet, adres, hatırlatma…"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={addActivity} disabled={!canAdd}>
                <Plus />
                Ekle
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="dayNotes" className="field-label">
              Günün notları
            </label>
            <textarea
              id="dayNotes"
              className="input"
              rows={2}
              placeholder="Bu güne dair aklında tutmak istediklerin…"
              value={day.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

const BREAKDOWN_ROWS: Array<{ key: "transport" | "accommodation" | "activities" | "food" | "other"; category: BudgetCategory }> = [
  { key: "transport", category: "TRANSPORT" },
  { key: "accommodation", category: "ACCOMMODATION" },
  { key: "activities", category: "ACTIVITIES" },
  { key: "food", category: "FOOD" },
  { key: "other", category: "OTHER" },
];

function BudgetBars({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  return (
    <div>
      <ul className="space-y-3.5">
        {BREAKDOWN_ROWS.map(({ key, category }) => {
          const amount = breakdown[key] ?? 0;
          const share = total > 0 ? (amount / total) * 100 : 0;
          return (
            <li key={key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: BUDGET_COLOR[category] }}
                    aria-hidden="true"
                  />
                  {BUDGET_LABEL[category]}
                </span>
                <span className="tabular font-semibold text-ink-2">{formatMoney(amount)}</span>
              </div>
              <div className="meter">
                <span style={{ width: `${share}%`, background: BUDGET_COLOR[category] }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm font-semibold text-ink">Tahmini toplam</span>
        <span className="tabular font-display text-2xl font-extrabold text-ink">{formatMoney(total)}</span>
      </div>
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-ink">{children}</dd>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex-none text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Toplamın hedef bütçeye oranı; %100'de durur, aşınca kırmızıya döner. */
function TargetMeter({ total, target, className = "" }: { total: number; target: number; className?: string }) {
  const share = Math.min(100, (total / target) * 100);
  return (
    <div
      className={`meter ${className}`}
      role="meter"
      aria-label="Hedef bütçenin kullanılan kısmı"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share)}
    >
      <span style={{ width: `${share}%`, ...(total > target ? { background: "var(--rose)" } : {}) }} />
    </div>
  );
}

/** Hedef bütçe karşılaştırması: çubuk + durum bildirimi. */
function TargetCompare({ total, target }: { total: number; target: number }) {
  const over = total > target;
  return (
    <div className="mt-6 rounded-2xl bg-canvas-2 p-4 sm:p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">Hedef bütçe</span>
        <span className="tabular text-ink-2">
          <span className="font-semibold text-ink">{formatMoney(total)}</span> / {formatMoney(target)}
        </span>
      </div>
      <TargetMeter total={total} target={target} />
      <div className={`notice mt-4 ${over ? "notice-error" : "notice-success"}`} role="status">
        <Wallet />
        <span>
          {over
            ? `Tahmini toplam, hedef bütçeni ${formatMoney(total - target)} aşıyor.`
            : `Hedef bütçenin içindesin; ${formatMoney(target - total)} payın kalıyor.`}
        </span>
      </div>
    </div>
  );
}

export default function ManualPlannerPage() {
  return (
    <AuthGate reason="Planını kaydedebilmek için hesabına giriş yapmalısın.">
      <ManualPlanner />
    </AuthGate>
  );
}
