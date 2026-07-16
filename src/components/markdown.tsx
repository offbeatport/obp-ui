import type { ReactNode } from "react";

// A small, dependency-free Markdown renderer for chat messages — handles the subset models actually
// emit: headings, bold/italic, inline + fenced code, links, bullet/ordered lists, blockquotes, and
// paragraphs (single newlines → line breaks). Builds React nodes, so there's no HTML injection.
// Not a full CommonMark parser; good enough for agent replies. Inherits font-size/color from parent.

const CODE_INLINE = "rounded bg-black/[0.06] px-1 py-px font-mono text-[0.85em] dark:bg-white/10";

// Inline spans: `code`, **bold**, __bold__, *italic*, _italic_, [text](url).
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

// Render several lines as one flow, single newlines becoming <br/>.
function inlineLines(lines: string[], kp: string): ReactNode[] {
    const out: ReactNode[] = [];
    for (let k = 0; k < lines.length; k++) {
        if (k > 0) out.push(<br key={`${kp}br${k}`} />);
        out.push(...inline(lines[k], `${kp}l${k}`));
    }
    return out;
}

const BLOCK_START = /^```|^#{1,6}\s|^>\s?|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^(?:---+|\*\*\*+|___+)\s*$/;

export function Markdown({ content, className }: { content: string; className?: string }) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const blocks: ReactNode[] = [];
    let i = 0;
    let b = 0;
    while (i < lines.length) {
        const line = lines[i];
        const key = `b${b++}`;
        if (!line.trim()) {
            i++;
            continue;
        }
        // fenced code block
        if (/^```/.test(line)) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                code.push(lines[i]);
                i++;
            }
            i++; // consume closing fence
            blocks.push(
                <pre
                    key={key}
                    className="overflow-x-auto rounded-lg bg-black/[0.06] p-3 font-mono text-[0.85em] leading-relaxed dark:bg-white/10"
                >
                    <code>{code.join("\n")}</code>
                </pre>,
            );
            continue;
        }
        // heading
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            const lvl = h[1].length;
            const cls =
                lvl <= 1
                    ? "text-[1.15em] font-semibold"
                    : lvl === 2
                      ? "text-[1.08em] font-semibold"
                      : "font-semibold";
            blocks.push(
                <div key={key} className={cls}>
                    {inline(h[2], key)}
                </div>,
            );
            i++;
            continue;
        }
        // horizontal rule
        if (/^(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
            blocks.push(<hr key={key} className="border-border" />);
            i++;
            continue;
        }
        // blockquote
        if (/^>\s?/.test(line)) {
            const q: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                q.push(lines[i].replace(/^>\s?/, ""));
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
        // unordered list
        if (/^\s*[-*+]\s+/.test(line)) {
            const lis: ReactNode[] = [];
            let k = 0;
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\s*[-*+]\s+/, "");
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
        // ordered list
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const lis: ReactNode[] = [];
            let k = 0;
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\s*\d+[.)]\s+/, "");
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
        // paragraph: consume consecutive plain lines
        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
            para.push(lines[i]);
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
