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
import { getPortfolioMetrics } from "~/server/data";
import { type Identity, getIdentity } from "~/server/identity";

// Rail-foot user button → dropdown (New company · theme · Settings · Sign out) per prototype.
export function UserMenu({ collapsed }: { collapsed?: boolean }) {
    const [dark, setDark] = useState(false);
    const [me, setMe] = useState<Identity | null>(null);
    const [sub, setSub] = useState("");

    useEffect(() => {
        const sync = () => setDark(getTheme() === "dark");
        sync();
        return onThemeChange(sync);
    }, []);

    useEffect(() => {
        void getIdentity().then(setMe);
        void getPortfolioMetrics().then((m) => setSub(`$${m.mrr} MRR · ${m.users} users`));
    }, []);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "mt-2 flex w-full items-center gap-2.5 rounded-lg p-1 px-3 pb-2 text-left hover:bg-primary/[0.1] hover:text-foreground",
                        collapsed && "justify-center",
                    )}
                >
                    <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
                        {me?.initial ?? "C"}
                    </span>
                    {!collapsed && (
                        <>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold">
                                    {me?.name ?? "You"}
                                </span>
                                <span className="block truncate text-[11px] text-faint">{sub}</span>
                            </span>
                            <ChevronUp className="size-4 flex-none text-faint" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
                <DropdownMenuItem asChild>
                    <Link to="/companies/new">
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
                {/* Self-host is a single local principal — nothing to sign out of. */}
                {me?.deployment === "hosted" && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <LogOut /> Sign out
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
