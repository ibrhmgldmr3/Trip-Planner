"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, Page, PageLoader } from "./States";

/**
 * Oturum gerektiren sayfaları sarar: oturum yüklenirken bekletir,
 * giriş yapılmamışsa geri dönüş adresiyle birlikte girişe yönlendirir.
 */
export default function AuthGate({ children, reason }: { children: ReactNode; reason?: string }) {
  const { status } = useSession();
  const pathname = usePathname() ?? "/";

  if (status === "loading") return <PageLoader label="Oturum kontrol ediliyor…" />;

  if (status === "unauthenticated") {
    const callback = encodeURIComponent(pathname);
    return (
      <Page>
        <EmptyState
          icon={<Lock />}
          title="Önce giriş yapmalısın"
          description={reason ?? "Bu sayfa hesabına özel. Giriş yapınca kaldığın yerden devam edersin."}
        >
          <Link href={`/login?callbackUrl=${callback}`} className="btn btn-primary">
            Giriş yap
          </Link>
          <Link href="/register" className="btn btn-outline">
            Hesap oluştur
          </Link>
        </EmptyState>
      </Page>
    );
  }

  return <>{children}</>;
}
