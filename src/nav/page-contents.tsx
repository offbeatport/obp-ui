"use client";

import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type PageContentsItem = { id: string; label: string };

type Scroller = HTMLElement | Window;

const END_SLACK = 2;
const USER_SCROLL = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

function scrollerOf(element: HTMLElement | null): Scroller {
    let node = element?.parentElement ?? null;
    while (node) {
        const { overflowY } = getComputedStyle(node);
        if (overflowY === "auto" || overflowY === "scroll") {
            return node;
        }
        node = node.parentElement;
    }
    return window;
}

function frameOf(scroller: Scroller): { top: number; bottom: number; atEnd: boolean } {
    if (scroller instanceof Window) {
        const root = document.documentElement;
        return {
            top: 0,
            bottom: window.innerHeight,
            atEnd: window.innerHeight + window.scrollY >= root.scrollHeight - END_SLACK,
        };
    }
    const box = scroller.getBoundingClientRect();
    return {
        top: box.top,
        bottom: box.bottom,
        atEnd: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - END_SLACK,
    };
}

function visible(id: string, top: number, bottom: number): boolean {
    const box = document.getElementById(id)?.getBoundingClientRect();
    return Boolean(box && box.top < bottom && box.bottom > top);
}

function reached(items: PageContentsItem[], top: number, offset: number): string | undefined {
    let found = items[0]?.id;
    for (const item of items) {
        const box = document.getElementById(item.id)?.getBoundingClientRect();
        if (box && box.top - top <= offset) {
            found = item.id;
        }
    }
    return found;
}

function lastPresent(items: PageContentsItem[]): string | undefined {
    return [...items].reverse().find((item) => document.getElementById(item.id))?.id;
}

export function PageContents({
    items,
    title = "On this page",
    label = "Contents",
    offset = 96,
    className,
}: {
    items: PageContentsItem[];
    title?: string | null;
    label?: string;
    offset?: number;
    className?: string;
}) {
    const ref = useRef<HTMLElement>(null);
    const chosen = useRef<string | null>(null);
    const [active, setActive] = useState<string | undefined>(items[0]?.id);

    const measure = useCallback(
        (scroller: Scroller) => {
            const frame = frameOf(scroller);
            if (chosen.current && visible(chosen.current, frame.top, frame.bottom)) {
                setActive(chosen.current);
                return;
            }
            setActive(frame.atEnd ? lastPresent(items) : reached(items, frame.top, offset));
        },
        [items, offset],
    );

    useEffect(() => {
        const scroller = scrollerOf(ref.current);
        let frame = 0;
        const onScroll = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => measure(scroller));
        };
        const release = () => {
            chosen.current = null;
        };
        measure(scroller);
        scroller.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        for (const kind of USER_SCROLL) {
            window.addEventListener(kind, release, { passive: true });
        }
        return () => {
            cancelAnimationFrame(frame);
            scroller.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            for (const kind of USER_SCROLL) {
                window.removeEventListener(kind, release);
            }
        };
    }, [measure]);

    const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
        const target = document.getElementById(id);
        if (!target) {
            return;
        }
        event.preventDefault();
        chosen.current = id;
        setActive(id);
        target.scrollIntoView({ block: "start" });
    };

    return (
        <nav ref={ref} aria-label={label} className={cn("flex flex-col gap-2", className)}>
            {title && <p className="text-sm text-muted-foreground">{title}</p>}
            <ul className="flex flex-col border-l">
                {items.map((item) => {
                    const current = item.id === active;
                    return (
                        <li key={item.id} className="flex">
                            <a
                                href={`#${item.id}`}
                                aria-current={current ? "location" : undefined}
                                onClick={(event) => go(event, item.id)}
                                className={cn(
                                    "-ml-px flex min-h-8 min-w-0 flex-1 items-center border-l-2 py-1 pl-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    current
                                        ? "border-primary font-medium text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {item.label}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
