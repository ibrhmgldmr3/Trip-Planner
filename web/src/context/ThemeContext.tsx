"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Tarayıcı açılışında localStorage'dan veya kullanıcı sistem tercihini kontrol et
  useEffect(() => {
    // Hydration uyumsuzluğunu önlemek için CSR modunda olduğumuzu belirt
    setMounted(true);
    
    // Tailwind'in önerdiği yaklaşım kullanılarak localStorage'dan tema alınır
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  // Tema değiştirme fonksiyonu - Tailwind yaklaşımıyla
  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      
      // Tailwind'in önerdiği yaklaşım kullanılarak localStorage ve class güncellenir
      if (newTheme === 'dark') {
        localStorage.theme = 'dark';
        document.documentElement.classList.add('dark');
      } else {
        localStorage.theme = 'light';
        document.documentElement.classList.remove('dark');
      }
      
      return newTheme;
    });
  };
  
  // Tema değiştiğinde DOM'u güncelle
  useEffect(() => {
    if (!mounted) return;
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, mounted]);

  // SSR/CSR uyumsuzluğunu önlemek için mounted kontrolü
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
