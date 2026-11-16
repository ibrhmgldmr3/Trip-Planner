"use client";

import { Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  Bus,
  Camera,
  Car,
  CircleAlert,
  Heart,
  Landmark,
  MapPin,
  MessageSquareText,
  Music,
  Palette,
  Plane,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
  TramFront,
  Trees,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import ChipGroup, { type ChipOption } from "@/components/ChipGroup";
import DestinationPreview from "@/components/planner/DestinationPreview";
import { Page, PageHeader, PageLoader, RouteLoader } from "@/components/States";
import { formatDateRange, formatMoney, todayISO, tripDays } from "@/lib/format";

interface TripFormData {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetAmount: string;
  budgetLevel: string;
  transportPrefs: string[];
  interests: string[];
  specialRequests: string;
  travelStyle: string;
  stayPreference: string;
}

/** Sunucudaki sınırla aynı olmalı (src/server/validation.ts). */
const MAX_AI_DAYS = 14;

const STYLE_OPTIONS: ChipOption[] = ["Standart", "Ekonomik", "Lüks", "Macera", "Kültürel"].map((value) => ({ value }));
const BUDGET_OPTIONS: ChipOption[] = ["Ekonomik", "Orta", "Lüks", "Sınırsız"].map((value) => ({ value }));
const STAY_OPTIONS: ChipOption[] = ["Otel", "Hostel", "Apart", "Airbnb", "Lüks Otel"].map((value) => ({ value }));

const TRANSPORT_OPTIONS: ChipOption[] = [
  { value: "Uçak", icon: <Plane /> },
  { value: "Otobüs", icon: <Bus /> },
  { value: "Tren", icon: <TrainFront /> },
  { value: "Araba", icon: <Car /> },
  { value: "Toplu Taşıma", icon: <TramFront /> },
];

const INTEREST_OPTIONS: ChipOption[] = [
  { value: "Tarihi Yerler", icon: <Landmark /> },
  { value: "Müzeler", icon: <Palette /> },
  { value: "Doğa", icon: <Trees /> },
  { value: "Gastronomi", icon: <Utensils /> },
  { value: "Alışveriş", icon: <ShoppingBag /> },
  { value: "Eğlence", icon: <Music /> },
  { value: "Plajlar", icon: <Waves /> },
  { value: "Fotoğrafçılık", icon: <Camera /> },
  { value: "Yerel Kültür", icon: <Users /> },
];

const isISODate = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

function Planner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();

  const [formData, setFormData] = useState<TripFormData>(() => {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    return {
      city: searchParams.get("city") ?? "",
      country: "",
      startDate: isISODate(start) && start! >= today ? start! : "",
      endDate: isISODate(end) && end! >= today ? end! : "",
      travelers: 1,
      budgetAmount: "",
      budgetLevel: "Orta",
      transportPrefs: [],
      interests: [],
      specialRequests: "",
      travelStyle: "Standart",
      stayPreference: "Otel",
    };
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const days = tripDays(formData.startDate, formData.endDate);

  const setField = <K extends keyof TripFormData>(key: K, value: TripFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleInput = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [id]: value };
      // Gidiş tarihi dönüşten sonraya alınırsa dönüşü temizle.
      if (id === "startDate" && next.endDate && value > next.endDate) next.endDate = "";
      return next;
    });
  };

  const validate = (): string | null => {
    if (!formData.city.trim()) return "Lütfen gidilecek şehri yaz.";
    if (formData.startDate && formData.startDate < today) return "Gidiş tarihi bugünden önce olamaz.";
    if (formData.endDate && formData.endDate < today) return "Dönüş tarihi bugünden önce olamaz.";
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      return "Gidiş tarihi dönüş tarihinden sonra olamaz.";
    }
    if (days > MAX_AI_DAYS) {
      return `AI ile en fazla ${MAX_AI_DAYS} günlük plan oluşturulabilir. Daha uzun geziler için adım adım planlamayı dene.`;
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }

    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data: { id?: string; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !data.id) {
        throw new Error(data.error || "Plan oluşturulurken bir hata oluştu. Lütfen tekrar dene.");
      }

      toast.success("Planın hazır!");
      router.push(`/plan-detail/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Plan oluşturulurken bir hata oluştu.";
      setError(message);
      toast.error(message);
      setIsGenerating(false);
    }
  };

  return (
    <Page>
      {isGenerating && <GeneratingOverlay city={formData.city} />}

      <PageHeader
        eyebrow="AI ile planla"
        title="Rotanı tarif et"
        description="Şehir yeterli; ne kadar ayrıntı verirsen plan o kadar sana göre olur."
        actions={
          <Link href="/manual-planner" className="btn btn-quiet">
            Kendim planlamak istiyorum
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Section index={1} icon={<MapPin />} title="Nereye ve ne zaman?">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="city" className="field-label">
                  Şehir <span className="text-accent-2">*</span>
                </label>
                <input
                  id="city"
                  className="input"
                  placeholder="Örn. İzmir"
                  value={formData.city}
                  onChange={handleInput}
                  autoComplete="off"
                  required
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
                  value={formData.country}
                  onChange={handleInput}
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="startDate" className="field-label">
                  Gidiş
                </label>
                <input
                  id="startDate"
                  type="date"
                  className="input"
                  min={today}
                  value={formData.startDate}
                  onChange={handleInput}
                />
              </div>
              <div>
                <label htmlFor="endDate" className="field-label">
                  Dönüş
                </label>
                <input
                  id="endDate"
                  type="date"
                  className="input"
                  min={formData.startDate || today}
                  value={formData.endDate}
                  onChange={handleInput}
                />
              </div>
            </div>
            <p className="field-hint">Tarih girmezsen genel bir şehir planı hazırlanır.</p>
          </Section>

          <Section index={2} icon={<SlidersHorizontal />} title="Nasıl bir gezi?">
            <div className="space-y-5">
              <ChipGroup
                label="Seyahat tarzı"
                options={STYLE_OPTIONS}
                value={formData.travelStyle}
                onChange={(value) => setField("travelStyle", value)}
              />
              <ChipGroup
                label="Bütçe düzeyi"
                options={BUDGET_OPTIONS}
                value={formData.budgetLevel}
                onChange={(value) => setField("budgetLevel", value)}
              />
              <ChipGroup
                label="Konaklama"
                options={STAY_OPTIONS}
                value={formData.stayPreference}
                onChange={(value) => setField("stayPreference", value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="budgetAmount" className="field-label">
                    Toplam bütçe (isteğe bağlı)
                  </label>
                  <div className="relative">
                    <input
                      id="budgetAmount"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      className="input tabular pr-9"
                      placeholder="Örn. 15000"
                      value={formData.budgetAmount}
                      onChange={handleInput}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">
                      ₺
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="travelers" className="field-label">
                    Kişi sayısı
                  </label>
                  <select
                    id="travelers"
                    className="input"
                    value={formData.travelers}
                    onChange={(event) => setField("travelers", Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count} kişi
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          <Section index={3} icon={<Heart />} title="Neleri seversin?">
            <div className="space-y-5">
              <ChipGroup
                multiple
                label="İlgi alanları"
                hint="Seçmezsen şehrin en bilinen yerlerine göre planlanır."
                options={INTEREST_OPTIONS}
                value={formData.interests}
                onChange={(value) => setField("interests", value)}
              />
              <ChipGroup
                multiple
                label="Ulaşım tercihleri"
                options={TRANSPORT_OPTIONS}
                value={formData.transportPrefs}
                onChange={(value) => setField("transportPrefs", value)}
              />
            </div>
          </Section>

          <Section index={4} icon={<MessageSquareText />} title="Eklemek istediğin bir şey var mı?">
            <label htmlFor="specialRequests" className="field-label">
              Özel istekler
            </label>
            <textarea
              id="specialRequests"
              className="input"
              rows={3}
              maxLength={600}
              placeholder="Örn. Deniz gören yerler ve tatlıcılar; çocukla seyahat ediyoruz; vejetaryen seçenekler…"
              value={formData.specialRequests}
              onChange={handleInput}
            />
          </Section>
        </div>

        {/* Rota önizlemesi ve özet */}
        <aside
          className="card rise overflow-hidden shadow-lift lg:sticky lg:top-24"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <DestinationPreview
            city={formData.city}
            country={formData.country}
            eyebrow="Plan özeti"
            meta={formData.country.trim() || undefined}
          />

          <div className="p-6">
            <dl className="space-y-3 text-sm">
              <SummaryRow
                label="Tarihler"
                value={formatDateRange(formData.startDate || null, formData.endDate || null)}
              />
              <SummaryRow label="Süre" value={days > 0 ? `${days} gün` : "Esnek"} />
              <SummaryRow label="Tarz" value={formData.travelStyle} />
              <SummaryRow
                label="Bütçe"
                value={
                  Number(formData.budgetAmount) > 0
                    ? `${formData.budgetLevel} · ${formatMoney(Number(formData.budgetAmount))}`
                    : formData.budgetLevel
                }
              />
              <SummaryRow label="Konaklama" value={formData.stayPreference} />
              <SummaryRow label="Yolcu" value={`${formData.travelers} kişi`} />
              <SummaryRow
                label="İlgi alanları"
                value={formData.interests.length ? formData.interests.join(", ") : "Genel"}
              />
              <SummaryRow
                label="Ulaşım"
                value={formData.transportPrefs.length ? formData.transportPrefs.join(", ") : "Fark etmez"}
              />
            </dl>
          </div>

          <div className="border-t border-line p-6 pt-5">
            {error && (
              <div className="notice notice-error mb-4" role="alert">
                <CircleAlert />
                <span>{error}</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isGenerating}>
              <Sparkles />
              Planı oluştur
            </button>
            <p className="mt-3 text-center text-xs text-ink-3">Planın otomatik olarak hesabına kaydedilir.</p>
          </div>
        </aside>
      </form>
    </Page>
  );
}

function Section({
  index,
  icon,
  title,
  children,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card rise p-6 md:p-7" style={{ "--i": index } as React.CSSProperties}>
      <div className="mb-5 flex items-center gap-3">
        <span
          className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:h-[1.15rem] [&_svg]:w-[1.15rem]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex-none text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function GeneratingOverlay({ city }: { city: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-canvas/80 px-5 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-label="Plan hazırlanıyor"
    >
      <div className="card glow w-full max-w-md overflow-hidden p-8 text-center shadow-float md:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand [&_svg]:h-7 [&_svg]:w-7">
          <Sparkles />
        </div>
        <RouteLoader className="mx-auto mt-4 h-16 w-44" />
        <h2 className="mt-3 font-display text-2xl font-extrabold text-ink">
          {city.trim() ? `${city.trim()} planın hazırlanıyor` : "Planın hazırlanıyor"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Duraklar seçiliyor, günler sıralanıyor ve bütçe hesaplanıyor. Bu bir-iki dakika sürebilir; sayfayı
          kapatma.
        </p>
        <p
          className="tabular mt-6 inline-flex h-8 items-center rounded-full bg-canvas-2 px-4 text-sm font-semibold text-ink-2"
          aria-hidden="true"
        >
          {clock}
        </p>
      </div>
    </div>
  );
}

export default function AiPlannerPage() {
  return (
    <AuthGate reason="Plan oluşturmak ve kaydetmek için hesabına giriş yapmalısın.">
      <Suspense fallback={<PageLoader />}>
        <Planner />
      </Suspense>
    </AuthGate>
  );
}
