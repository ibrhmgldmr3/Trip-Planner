// Tema sabitleri. Sunucu bileşeni (layout) ve istemci (ThemeContext) ortak kullanır;
// bu yüzden "use client" içermeyen ayrı bir modülde durur.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "trip-planner-theme";

/**
 * İlk boyamadan önce çalışıp <html data-theme> değerini ayarlayan betik.
 * Kayıtlı tercih yoksa sistem tercihine uyar; böylece tema yanıp sönmez.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
