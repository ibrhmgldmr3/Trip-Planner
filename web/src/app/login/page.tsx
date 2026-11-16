"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { ArrowRight, CircleAlert, Eye, EyeOff } from "lucide-react";
import AuthShell, { GoogleMark } from "@/components/AuthShell";
import { PageLoader } from "@/components/States";

/** Yalnızca aynı kaynağa ait adreslere dönülür; dış adresler ana sayfaya düşer. */
function safeCallback(raw: string | null): string {
  if (!raw) return "/";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin) return url.pathname + url.search;
  } catch {
    // Geçersiz adres: ana sayfaya dön.
  }
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(urlError ? "Giriş tamamlanamadı. Lütfen tekrar dene." : "");
  const [isLoading, setIsLoading] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    getProviders()
      .then((providers) => setHasGoogle(Boolean(providers?.google)))
      .catch(() => setHasGoogle(false));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const callbackUrl = safeCallback(rawCallback);
    try {
      const result = await signIn("credentials", { redirect: false, email, password, callbackUrl });
      if (!result?.ok) {
        setError(result?.error || "Giriş başarısız. Bilgilerini kontrol et.");
        setIsLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar dene.");
      setIsLoading(false);
    }
  };

  const registerHref = rawCallback ? `/register?callbackUrl=${encodeURIComponent(rawCallback)}` : "/register";

  return (
    <AuthShell
      eyebrow="Tekrar hoş geldin"
      title="Giriş yap"
      description="Planlarına ve gezilerine kaldığın yerden devam et."
      footer={
        <>
          Hesabın yok mu?{" "}
          <Link href={registerHref} className="font-semibold text-brand underline-offset-4 hover:underline">
            Kayıt ol
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="notice notice-error" role="alert">
            <CircleAlert />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="email" className="field-label">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="ornek@eposta.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Şifre
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-11"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink [&_svg]:h-4 [&_svg]:w-4"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner" />
              Giriş yapılıyor…
            </>
          ) : (
            <>
              Giriş yap
              <ArrowRight />
            </>
          )}
        </button>
      </form>

      {hasGoogle && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs font-medium text-ink-3">
            <span className="h-0 flex-1 border-t border-dashed border-line-2" />
            veya
            <span className="h-0 flex-1 border-t border-dashed border-line-2" />
          </div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: safeCallback(rawCallback) })}
            className="btn btn-outline w-full"
          >
            <GoogleMark />
            Google ile devam et
          </button>
        </>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginForm />
    </Suspense>
  );
}
