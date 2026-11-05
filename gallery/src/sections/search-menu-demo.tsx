import { HighlightText, SearchMenu, type SearchMenuGroup, searchTerms } from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

type Setting = { id: string; page: string; section: string; label: string; description: string };

const SETTINGS: Setting[] = [
    {
        id: "retention",
        page: "Security",
        section: "Request logs",
        label: "Log retention (days)",
        description: "Request logs older than this are deleted.",
    },
    {
        id: "idle",
        page: "Security",
        section: "Sign-in",
        label: "Sign-in idle timeout (minutes)",
        description: "People are signed out after this long without using the app.",
    },
    {
        id: "row-limit",
        page: "Data",
        section: "Version size",
        label: "Most rows in one version",
        description: "A larger query result is refused.",
    },
    {
        id: "bucket",
        page: "Storage",
        section: "Where artifacts live",
        label: "Bucket",
        description: "The S3-compatible bucket new artifacts go to.",
    },
];

function text(setting: Setting): string {
    return `${setting.label} ${setting.section} ${setting.description}`;
}

function groupsFor(query: string): SearchMenuGroup<Setting>[] {
    const terms = searchTerms(query);
    const hits = SETTINGS.filter((setting) =>
        terms.every((term) => text(setting).toLowerCase().includes(term)),
    );
    const pages = [...new Set(hits.map((setting) => setting.page))];
    return pages.map((page) => ({
        key: page,
        label: page,
        items: hits.filter((setting) => setting.page === page),
    }));
}

export function SearchMenuDemo() {
    const [query, setQuery] = useState("");
    const [picked, setPicked] = useState<Setting | null>(null);
    return (
        <Spec
            name="SearchMenu"
            note="A search field whose matches drop down under it, grouped. For finding one thing across a product: a setting, a page, a record. The caller filters and ranks; the menu highlights the first match, arrows move, Enter or a click picks, Escape clears."
        >
            <div className="flex max-w-xs flex-col gap-3">
                <SearchMenu
                    groups={groupsFor(query)}
                    query={query}
                    onQueryChange={setQuery}
                    itemKey={(setting) => setting.id}
                    itemText={text}
                    onPick={setPicked}
                    label="Search settings"
                    placeholder="Search settings"
                    shortcut="/"
                    empty="No setting matches. Try a broader word."
                    renderItem={(setting) => (
                        <>
                            <HighlightText
                                text={setting.label}
                                query={query}
                                className="font-medium"
                            />
                            <span className="line-clamp-2 text-muted-foreground">
                                <HighlightText text={setting.section} query={query} />
                                {" · "}
                                <HighlightText text={setting.description} query={query} />
                            </span>
                        </>
                    )}
                />
                <Note>{picked ? `Opened ${picked.page}, ${picked.label}.` : "Try “rows”."}</Note>
            </div>
            <Api
                items={[
                    {
                        name: "groups, query, onQueryChange",
                        note: "the matches for the current text, already filtered and ranked, in groups with a label each. The menu opens once the text is not blank.",
                    },
                    {
                        name: "renderItem, HighlightText",
                        note: "the row's content. HighlightText marks every term of the query in a string, case and accent insensitive, on --accent.",
                    },
                    {
                        name: "shortcut, inputRef",
                        note: "a key shown as a Kbd at the end of the empty field; the app binds the key and focuses inputRef.",
                    },
                    {
                        name: "empty",
                        note: "what to say when nothing matches: say so and suggest a broader word.",
                    },
                ]}
            />
        </Spec>
    );
}
