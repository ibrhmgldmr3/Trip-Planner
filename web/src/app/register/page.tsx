"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { registerSchema, ilkHataMesaji } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";
import { Alan, Dugme, GIRDI_SINIFI, Kart } from "@/components/ui";

/**
 * Form şeması sunucudaki `registerSchema`yı GENİŞLETİYOR, tekrar
 * TANIMLAMIYOR.
 *
 * Eskiden burada ayrı, daha ZAYIF bir şema vardı: yalnızca `min(8)`
 * kontrolü yapıyor, sunucunun zorunlu tuttuğu harf/rakam kurallarını ve
 * üst sınırı (72 karakter) bilmiyordu. Sonuç kullanıcı için görünmüyordu
 * (sunucu zaten reddediyordu) ama gereksiz bir gidiş-dönüş ve iki şemanın
 * zamanla sessizce ayrışması riski vardı — sunucudaki kural değişse
 * istemci bundan habersiz kalırdı.
 */
const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof registerFormSchema>;

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate form data
      const result = registerFormSchema.safeParse(formData);

      if (!result.success) {
        setError(ilkHataMesaji(result.error, "Form bilgileri geçersiz"));
        setIsLoading(false);
        return;
      }

      // Send registration request
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Kayıt sırasında bir hata oluştu");
      }

      // Registration successful
      setSuccess("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...");
      
      // Automatically redirect to login page after successful registration
      setTimeout(() => {
        signIn("credentials", {
          email: formData.email,
          password: formData.password,
          callbackUrl: "/",
        });
      }, 2000);
    } catch (err: unknown) {
      logger.error("Kayıt oluşturulamadı", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-12 md:py-20 flex items-start justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--fg)]">
            Hesap oluşturun
          </h1>
          <p className="text-[var(--fg-muted)] mt-2">
            Planlarınız kaydedilsin, her cihazdan erişin.
          </p>
        </div>

        <Kart>
          <div className="p-6 md:p-7">
            {error && (
              <p
                role="alert"
                className="mb-5 rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="mb-5 rounded-[var(--radius)] border border-[var(--ok)]/30 bg-[var(--ok-soft)] px-4 py-3 text-sm text-[var(--ok)]"
              >
                {success}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Alan etiket="İsim" htmlFor="name">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className={GIRDI_SINIFI}
                  placeholder="Adınız"
                />
              </Alan>

              <Alan etiket="E-posta" htmlFor="email">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={GIRDI_SINIFI}
                  placeholder="ornek@eposta.com"
                />
              </Alan>

              {/*
                Kurallar ARTIK ÖNCEDEN yazıyor. Eskiden yer tutucu yalnızca
                "En az 8 karakter" diyordu; harf ve rakam zorunluluğunu
                kullanıcı ancak sunucu reddedince öğreniyordu.
              */}
              <Alan
                etiket="Şifre"
                htmlFor="password"
                ipucu="En az 8 karakter, en az bir harf ve bir rakam içermeli."
              >
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={GIRDI_SINIFI}
                  placeholder="••••••••"
                />
              </Alan>

              <Alan etiket="Şifre tekrar" htmlFor="confirmPassword">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={GIRDI_SINIFI}
                  placeholder="••••••••"
                />
              </Alan>

              <div className="flex items-start gap-2.5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4 rounded border-[var(--line-strong)] accent-[var(--accent)]"
                />
                <label htmlFor="terms" className="text-sm text-[var(--fg-muted)] leading-relaxed">
                  <Link
                    href="/terms"
                    className="text-[var(--accent)] hover:underline underline-offset-4"
                  >
                    Kullanım şartlarını
                  </Link>{" "}
                  ve{" "}
                  <Link
                    href="/privacy"
                    className="text-[var(--accent)] hover:underline underline-offset-4"
                  >
                    gizlilik politikasını
                  </Link>{" "}
                  kabul ediyorum
                </label>
              </div>

              <Dugme type="submit" boy="lg" disabled={isLoading} className="w-full">
                {isLoading ? "Kayıt yapılıyor…" : "Kayıt ol"}
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
              onClick={() => signIn("google", { callbackUrl: "/" })}
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
        </Kart>

        <p className="text-sm text-[var(--fg-muted)] text-center mt-6">
          Zaten hesabınız var mı?{" "}
          <Link
            href="/login"
            className="text-[var(--accent)] font-medium hover:underline underline-offset-4"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
    </main>
  );
}
