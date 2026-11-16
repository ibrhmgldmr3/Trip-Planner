"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  Bus,
  Camera,
  Car,
  CircleAlert,
  Landmark,
  LogOut,
  Music,
  Palette,
  Plane,
  Save,
  ShoppingBag,
  Shuffle,
  TrainFront,
  Trees,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import AuthGate from "@/components/AuthGate";
import ChipGroup, { type ChipOption } from "@/components/ChipGroup";
import { PageHeader, PageLoader } from "@/components/States";
import { initials } from "@/lib/format";

const TRANSPORT_OPTIONS: ChipOption[] = [
  { value: "all", label: "Fark etmez", icon: <Shuffle /> },
  { value: "plane", label: "Uçak", icon: <Plane /> },
  { value: "bus", label: "Otobüs", icon: <Bus /> },
  { value: "train", label: "Tren", icon: <TrainFront /> },
  { value: "car", label: "Araba", icon: <Car /> },
];

const CURRENCY_OPTIONS: ChipOption[] = [
  { value: "TRY", label: "₺ Türk lirası" },
  { value: "USD", label: "$ Dolar" },
  { value: "EUR", label: "€ Euro" },
  { value: "GBP", label: "£ Sterlin" },
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

function Profile() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(session?.user?.name ?? "");
  const [transport, setTransport] = useState("all");
  const [currency, setCurrency] = useState("TRY");
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) throw new Error();
        const { profile } = await response.json();
        setName((current) => current || profile.name || "");
        setTransport(profile.preferredTransport);
        setCurrency(profile.preferredCurrency);
        setInterests(profile.interests);
      } catch {
        setError("Tercihlerin yüklenemedi. Sayfayı yenileyip tekrar dene.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("İsim en az 2 karakter olmalı.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          preferredTransport: transport,
          preferredCurrency: currency,
          interests,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Profil güncellenemedi");

      // Oturumdaki adı da yenile ki üst menü güncel kalsın.
      await update();
      setError("");
      toast.success("Profilin güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Profilin yükleniyor…" />;

  return (
    <div>
      <PageHeader eyebrow="Hesap" title="Profil ve tercihler" description="Seyahat tercihlerin hesabında saklanır." />

      {/* Profil başlığı */}
      <section className="card glow rise flex flex-col gap-5 overflow-hidden p-5 sm:flex-row sm:items-center sm:p-7">
        <span
          className="grid h-20 w-20 flex-none place-items-center rounded-full font-display text-3xl font-extrabold text-white shadow-soft"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--lav))" }}
          aria-hidden="true"
        >
          {initials(session?.user?.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-extrabold text-ink">{session?.user?.name || "Gezgin"}</p>
          <p className="mt-0.5 truncate text-[0.95rem] text-ink-2">{session?.user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="btn btn-quiet btn-sm self-start hover:!text-rose sm:self-center"
        >
          <LogOut />
          Çıkış yap
        </button>
      </section>

      <form onSubmit={handleSubmit} className="card rise mt-6 p-5 sm:p-7 md:p-8" style={{ "--i": 1 } as CSSProperties}>
        {error && (
          <div className="notice notice-error mb-6" role="alert">
            <CircleAlert />
            <span>{error}</span>
          </div>
        )}

        <Group title="Hesap" description="Adın üst menüde görünür.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="field-label">
                Ad soyad
              </label>
              <input
                id="name"
                className="input"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className="field-label">
                E-posta
              </label>
              <input id="email" className="input opacity-70" value={session?.user?.email ?? ""} readOnly disabled />
              <p className="field-hint">E-posta adresin değiştirilemez.</p>
            </div>
          </div>
        </Group>

        <Group title="Seyahat tercihleri" description="Nasıl seyahat etmeyi sevdiğini hesabına kaydet.">
          <div className="space-y-6">
            <ChipGroup
              label="Tercih ettiğin ulaşım"
              options={TRANSPORT_OPTIONS}
              value={transport}
              onChange={setTransport}
            />
            <ChipGroup
              multiple
              label="İlgi alanların"
              hint="Birden fazla seçebilirsin."
              options={INTEREST_OPTIONS}
              value={interests}
              onChange={setInterests}
            />
          </div>
        </Group>

        <Group title="Para birimi" description="Tercih ettiğin para birimi.">
          <ChipGroup label="Para birimi" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
        </Group>

        <div className="mt-8 flex justify-end border-t border-line pt-6">
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={saving}>
            {saving ? <span className="spinner" /> : <Save />}
            {saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Ayarlar formunda kalın başlıklı bir bölüm. */
function Group({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-7 first-of-type:border-t-0 first-of-type:pt-0 xl:grid-cols-[14rem_minmax(0,1fr)] xl:gap-8">
      <div>
        <h2 className="font-display text-lg font-extrabold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <AuthGate reason="Profilini görebilmek için hesabına giriş yapmalısın.">
      <Profile />
    </AuthGate>
  );
}
