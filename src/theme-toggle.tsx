"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { type ThemeController, theme as defaultTheme } from "./lib/theme";
import { Button } from "./primitives";

export function ThemeToggle({ theme = defaultTheme }: { theme?: ThemeController } = {}) {
    const [dark, setDark] = useState(false);

    // Read the real theme after mount (SSR renders the light default) and keep in
    // sync with any other toggle on the page.
    useEffect(() => {
        const sync = () => setDark(theme.getTheme() === "dark");
        sync();
        return theme.onThemeChange(sync);
    }, [theme]);

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={theme.toggleTheme}
            aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
        >
            {dark ? <Sun /> : <Moon />}
            {dark ? "Light" : "Dark"}
        </Button>
    );
}
