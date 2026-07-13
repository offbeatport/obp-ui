import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Logo, LogoMark } from "~/components/logo";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getTheme, onThemeChange, toggleTheme } from "~/lib/theme";

export const Route = createFileRoute("/branding")({
    component: Branding,
});

function Branding() {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const sync = () => setDark(getTheme() === "dark");
        sync();
        return onThemeChange(sync);
    }, []);

    return (
        <div className="mx-auto max-w-5xl px-6 py-12">
            <header className="mb-10 flex items-start justify-between gap-6">
                <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                        Brand
                    </div>
                    <Logo className="scale-125 origin-left" />
                    <p className="mt-5 max-w-xl font-serif text-[17px] italic text-muted-foreground">
                        From a thought to bag. Warm, editorial, a little literary - a terracotta
                        glow on paper.
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={toggleTheme}>
                    {dark ? <Sun /> : <Moon />}
                    {dark ? "Light" : "Dark"}
                </Button>
            </header>

            <Section title="Logo" hint="The Glow-C wordmark (V7)">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Tile>
                        <Logo />
                    </Tile>
                    <Tile dark>
                        <Logo />
                    </Tile>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Tile>
                        <LogoMark className="size-12 rounded-xl text-xl" />
                    </Tile>
                    <Tile dark>
                        <LogoMark className="size-12 rounded-xl text-xl" />
                    </Tile>
                    <Tile>
                        <LogoMark />
                    </Tile>
                    <Tile dark>
                        <LogoMark />
                    </Tile>
                </div>
                <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                    The <b>mark</b> (glowing C block) is theme-independent and reads on any surface
                    - use it collapsed, at favicon scale, or on-dark. The full <b>wordmark</b>{" "}
                    adapts: braces + text follow the foreground; keep the terracotta glow intact.
                </p>
            </Section>

            <Section title="Color" hint="Terracotta on paper + the status language">
                <SubLabel>Brand & surfaces</SubLabel>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Swatch
                        name="primary"
                        hex="#c8643c"
                        className="bg-primary"
                        fg="text-primary-foreground"
                    />
                    <Swatch name="background" hex="#f7f3ec" className="bg-background" />
                    <Swatch name="card" hex="#fffdf8" className="bg-card" />
                    <Swatch
                        name="ink"
                        hex="#2c2926"
                        className="bg-foreground"
                        fg="text-background"
                    />
                </div>
                <SubLabel className="mt-6">Status</SubLabel>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Swatch name="success" className="bg-success" fg="text-success-foreground" />
                    <Swatch name="info" className="bg-info" fg="text-info-foreground" />
                    <Swatch name="approval" className="bg-approval" fg="text-approval-foreground" />
                    <Swatch name="warning" className="bg-warning" fg="text-warning-foreground" />
                    <Swatch name="neutral" className="bg-neutral" fg="text-neutral-foreground" />
                    <Swatch
                        name="destructive"
                        className="bg-destructive"
                        fg="text-destructive-foreground"
                    />
                </div>
            </Section>

            <Section title="Typography">
                <div className="space-y-3">
                    <p className="font-display text-4xl font-light tracking-tight">
                        Space Grotesk - display & headings
                    </p>
                    <p className="font-sans text-lg">Inter - the working body typeface.</p>
                    <p className="font-serif text-lg italic text-muted-foreground">
                        Spectral italic - editorial voice, theses, taglines.
                    </p>
                    <p className="font-mono text-sm text-muted-foreground">
                        JetBrains Mono - numbers, ids, code · $12,480 MRR · run 4a275959
                    </p>
                </div>
            </Section>

            <p className="mt-14 border-t pt-6 text-center text-xs text-faint">
                Logo component: <code className="font-mono">src/components/logo.tsx</code> · tokens
                in <code className="font-mono">src/styles/globals.css</code>
            </p>
        </div>
    );
}

function Tile({ dark, children }: { dark?: boolean; children: ReactNode }) {
    return (
        <div
            className={`${dark ? "dark " : ""}grid h-28 place-items-center rounded-xl border bg-background shadow-e1`}
        >
            {children}
        </div>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="mb-12">
            <div className="mb-4 flex items-baseline gap-3">
                <h2 className="font-display text-xl font-medium">{title}</h2>
                {hint && <span className="text-xs text-faint">{hint}</span>}
            </div>
            <Separator className="mb-5" />
            {children}
        </section>
    );
}

function SubLabel({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div
            className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint ${className ?? ""}`}
        >
            {children}
        </div>
    );
}

function Swatch({
    name,
    hex,
    className,
    fg = "text-foreground",
}: {
    name: string;
    hex?: string;
    className: string;
    fg?: string;
}) {
    return (
        <div
            className={`flex h-16 flex-col justify-end rounded-lg border p-2 shadow-e1 ${className}`}
        >
            <span className={`text-[11px] font-medium ${fg}`}>{name}</span>
            {hex && <span className={`font-mono text-[10px] ${fg} opacity-70`}>{hex}</span>}
        </div>
    );
}
