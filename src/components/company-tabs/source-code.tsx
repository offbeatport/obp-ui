import { File, Folder, GitBranch } from "lucide-react";
import { useState } from "react";
import type { CompanyTabProps } from "~/components/company-tabs/types";

// The "Source Code" tab: a lightweight, read-only repo viewer (file tree + file
// viewer + version bar). There is no real repo data yet, so this renders an
// HONEST preview — a representative scaffold derived from the spec's stack,
// clearly labeled as a skeleton until the build loop pushes its first commit.

type Lang = "ts" | "tsx" | "json" | "md";
type Node = {
    name: string;
    path: string;
    type: "dir" | "file";
    depth: number;
    lang?: Lang;
    snippet?: string;
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function dir(path: string, depth: number): Node {
    return { name: path.split("/").pop() ?? path, path, type: "dir", depth };
}
function file(path: string, depth: number, lang: Lang, snippet: string): Node {
    return { name: path.split("/").pop() ?? path, path, type: "file", depth, lang, snippet };
}

// Build a REPRESENTATIVE scaffold tree from the spec stack (a preview skeleton,
// not live repo data). Files are toggled on by what the stack implies.
function scaffold(stack: string[]): Node[] {
    const s = stack.map((x) => x.toLowerCase()).join(" ");
    const has = (...keys: string[]) => keys.some((k) => s.includes(k));
    const stripe = has("stripe");
    const db = has("sqlite", "drizzle", "postgres", "prisma", "turso", "database", "db");

    const nodes: Node[] = [
        file("package.json", 0, "json", PKG),
        file("README.md", 0, "md", README),
        dir("src", 0),
        dir("src/routes", 1),
        file("src/routes/index.tsx", 2, "tsx", INDEX_ROUTE),
    ];
    if (stripe) nodes.push(file("src/routes/checkout.ts", 2, "ts", CHECKOUT));
    if (db) {
        nodes.push(dir("src/db", 1), file("src/db/schema.ts", 2, "ts", SCHEMA));
    }
    nodes.push(dir("src/components", 1), file("src/components/App.tsx", 2, "tsx", APP));
    nodes.push(dir("src/lib", 1));
    if (stripe) nodes.push(file("src/lib/stripe.ts", 2, "ts", STRIPE));
    nodes.push(file("src/lib/env.ts", 2, "ts", ENV));
    return nodes;
}

const KEYWORDS = new Set([
    "export",
    "import",
    "from",
    "const",
    "let",
    "var",
    "function",
    "return",
    "async",
    "await",
    "type",
    "interface",
    "new",
    "class",
    "extends",
    "default",
    "as",
]);

// Tiny hand-rolled syntax tint: comments faint, strings green, keywords tinted.
function CodeLine({ text, lang }: { text: string; lang: Lang }) {
    if (lang === "md") {
        if (/^#{1,6}\s/.test(text))
            return <span className="font-semibold text-foreground">{text}</span>;
        if (/^\s*[-*]\s/.test(text)) return <span className="text-muted-foreground">{text}</span>;
        return <span className="text-muted-foreground">{text}</span>;
    }
    const ci = text.indexOf("//");
    const code = ci >= 0 ? text.slice(0, ci) : text;
    const comment = ci >= 0 ? text.slice(ci) : "";
    const tokens = code.split(/(\s+|[{}()[\];:,.<>=?]+|"[^"]*"|'[^']*'|`[^`]*`)/);
    return (
        <span>
            {tokens.map((tok, i) => {
                if (!tok) return null;
                const key = i; // stable: token stream is static, never reordered
                if (/^["'`]/.test(tok))
                    return (
                        <span key={key} className="text-success">
                            {tok}
                        </span>
                    );
                if (KEYWORDS.has(tok))
                    return (
                        <span key={key} className="text-primary">
                            {tok}
                        </span>
                    );
                return <span key={key}>{tok}</span>;
            })}
            {comment && <span className="text-faint">{comment}</span>}
        </span>
    );
}

export function SourceCodeTab(props: CompanyTabProps) {
    const { co } = props;
    // No spec at all → clean empty state, no fabricated repo.
    if (!co.spec) {
        return (
            <div className="grid h-[min(560px,64vh)] place-items-center rounded-xl border border-border bg-card">
                <div className="text-center">
                    <File className="mx-auto size-8 text-faint" />
                    <h3 className="mt-3 font-display text-lg">No source yet</h3>
                    <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                        This company hasn&apos;t been scaffolded.
                    </p>
                </div>
            </div>
        );
    }
    return <RepoView co={co} />;
}

// Split out so hooks run unconditionally once a spec is guaranteed present.
function RepoView({ co }: { co: CompanyTabProps["co"] }) {
    const nodes = scaffold(co.spec?.stack ?? []);
    const firstFile = nodes.find((n) => n.type === "file");
    const [sel, setSel] = useState<string>(firstFile?.path ?? "");
    const active = nodes.find((n) => n.path === sel && n.type === "file") ?? firstFile;
    const lines = (active?.snippet ?? "").split("\n");

    return (
        <div className="flex flex-col gap-2.5">
            {/* Version / branch bar */}
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-[12px] text-muted-foreground">
                {co.gitRemote ? (
                    <>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-1 font-mono text-[11px] text-accent-foreground">
                            <GitBranch className="size-3.5" /> main
                        </span>
                        <a
                            href={co.gitRemote}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11.5px] text-foreground underline-offset-2 hover:underline"
                        >
                            {co.gitRemote}
                        </a>
                    </>
                ) : (
                    <span className="inline-flex items-center gap-1.5">
                        <GitBranch className="size-3.5 text-faint" /> Repository not initialized yet
                    </span>
                )}
                <span className="ml-auto font-mono text-[11px] text-faint">
                    Preview — the live repository appears here once the build loop pushes its first
                    commit.
                </span>
            </div>

            {/* Two-pane IDE */}
            <div className="grid h-[min(560px,64vh)] grid-cols-[186px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border">
                {/* Explorer */}
                <aside className="flex min-h-0 flex-col border-r border-border bg-secondary">
                    <div className="border-b border-border px-3 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                        Explorer · {co.name}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
                        {nodes.map((n) =>
                            n.type === "dir" ? (
                                <div
                                    key={n.path}
                                    className="flex items-center gap-1.5 py-1 pr-2 font-mono text-[12.5px] text-foreground/80"
                                    style={{ paddingLeft: 8 + n.depth * 13 }}
                                >
                                    <Folder className="size-3.5 flex-none text-primary/70" />
                                    <span className="truncate">{n.name}</span>
                                </div>
                            ) : (
                                <button
                                    key={n.path}
                                    type="button"
                                    onClick={() => setSel(n.path)}
                                    style={{ paddingLeft: 8 + n.depth * 13 }}
                                    className={cx(
                                        "flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-[12.5px] transition-colors",
                                        active?.path === n.path
                                            ? "bg-accent font-semibold text-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    )}
                                >
                                    <File className="size-3.5 flex-none text-faint" />
                                    <span className="truncate">{n.name}</span>
                                </button>
                            ),
                        )}
                    </div>
                </aside>

                {/* Editor */}
                <main className="flex min-h-0 min-w-0 flex-col bg-card">
                    {/* Titlebar: traffic-light dots + path */}
                    <div className="flex items-center gap-2.5 border-b border-border bg-secondary px-3 py-2">
                        <span className="flex gap-1.5">
                            <i className="size-2.5 rounded-full bg-destructive" />
                            <i className="size-2.5 rounded-full bg-warning" />
                            <i className="size-2.5 rounded-full bg-success" />
                        </span>
                        <span className="truncate font-mono text-[12px] text-muted-foreground">
                            {active?.path ?? "—"}
                        </span>
                    </div>
                    {/* Tabbar (single open file) */}
                    <div className="flex border-b border-border bg-secondary">
                        <span className="flex items-center gap-1.5 border-r border-border bg-card px-3 py-1.5 font-mono text-[11.5px] text-foreground">
                            <span className="size-1.5 rounded-full bg-primary/60" />
                            {active?.name ?? "untitled"}
                        </span>
                    </div>
                    {/* Read-only code viewer with line gutter */}
                    <div className="flex min-h-0 flex-1 overflow-auto">
                        <div className="flex-none select-none border-r border-border bg-secondary px-3 py-3.5 text-right font-mono text-[12.5px] leading-[1.65] text-faint">
                            {lines.map((_, i) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: fixed line gutter
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        <div className="min-w-0 flex-1 px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] text-foreground">
                            {lines.map((ln, i) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: static source lines
                                <div key={i} className="whitespace-pre">
                                    {ln === "" ? (
                                        " "
                                    ) : (
                                        <CodeLine text={ln} lang={active?.lang ?? "ts"} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Preview snippet bodies — short, clearly-scaffold placeholders (not live code).
// ---------------------------------------------------------------------------

const PKG = `{
  "name": "app",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vinxi dev", "build": "vinxi build" },
  "dependencies": {}
}`;

const README = `# Preview scaffold

This is a representative source skeleton generated from the
spec's stack. The real repository replaces it once the build
loop scaffolds the app and pushes its first commit.`;

const INDEX_ROUTE = `import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  // landing route — replaced by the build loop
  return <main>hello</main>;
}`;

const CHECKOUT = `import { stripe } from "~/lib/stripe";

// POST /api/checkout — create a Stripe Checkout session.
export async function createCheckout(priceId: string) {
  return stripe.checkout.sessions.create({ mode: "subscription" });
}`;

const SCHEMA = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at"),
});`;

const APP = `export function App() {
  // top-level shell — routes render inside here.
  return <div className="app">scaffold preview</div>;
}`;

const STRIPE = `import Stripe from "stripe";

// Configured from env — no live keys in the preview.
export const stripe = new Stripe(process.env.STRIPE_KEY ?? "");`;

const ENV = `// Typed environment access — filled in by the build loop.
export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
};`;
