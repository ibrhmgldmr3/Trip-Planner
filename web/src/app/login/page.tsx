"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { Alan, Dugme, GIRDI_SINIFI, KonturDoku, Pusula, Yukleniyor } from "@/components/ui";

/**
 * Giriş sayfası.
 *
 * Bu turda:
 *  - ÖLÜ "Beni hatırla" ONAY KUTUSU KALDIRILDI. Hiçbir şeye bağlı değildi:
 *    `checked`/`onChange` yok, `handleSubmit` okumuyor, oturum süresini
 *    etkilemiyordu. Çalışmayan bir söz vermek, hiç söz vermemekten kötü.
 *  - Düğme artık `bekliyor` prop'unu kullanıyor. Metni elle değiştirmek
 *    ("Giriş yapılıyor…") düğmenin GENİŞLİĞİNİ zıplatıyordu; bileşen
 *    bunun yerine sabit metnin yanına dönen gösterge koyuyor.
 *  - Alan `id`'leri (`email`, `password`) ve `button[type="submit"]`
 *    KORUNDU — e2e testleri bu seçicilere bağlı.
 */

function GirisFormu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    setHata("");

    try {
      const sonuc = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (!sonuc?.ok) {
        setHata(sonuc?.error || "Giriş başarısız");
        setYukleniyor(false);
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      logger.error("Giriş yapılamadı", err);
      setHata("Bir hata oluştu. Lütfen tekrar deneyin.");
      setYukleniyor(false);
    }
  };

  return (
    <div className="harita-zemin relative min-h-screen px-4 py-12 md:py-20 flex items-start justify-center overflow-hidden">
      {/* Kontur dokusu giriş ekranında da duruyor: kullanıcı uygulamanın
          içine girmeden önce de aynı yüzeyde olduğunu biliyor. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <KonturDoku yogunluk={0.7} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Pusula className="h-9 w-9 mx-auto text-[var(--accent)]" />
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)] mt-4">
            Tekrar hoş geldiniz
          </h1>
          <p className="text-[var(--fg-muted)] mt-2">
            Planlarınıza erişmek için giriş yapın.
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[var(--radius-lg)] shadow-[var(--shadow-pop)]">
          <div className="p-6 md:p-7">
            {hata && (
              <p
                role="alert"
                className="mb-5 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
              >
                {hata}
              </p>
            )}

            <form onSubmit={gonder} className="space-y-5">
              <Alan etiket="E-posta" htmlFor="email">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={GIRDI_SINIFI}
                  placeholder="ornek@eposta.com"
                />
              </Alan>

              {/* ŞİFREMİ UNUTTUM (B9). Etiketin YANINDA duruyor, formun
                  altında değil: kullanıcı buna, şifre alanına baktığı anda
                  ihtiyaç duyuyor. */}
              <Alan
                etiket="Şifre"
                htmlFor="password"
                yardim={
                  <Link
                    href="/forgot-password"
                    className="text-[var(--accent)] hover:underline underline-offset-4"
                  >
                    Şifremi unuttum
                  </Link>
                }
              >
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={GIRDI_SINIFI}
                  placeholder="••••••••"
                />
              </Alan>

              <Dugme type="submit" boy="lg" bekliyor={yukleniyor} className="w-full">
                Giriş yap
              </Dugme>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-[var(--line)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[var(--surface)] text-sm text-[var(--fg-subtle)]">
                  veya
                </span>
              </div>
            </div>

            <button
              onClick={() => signIn("google", { callbackUrl })}
              type="button"
              className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--fg)] text-sm font-medium transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google ile devam et
            </button>
          </div>
        </div>

        <p className="text-sm text-[var(--fg-muted)] text-center mt-6">
          Hesabınız yok mu?{" "}
          <Link
            href="/register"
            className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
          >
            Kayıt olun
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Yukleniyor />}>
      <GirisFormu />
    </Suspense>
  );
}
