"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { z } from "zod";

// Schema for form validation
const registerSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof registerSchema>;

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
      const result = registerSchema.safeParse(formData);
      
      if (!result.success) {
        const errorMessage = result.error.format()._errors[0] || 
          result.error.format().name?._errors[0] || 
          result.error.format().email?._errors[0] || 
          result.error.format().password?._errors[0] || 
          result.error.format().confirmPassword?._errors[0] || 
          "Form validation failed";
        
        setError(errorMessage);
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
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-800 mb-2">
            Kayıt Ol
          </h1>
          <p className="text-gray-800">
            Trip Planner&apos;a hoş geldiniz
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4" role="alert">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-blue-700 mb-1">
              İsim
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 "
              placeholder="Adınız"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-blue-700 mb-1">
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="E-posta adresiniz"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-blue-700 mb-1">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="En az 8 karakter"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-blue-700 mb-1">
              Şifre Tekrar
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Şifrenizi tekrar girin"
            />
          </div>

          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-800">
              <span>
                <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                  Kullanım şartlarını
                </Link>{" "}
                ve{" "}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                  Gizlilik politikasını
                </Link>{" "}
                kabul ediyorum
              </span>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">veya</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-800 shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              Google ile Kayıt Ol
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-800">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
