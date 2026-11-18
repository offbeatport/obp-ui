import type { EditorState } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";

type Formatter = (text: string) => string | Promise<string>;

const SVG = "http://www.w3.org/2000/svg";

const CHEVRON_DOWN = "M6 9l6 6l6 -6";
const CHEVRON_RIGHT = "M9 6l6 6l-6 6";

function isMac() {
    return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

function formatKeys() {
    return isMac() ? "⇧⌥F" : "Shift+Alt+F";
}

function isFormatKey(event: KeyboardEvent) {
    return (
        event.code === "KeyF" && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
    );
}

function chevron(open: boolean) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", open ? CHEVRON_DOWN : CHEVRON_RIGHT);
    svg.append(path);
    const marker = document.createElement("span");
    marker.className = open ? "cm-foldMarker cm-foldMarker-open" : "cm-foldMarker";
    marker.title = open ? "Fold" : "Unfold";
    marker.append(svg);
    return marker;
}

function foldedPlaceholder(view: EditorView, onclick: (event: Event) => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-foldPlaceholder";
    button.textContent = "…";
    button.setAttribute("aria-label", view.state.phrase("unfold"));
    button.onclick = onclick;
    return button;
}

function starterHint(starter: string) {
    const hint = document.createElement("span");
    hint.className = "cm-starter";
    const text = document.createElement("span");
    text.textContent = starter;
    const key = document.createElement("kbd");
    key.className = "cm-starterKey";
    key.textContent = "Tab";
    hint.append(text, key);
    return hint;
}

function starterKeymap(read: () => string | undefined) {
    return keymap.of([
        {
            key: "Tab",
            run: (view) => {
                const starter = read();
                if (!starter || view.state.doc.length > 0 || view.state.readOnly) return false;
                view.dispatch({
                    changes: { from: 0, insert: starter },
                    selection: { anchor: starter.length },
                    userEvent: "input",
                });
                return true;
            },
        },
    ]);
}

function runnableText(state: EditorState) {
    const range = state.selection.main;
    return range.empty ? state.doc.toString() : state.sliceDoc(range.from, range.to);
}

function solidBefore(text: string, position: number) {
    let count = 0;
    for (let index = 0; index < position; index++) {
        if (!/\s/.test(text[index] ?? "")) count++;
    }
    return count;
}

function positionAfter(text: string, solid: number) {
    if (solid === 0) return 0;
    let count = 0;
    for (let index = 0; index < text.length; index++) {
        if (!/\s/.test(text[index] ?? "")) count++;
        if (count === solid) return index + 1;
    }
    return text.length;
}

function mappedCursor(before: string, after: string, head: number) {
    return positionAfter(after, solidBefore(before, head));
}

function shortError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    const first = text.split("\n")[0] ?? text;
    return first.replace(/\s*This likely happens.*$/, "").trim();
}

export {
    chevron,
    foldedPlaceholder,
    type Formatter,
    formatKeys,
    isFormatKey,
    mappedCursor,
    runnableText,
    shortError,
    starterHint,
    starterKeymap,
};
