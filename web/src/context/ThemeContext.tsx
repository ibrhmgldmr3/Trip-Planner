"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type Tema = "light" | "dark";

/** localStorage anahtarı - layout.tsx'teki inline tema script'i ile aynı olmalı. */
export const TEMA_ANAHTARI = "theme";

interface ThemeContextTipi {
  tema: Tema;
  temaDegistir: () => void;
  temaAyarla: (tema: Tema) => void;
}

const ThemeContext = createContext<ThemeContextTipi | undefined>(undefined);

/** Kayıtlı tema tercihini okur; depolama engelliyse null döner. */
function kayitliTemayiOku(): Tema | null {
  try {
    const deger = window.localStorage.getItem(TEMA_ANAHTARI);
    return deger === "light" || deger === "dark" ? deger : null;
  } catch {
    return null;
  }
}

/** Tema tercihini kalıcı hale getirir. */
function temayiKaydet(tema: Tema) {
  try {
    window.localStorage.setItem(TEMA_ANAHTARI, tema);
  } catch {
    // Depolama engelliyse tercih kalıcı olmaz; sayfa yine de çalışır.
  }
}

/** <html> üzerindeki .dark sınıfını temayla senkronlar. */
function sinifiUygula(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "dark");
}

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  // Başlangıç değeri DOM'dan okunur: <head>'deki inline script sınıfı
  // hydration'dan önce bastığı için bu her zaman doğru değeri verir.
  // Sunucuda document yoktur; "light" yalnızca SSR anlık değeridir.
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Hydration sonrası state'i DOM ile bir kez daha hizala.
  useEffect(() => {
    const mevcut: Tema = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTema((onceki) => (onceki === mevcut ? onceki : mevcut));
  }, []);

  // Kullanıcı açıkça bir seçim yapmadıysa sistem tercihini izlemeye devam et.
  useEffect(() => {
    const sorgu = window.matchMedia("(prefers-color-scheme: dark)");
    const dinleyici = (olay: MediaQueryListEvent) => {
      // Kayıtlı tercih varsa sistem değişimi yok sayılır.
      if (kayitliTemayiOku() !== null) return;
      const yeniTema: Tema = olay.matches ? "dark" : "light";
      sinifiUygula(yeniTema);
      setTema(yeniTema);
    };
    sorgu.addEventListener("change", dinleyici);
    return () => sorgu.removeEventListener("change", dinleyici);
  }, []);

  // Yalnızca kullanıcı eylemiyle çağrılır; bu yüzden localStorage'a yazmak
  // sistem tercihi takibini bilinçli olarak sonlandırır.
  const temaAyarla = useCallback((yeniTema: Tema) => {
    sinifiUygula(yeniTema);
    temayiKaydet(yeniTema);
    setTema(yeniTema);
  }, []);

  const temaDegistir = useCallback(() => {
    setTema((onceki) => {
      const yeniTema: Tema = onceki === "dark" ? "light" : "dark";
      sinifiUygula(yeniTema);
      temayiKaydet(yeniTema);
      return yeniTema;
    });
  }, []);

  const deger = useMemo(
    () => ({ tema, temaDegistir, temaAyarla }),
    [tema, temaDegistir, temaAyarla]
  );

  return <ThemeContext.Provider value={deger}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme yalnızca ThemeProvider içinde kullanılabilir");
  }
  return context;
}
