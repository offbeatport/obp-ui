import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "reportfuse-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
  } else if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
  }

  return { theme, setTheme };
}

// Apply theme immediately on script load to prevent flash
export function ThemeScript() {
  const script = `(function(){var t=localStorage.getItem("${STORAGE_KEY}");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");else if(t==="light")document.documentElement.setAttribute("data-theme","light")})()`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline script for no-flash theme init
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
