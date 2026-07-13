import { Link } from "@tanstack/react-router";
import { ChevronUp, LogOut, Moon, Plus, Settings2, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { getTheme, onThemeChange, toggleTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

// Rail-foot user button → dropdown (New company · theme · Settings · Sign out) per prototype.
export function UserMenu({ collapsed }: { collapsed?: boolean }) {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const sync = () => setDark(getTheme() === "dark");
        sync();
        return onThemeChange(sync);
    }, []);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-primary/[0.06]",
                        collapsed && "justify-center",
                    )}
                >
                    <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
                        V
                    </span>
                    {!collapsed && (
                        <>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold">Vlad</span>
                                <span className="block truncate text-[11px] text-faint">
                                    $0 MRR · 0 users
                                </span>
                            </span>
                            <ChevronUp className="size-4 flex-none text-faint" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuItem asChild>
                    <Link to="/">
                        <Plus /> New company
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => toggleTheme()}>
                    {dark ? <Sun /> : <Moon />} Switch to {dark ? "light" : "dark"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/settings">
                        <Settings2 /> Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <LogOut /> Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
