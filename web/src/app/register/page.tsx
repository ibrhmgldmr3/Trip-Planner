"use client";

import { Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { z } from "zod";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import AuthShell, { GoogleMark } from "@/components/AuthShell";
import { PageLoader } from "@/components/States";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "İsim en az 2 karakter olmalı"),
    email: z.string().trim().email("Geçerli bir e-posta gir"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof registerSchema>;
type FieldErrors = Partial<Record<keyof FormData, string>>;

/** Kayıt sonrası yalnızca site içi adreslere dönülür. */
function safeCallback(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/travel-mode";
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");

  const [formData, setFormData] = useState<FormData>({ name: "", email: "", password: "", confirmPassword: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    getProviders()
      .then((providers) => setHasGoogle(Boolean(providers?.google)))
      .catch(() => setHasGoogle(false));
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormData | undefined;
        if (field && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.data.name,
          email: result.data.email,
          password: result.data.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Kayıt sırasında bir hata oluştu");
      }

      setSuccess(true);
      await signIn("credentials", {
        email: result.data.email,
        password: result.data.password,
        callbackUrl: safeCallback(rawCallback),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu. Lütfen tekrar dene.");
      setIsLoading(false);
    }
  };

  const loginHref = rawCallback ? `/login?callbackUrl=${encodeURIComponent(rawCallback)}` : "/login";

  return (
    <AuthShell
      eyebrow="Yola çıkmadan önce"
      title="Hesap oluştur"
      description="Planlarını kaydetmek ve gezilerini tek yerden takip etmek için ücretsiz bir hesap aç."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link href={loginHref} className="font-semibold text-brand underline-offset-4 hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="notice notice-error" role="alert">
            <CircleAlert />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="notice notice-success" role="status">
            <CircleCheck />
            <span>Hesabın oluşturuldu, giriş yapılıyor…</span>
          </div>
        )}

        <Field
          id="name"
          label="Ad soyad"
          placeholder="Adın ve soyadın"
          autoComplete="name"
          value={formData.name}
          error={fieldErrors.name}
          onChange={handleChange}
        />
        <Field
          id="email"
          type="email"
          label="E-posta"
          placeholder="ornek@eposta.com"
          autoComplete="email"
          value={formData.email}
          error={fieldErrors.email}
          onChange={handleChange}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="password"
            type="password"
            label="Şifre"
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            value={formData.password}
            error={fieldErrors.password}
            onChange={handleChange}
          />
          <Field
            id="confirmPassword"
            type="password"
            label="Şifre (tekrar)"
            placeholder="Şifreni yinele"
            autoComplete="new-password"
            value={formData.confirmPassword}
            error={fieldErrors.confirmPassword}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner" />
              Hesap oluşturuluyor…
            </>
          ) : (
            <>
              Hesap oluştur
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

interface FieldProps {
  id: keyof FormData;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}

function Field({ id, label, value, onChange, type = "text", placeholder, autoComplete, error }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className={`input ${error ? "!border-rose" : ""}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose">
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RegisterForm />
    </Suspense>
  );
}
