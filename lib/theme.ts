export const THEME_STORAGE_KEY = "theme";

/** Saved light/dark wins. Anything else, including a first visit, follows the OS. */
export function resolveTheme(stored: string | null, systemDark: boolean): "light" | "dark" {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

/**
 * Blocking pre-paint boot. Must stay equivalent to resolveTheme:
 * tests run this string against a fake document.
 */
export const themeBootScript = `(function(){try{var stored=null;try{stored=localStorage.getItem("${THEME_STORAGE_KEY}");}catch(e){}var systemDark=false;try{systemDark=matchMedia("(prefers-color-scheme: dark)").matches;}catch(e){}var theme=stored==="light"||stored==="dark"?stored:(systemDark?"dark":"light");var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(theme);root.style.colorScheme=theme;}catch(e){}})();`;
