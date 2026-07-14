/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import globalsCss from "../styles/globals.css?url";

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "C Slop Slop" },
        ],
        links: [
            {
                rel: "icon",
                type: "image/svg+xml",
                href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23c8643c'/%3E%3Ctext x='16' y='23' font-size='21' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'%3EC%3C/text%3E%3C/svg%3E",
            },
            { rel: "stylesheet", href: globalsCss },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap",
            },
        ],
        // apply the persisted theme before first paint (no flash of the wrong theme)
        scripts: [
            {
                children:
                    "try{var d=document.documentElement;var t=localStorage.getItem('cslopslop-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');if(localStorage.getItem('cslopslop-console-tab')==='off')d.classList.add('console-tab-off')}catch(e){}",
            },
        ],
    }),
    component: RootComponent,
});

function RootComponent() {
    return (
        <RootDocument>
            <Outlet />
        </RootDocument>
    );
}

function RootDocument({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body
                style={{
                    margin: 0,
                    fontFamily: "var(--font-sans)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                }}
            >
                {children}
                <Scripts />
            </body>
        </html>
    );
}
