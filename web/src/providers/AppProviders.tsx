"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/context/ThemeContext";

/** Oturum, tema ve bildirimler: tüm sayfaların ortak sarmalayıcısı. */
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: "0.9rem",
              boxShadow: "var(--elev-2)",
              fontSize: "0.9rem",
              fontWeight: 500,
              padding: "0.7rem 0.95rem",
            },
            success: { iconTheme: { primary: "var(--mint)", secondary: "var(--surface)" } },
            error: { iconTheme: { primary: "var(--rose)", secondary: "var(--surface)" } },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
