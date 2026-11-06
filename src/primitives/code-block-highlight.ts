import type { StreamParser } from "@codemirror/streamparser";
import { StringStream } from "@codemirror/streamparser";
import { Tag, highlightCode, tags } from "@lezer/highlight";

import type { CodeLanguage, CodeToken } from "./code-block";
import { codeHighlighter } from "./code-highlight";

type Highlight = (code: string) => CodeToken[];

type Tree = Parameters<typeof highlightCode>[1];

type TreeParser = { parse: (input: string) => Tree };

const TAB_SIZE = 4;

const INDENT_UNIT = 2;

const LEGACY_NAMES: Record<string, string> = {
    variable: "variableName",
    "variable-2": "variableName.special",
    "string-2": "string.special",
    def: "variableName.definition",
    tag: "tagName",
    attribute: "attributeName",
    type: "typeName",
    builtin: "variableName.standard",
    qualifier: "modifier",
    error: "invalid",
    header: "heading",
    property: "propertyName",
};

const TAG_NAMES = tags as unknown as Record<string, Tag | ((tag: Tag) => Tag) | undefined>;

const BREAK: CodeToken = { text: "\n", className: "" };

function legacyTags(style: string): Tag[] {
    const found: Tag[] = [];
    for (const name of style.split(" ")) {
        const [base = "", ...modifiers] = (LEGACY_NAMES[name] ?? name).split(".");
        let tag = TAG_NAMES[base];
        if (!(tag instanceof Tag)) continue;
        for (const modifier of modifiers) {
            const apply = TAG_NAMES[modifier];
            if (typeof apply === "function") tag = apply(tag);
        }
        found.push(tag);
    }
    return found;
}

function readToken<State>(mode: StreamParser<State>, stream: StringStream, state: State) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const style = mode.token(stream, state);
        if (stream.pos > stream.start) return style;
    }
    stream.next();
    return null;
}

function streamTokens<State>(mode: StreamParser<State>): Highlight {
    return (code) => {
        const out: CodeToken[] = [];
        const state = mode.startState ? mode.startState(INDENT_UNIT) : (true as State);
        code.split("\n").forEach((line, index) => {
            if (index > 0) out.push(BREAK);
            const stream = new StringStream(line, TAB_SIZE, INDENT_UNIT);
            if (!line) mode.blankLine?.(state, INDENT_UNIT);
            while (!stream.eol()) {
                const style = readToken(mode, stream, state);
                const className = style ? codeHighlighter.style(legacyTags(style)) : null;
                out.push({ text: stream.current(), className: className ?? "" });
                stream.start = stream.pos;
            }
        });
        return out;
    };
}

function treeTokens(parser: TreeParser): Highlight {
    return (code) => {
        const out: CodeToken[] = [];
        highlightCode(
            code,
            parser.parse(code),
            codeHighlighter,
            (text, className) => out.push({ text, className }),
            () => out.push(BREAK),
        );
        return out;
    };
}

const LOADERS: Record<Exclude<CodeLanguage, "text">, () => Promise<Highlight>> = {
    bash: () =>
        import("@codemirror/legacy-modes/mode/shell").then((module) => streamTokens(module.shell)),
    python: () => import("@lezer/python").then((module) => treeTokens(module.parser)),
    javascript: () => import("@lezer/javascript").then((module) => treeTokens(module.parser)),
    typescript: () =>
        import("@lezer/javascript").then((module) =>
            treeTokens(module.parser.configure({ dialect: "ts" })),
        ),
    json: () => import("@lezer/json").then((module) => treeTokens(module.parser)),
    yaml: () => import("@lezer/yaml").then((module) => treeTokens(module.parser)),
    sql: () =>
        import("./sql-editor-setup").then((module) => treeTokens(module.DuckDB.language.parser)),
};

function loadHighlight(language: Exclude<CodeLanguage, "text">): Promise<Highlight> {
    return LOADERS[language]();
}

export { type Highlight, loadHighlight };
