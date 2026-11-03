import { cn } from "../lib/cn";

const CONTENT_PADDING = "0.75rem";

const SQL_EDITOR_LINES = { min: 3, max: 16 };

function sqlEditorFrame(className?: string) {
    return cn(
        "w-full min-w-0 rounded-md border border-input bg-input-background font-mono text-lg text-foreground md:text-sm",
        "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        "data-invalid:border-destructive data-invalid:ring-destructive",
        className,
    );
}

function linesHeight(lines: number) {
    return `calc(${lines}lh + ${CONTENT_PADDING})`;
}

export { CONTENT_PADDING, linesHeight, SQL_EDITOR_LINES, sqlEditorFrame };
