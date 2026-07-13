import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { getTheme, onThemeChange, toggleTheme } from "~/lib/theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Read the real theme after mount (SSR renders the light default) and keep in
  // sync with any other toggle on the page.
  useEffect(() => {
    const sync = () => setDark(getTheme() === "dark");
    sync();
    return onThemeChange(sync);
  }, []);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
    >
      {dark ? <Sun /> : <Moon />}
      {dark ? "Light" : "Dark"}
    </Button>
  );
}
