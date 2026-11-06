import { tagHighlighter, tags } from "@lezer/highlight";

const codeHighlighter = tagHighlighter([
    { tag: [tags.null, tags.atom, tags.bool, tags.number], class: "text-syntax-number" },
    { tag: tags.keyword, class: "text-syntax-keyword" },
    { tag: [tags.string, tags.regexp, tags.escape], class: "text-syntax-string" },
    { tag: [tags.comment, tags.meta], class: "text-syntax-comment" },
    {
        tag: [
            tags.function(tags.variableName),
            tags.function(tags.propertyName),
            tags.function(tags.definition(tags.variableName)),
            tags.standard(tags.variableName),
            tags.standard(tags.name),
            tags.typeName,
            tags.className,
            tags.macroName,
        ],
        class: "text-syntax-function",
    },
    {
        tag: [tags.propertyName, tags.attributeName, tags.definition(tags.variableName)],
        class: "text-syntax-property",
    },
    { tag: tags.operator, class: "text-syntax-operator" },
    { tag: tags.punctuation, class: "text-syntax-punctuation" },
    { tag: tags.invalid, class: "text-destructive" },
]);

export { codeHighlighter };
