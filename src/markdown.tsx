import type { ReactNode } from "react";

const CODE_INLINE = "rounded bg-black/[0.06] px-1 py-px font-mono text-sm dark:bg-white/10";

function inline(text: string, kp: string): ReactNode[] {
    const out: ReactNode[] = [];
    const re =
        /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/g;
    let last = 0;
    let n = 0;
    let m = re.exec(text);
    while (m) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const t = m[0];
        const key = `${kp}i${n++}`;
        if (t[0] === "`") {
            out.push(
                <code key={key} className={CODE_INLINE}>
                    {t.slice(1, -1)}
                </code>,
            );
        } else if (t.startsWith("**") || t.startsWith("__")) {
            out.push(
                <strong key={key} className="font-semibold">
                    {inline(t.slice(2, -2), key)}
                </strong>,
            );
        } else if (t[0] === "[") {
            const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
            out.push(
                lm ? (
                    <a
                        key={key}
                        href={lm[2]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                    >
                        {lm[1]}
                    </a>
                ) : (
                    t
                ),
            );
        } else {
            out.push(
                <em key={key} className="italic">
                    {inline(t.slice(1, -1), key)}
                </em>,
            );
        }
        last = m.index + t.length;
        m = re.exec(text);
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

function inlineLines(lines: string[], kp: string): ReactNode[] {
    const out: ReactNode[] = [];
    for (let k = 0; k < lines.length; k++) {
        if (k > 0) out.push(<br key={`${kp}br${k}`} />);
        out.push(...inline(lines[k] ?? "", `${kp}l${k}`));
    }
    return out;
}

const BLOCK_START = /^```|^#{1,6}\s|^>\s?|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^(?:---+|\*\*\*+|___+)\s*$/;

export function Markdown({ content, className }: { content: string; className?: string }) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const at = (n: number): string => lines[n] ?? "";
    const blocks: ReactNode[] = [];
    let i = 0;
    let b = 0;
    while (i < lines.length) {
        const line = at(i);
        const key = `b${b++}`;
        if (!line.trim()) {
            i++;
            continue;
        }
        if (/^```/.test(line)) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(at(i))) {
                code.push(at(i));
                i++;
            }
            i++;
            blocks.push(
                <pre
                    key={key}
                    className="overflow-x-auto rounded-lg bg-black/[0.06] p-3 font-mono text-sm leading-relaxed dark:bg-white/10"
                >
                    <code>{code.join("\n")}</code>
                </pre>,
            );
            continue;
        }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            const lvl = (h[1] ?? "").length;
            const cls =
                lvl <= 1
                    ? "text-lg font-semibold"
                    : lvl === 2
                      ? "text-base font-semibold"
                      : "font-semibold";
            blocks.push(
                <div key={key} className={cls}>
                    {inline(h[2] ?? "", key)}
                </div>,
            );
            i++;
            continue;
        }
        if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
            blocks.push(<hr key={key} className="border-border" />);
            i++;
            continue;
        }
        if (/^>\s?/.test(line)) {
            const q: string[] = [];
            while (i < lines.length && /^>\s?/.test(at(i))) {
                q.push(at(i).replace(/^>\s?/, ""));
                i++;
            }
            blocks.push(
                <blockquote
                    key={key}
                    className="border-l-2 border-border pl-3 text-muted-foreground"
                >
                    {inlineLines(q, key)}
                </blockquote>,
            );
            continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            const lis: ReactNode[] = [];
            let k = 0;
            while (i < lines.length && /^\s*[-*+]\s+/.test(at(i))) {
                const item = at(i).replace(/^\s*[-*+]\s+/, "");
                lis.push(<li key={`${key}li${k}`}>{inline(item, `${key}li${k}`)}</li>);
                k++;
                i++;
            }
            blocks.push(
                <ul key={key} className="list-disc space-y-0.5 pl-5">
                    {lis}
                </ul>,
            );
            continue;
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const lis: ReactNode[] = [];
            let k = 0;
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(at(i))) {
                const item = at(i).replace(/^\s*\d+[.)]\s+/, "");
                lis.push(<li key={`${key}li${k}`}>{inline(item, `${key}li${k}`)}</li>);
                k++;
                i++;
            }
            blocks.push(
                <ol key={key} className="list-decimal space-y-0.5 pl-5">
                    {lis}
                </ol>,
            );
            continue;
        }
        const para: string[] = [];
        while (i < lines.length && at(i).trim() && !BLOCK_START.test(at(i))) {
            para.push(at(i));
            i++;
        }
        blocks.push(
            <p key={key} className="leading-relaxed">
                {inlineLines(para, key)}
            </p>,
        );
    }
    return <div className={className ?? "space-y-2 break-words"}>{blocks}</div>;
}
