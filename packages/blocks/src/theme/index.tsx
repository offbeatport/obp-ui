import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
}

export function useTheme(storageKey = "app-theme") {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(storageKey) as Theme) ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  return { theme, setTheme: setThemeState };
}

export function ThemeScript({ storageKey = "app-theme" }: { storageKey?: string }) {
  const script = `(function(){var t=localStorage.getItem(${JSON.stringify(storageKey)});if(t==="dark")document.documentElement.setAttribute("data-theme","dark");else if(t==="light")document.documentElement.setAttribute("data-theme","light")})()`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional inline script for no-flash theme init
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

const CYCLE: Theme[] = ["light", "dark", "system"];
const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

export function ThemeToggle({ storageKey }: { storageKey?: string }) {
  const { theme, setTheme } = useTheme(storageKey);
  const Icon = ICONS[theme];
  const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]!;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${LABELS[next]} theme`}
      title={`${LABELS[theme]} - click for ${LABELS[next]}`}
      className="flex items-center justify-center w-8 h-8 text-fg-muted hover:text-fg hover:bg-hover transition-colors"
    >
      <Icon size={15} />
    </button>
  );
}
