"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { type ThemeController, theme as defaultTheme } from "./lib/theme";
import { Button } from "./primitives";

export function ThemeToggle({ theme = defaultTheme }: { theme?: ThemeController } = {}) {
    const [dark, setDark] = useState(false);

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
            {dark ? <IconSun /> : <IconMoon />}
            {dark ? "Light" : "Dark"}
        </Button>
    );
}
