"use client";

import { useTheme } from "@/context/ThemeContext";

/**
 * Tema değiştirme düğmesi.
 *
 * HYDRATION UYUMSUZLUĞU DÜZELTİLDİ: bu bileşen hangi ikonu ve hangi
 * `aria-label`ı basacağına `tema` state'ine bakarak karar veriyordu.
 * Sunucuda `tema` her zaman "light" (document yok), istemcide ise
 * `<head>`'deki satır-içi script koyu temayı çoktan uygulamış olabiliyor.
 * Sonuç, HER SAYFA YÜKLENİŞİNDE React hydration hatasıydı.
 *
 * Çözüm: işaretleme artık temadan BAĞIMSIZ. İki ikon da basılıyor,
 * hangisinin görüneceğine CSS karar veriyor (`.dark` sınıfı zaten
 * hydration'dan önce doğru). Etiket de sabit — "Temayı değiştir" iki
 * durumda da doğru. Böylece sunucu ve istemci çıktısı birebir aynı.
 */
export default function ThemeToggle() {
  const { temaDegistir } = useTheme();

  return (
    <button
      type="button"
      onClick={temaDegistir}
      className="p-2.5 rounded-[var(--radius)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label="Temayı değiştir"
      title="Temayı değiştir"
    >
      {/* Ay — açık temada görünür, "karanlığa geç" anlamına gelir. */}
      <svg
        className="h-5 w-5 dark:hidden"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>

      {/* Güneş — koyu temada görünür, "aydınlığa geç" anlamına gelir. */}
      <svg
        className="h-5 w-5 hidden dark:block"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
