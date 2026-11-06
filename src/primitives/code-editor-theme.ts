import { EditorView } from "@codemirror/view";

import { CONTENT_PADDING, linesHeight } from "./code-editor-frame";

const RADIUS_CONTROL = "calc(var(--radius) - 2px)";

const field = {
    height: "1.75rem",
    padding: "0 0.5rem",
    border: "1px solid var(--input)",
    borderRadius: RADIUS_CONTROL,
    backgroundColor: "var(--input-background)",
    backgroundImage: "none",
    color: "var(--foreground)",
    font: "inherit",
};

const dot = {
    content: '""',
    display: "inline-block",
    flexShrink: "0",
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "9999px",
};

const editorTheme = EditorView.theme({
    "&": {
        flexGrow: "1",
        minHeight: "0",
        color: "inherit",
        backgroundColor: "transparent",
        borderRadius: "inherit",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
        fontFamily: "inherit",
        lineHeight: "inherit",
        overflow: "auto",
        borderRadius: "inherit",
    },
    ".cm-content": {
        padding: `calc(${CONTENT_PADDING} / 2) 0`,
        caretColor: "var(--foreground)",
    },
    ".cm-content ::selection, .cm-content::selection": {
        backgroundColor: "var(--primary)",
        color: "var(--primary-foreground)",
    },
    ".cm-line": { padding: "0 0.625rem 0 0.375rem" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
    ".cm-gutters": {
        backgroundColor: "transparent",
        color: "var(--faint)",
        border: "none",
        borderRight: "1px solid var(--border-soft)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "2ch",
        padding: "0 0.375rem 0 0",
        fontVariantNumeric: "tabular-nums",
    },
    ".cm-gutter-lint": { width: "1rem" },
    ".cm-gutter-lint .cm-gutterElement": {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "0",
    },
    ".cm-lint-marker": { ...dot, content: "none", marginTop: "calc((1lh - 0.5rem) / 2)" },
    ".cm-lint-marker-error": { backgroundColor: "var(--destructive)" },
    ".cm-lint-marker-warning": { backgroundColor: "var(--warning)" },
    ".cm-lint-marker-info": { backgroundColor: "var(--info)" },
    ".cm-lintRange": {
        backgroundImage: "none",
        paddingBottom: "0",
        textDecorationLine: "underline",
        textDecorationStyle: "wavy",
        textDecorationThickness: "1px",
        textDecorationSkipInk: "none",
        textUnderlineOffset: "3px",
    },
    ".cm-lintRange-error": { textDecorationColor: "var(--destructive)" },
    ".cm-lintRange-warning": { textDecorationColor: "var(--warning)" },
    ".cm-lintRange-info": { textDecorationColor: "var(--info)" },
    ".cm-lintRange-active": { backgroundColor: "var(--secondary)" },
    ".cm-lintPoint:after": { borderBottomColor: "var(--destructive)" },
    ".cm-lintPoint-warning:after": { borderBottomColor: "var(--warning)" },
    ".cm-lintPoint-info:after": { borderBottomColor: "var(--info)" },
    ".cm-tooltip": {
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        backgroundColor: "var(--popover)",
        color: "var(--popover-foreground)",
        boxShadow: "var(--shadow-e2)",
        overflow: "hidden",
    },
    ".cm-tooltip-lint": {
        maxWidth: "min(28rem, 90vw)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-sm)",
        lineHeight: "var(--type-sm-leading)",
    },
    ".cm-diagnostic": {
        display: "flex",
        alignItems: "baseline",
        gap: "0.5rem",
        margin: "0",
        padding: "0.375rem 0.625rem",
        border: "none",
    },
    ".cm-diagnostic::before": { ...dot, alignSelf: "center" },
    ".cm-diagnostic-error::before": { backgroundColor: "var(--destructive)" },
    ".cm-diagnostic-warning::before": { backgroundColor: "var(--warning)" },
    ".cm-diagnostic-info::before": { backgroundColor: "var(--info)" },
    ".cm-diagnostic + .cm-diagnostic": { borderTop: "1px solid var(--border-soft)" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        minWidth: "16rem",
        maxHeight: "16rem",
        padding: "0.25rem 0",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--type-sm)",
        lineHeight: "var(--type-sm-leading)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        display: "flex",
        alignItems: "baseline",
        gap: "0.75rem",
        padding: "0.375rem 0.625rem",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--secondary)",
        color: "var(--secondary-foreground)",
    },
    ".cm-tooltip-autocomplete-disabled ul li[aria-selected]": {
        backgroundColor: "var(--muted)",
    },
    ".cm-completionLabel": { flex: "1 1 auto", minWidth: "0" },
    ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
    ".cm-completionDetail, .cm-completionKind": {
        margin: "0",
        fontFamily: "var(--font-sans)",
        fontStyle: "normal",
        color: "var(--muted-foreground)",
    },
    ".cm-completionListIncompleteTop:before, .cm-completionListIncompleteBottom:after": {
        color: "var(--muted-foreground)",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "var(--accent)",
        color: "inherit",
    },
    ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
        backgroundColor: "transparent",
        color: "var(--destructive)",
    },
    ".cm-searchMatch": { backgroundColor: "var(--warning-soft)", outline: "none" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--accent)" },
    ".cm-panels": {
        backgroundColor: "var(--card)",
        color: "var(--foreground)",
        borderRadius: "inherit",
    },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
    ".cm-panel.cm-search, .cm-panel.cm-panel-lint": {
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-sm)",
    },
    ".cm-panel.cm-search": {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.375rem 0.5rem",
        padding: "0.375rem 2rem 0.375rem 0.5rem",
    },
    ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label": {
        margin: "0",
    },
    ".cm-panel.cm-search label": {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "inherit",
        color: "var(--muted-foreground)",
    },
    ".cm-panel.cm-search input[type=checkbox]": { accentColor: "var(--primary)" },
    ".cm-panel.cm-search br": { flexBasis: "100%", height: "0" },
    ".cm-textfield": { ...field, fontSize: "inherit" },
    ".cm-textfield:focus": {
        outline: "none",
        borderColor: "var(--ring)",
        boxShadow: "0 0 0 1px var(--ring)",
    },
    ".cm-button, .cm-button:active": { ...field, cursor: "pointer" },
    ".cm-button:hover": { backgroundColor: "var(--secondary)" },
    ".cm-button:focus-visible, .cm-panel [name=close]:focus-visible": {
        outline: "2px solid var(--ring)",
        outlineOffset: "1px",
    },
    ".cm-panel [name=close]": {
        top: "0.375rem",
        right: "0.5rem",
        width: "1.75rem",
        height: "1.75rem",
        borderRadius: RADIUS_CONTROL,
        color: "var(--muted-foreground)",
        cursor: "pointer",
    },
    ".cm-panel [name=close]:hover": {
        backgroundColor: "var(--secondary)",
        color: "var(--foreground)",
    },
    ".cm-panel.cm-panel-lint ul [aria-selected], .cm-panel.cm-panel-lint ul:focus [aria-selected]":
        {
            backgroundColor: "var(--secondary)",
            color: "var(--secondary-foreground)",
        },
});

function sizeTheme(minLines: number, maxLines: number) {
    return EditorView.theme({
        "&": { maxHeight: linesHeight(Math.max(minLines, maxLines)) },
        ".cm-content, .cm-gutter": { minHeight: linesHeight(minLines) },
    });
}

export { editorTheme, sizeTheme };
