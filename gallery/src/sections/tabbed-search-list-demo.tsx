import { ChevronDown } from "lucide-react";
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    TabbedSearchList,
    type TabbedSearchListTab,
} from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

type Image = {
    id: string;
    name: string;
    tag: string;
    size: number;
    arch: "arm64" | "amd64";
    owner: "library" | "you";
};

const IMAGES: Image[] = [
    { id: "node-22", name: "node", tag: "22-slim", size: 74, arch: "arm64", owner: "library" },
    {
        id: "python-313",
        name: "python",
        tag: "3.13-slim",
        size: 46,
        arch: "arm64",
        owner: "library",
    },
    { id: "postgres-17", name: "postgres", tag: "17", size: 158, arch: "arm64", owner: "library" },
    { id: "redis-8", name: "redis", tag: "8-alpine", size: 17, arch: "arm64", owner: "library" },
    {
        id: "cuda-12",
        name: "nvidia/cuda",
        tag: "12.6-runtime",
        size: 1830,
        arch: "amd64",
        owner: "library",
    },
    {
        id: "pytorch",
        name: "pytorch/pytorch",
        tag: "2.7-cuda12",
        size: 3420,
        arch: "amd64",
        owner: "library",
    },
    { id: "nginx", name: "nginx", tag: "1.29-alpine", size: 21, arch: "arm64", owner: "library" },
    { id: "api", name: "acme/api", tag: "main", size: 212, arch: "arm64", owner: "you" },
    { id: "worker", name: "acme/worker", tag: "main", size: 388, arch: "amd64", owner: "you" },
];

const RECENT = ["api", "node-22"];

function ImageRow({ image }: { image: Image }) {
    return (
        <>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{image.name}</span>
                <span className="truncate font-mono text-muted-foreground">{image.tag}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">{`${image.size} MB`}</span>
            <Badge variant={image.arch === "arm64" ? "success" : "neutral"}>
                {image.arch === "arm64" ? "Runs here" : "Needs amd64"}
            </Badge>
        </>
    );
}

function PullPanel({ seed, onPull }: { seed: string; onPull: (name: string) => void }) {
    const [name, setName] = useState(seed.includes("/") || seed.includes(":") ? seed : "");
    return (
        <div className="flex flex-col gap-3">
            <Field id="g-pull" label="Image reference">
                <Input
                    id="g-pull"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="ghcr.io/acme/tool:1.4"
                    className="font-mono"
                />
            </Field>
            <div>
                <Button type="button" disabled={!name.trim()} onClick={() => onPull(name.trim())}>
                    Pull this image
                </Button>
            </div>
        </div>
    );
}

export function TabbedSearchListDemo() {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("suggested");
    const [arch, setArch] = useState("any");
    const [picked, setPicked] = useState<string>("node-22");
    const [pulled, setPulled] = useState<string | null>(null);
    const byId = (id: string) => IMAGES.filter((image) => image.id === id);
    const suggested = IMAGES.filter((image) => image.owner === "library");
    const tabs: TabbedSearchListTab<Image>[] = [
        {
            value: "suggested",
            label: "Suggested",
            groups: [
                { key: "recent", label: "Recently used", items: RECENT.flatMap(byId) },
                {
                    key: "here",
                    label: "Runs here",
                    items: suggested.filter((image) => image.arch === "arm64").slice(0, 3),
                },
                {
                    key: "more",
                    label: "Needs an amd64 machine",
                    items: suggested.filter((image) => image.arch === "amd64").slice(0, 2),
                },
            ],
        },
        {
            value: "all",
            label: "All images",
            toolbar: (
                <Select value={arch} onValueChange={(next) => setArch(String(next ?? "any"))}>
                    <SelectTrigger aria-label="Architecture" className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="any">Any architecture</SelectItem>
                        <SelectItem value="arm64">arm64</SelectItem>
                        <SelectItem value="amd64">amd64</SelectItem>
                    </SelectContent>
                </Select>
            ),
            groups: [
                {
                    key: "all",
                    items: IMAGES.filter((image) => arch === "any" || image.arch === arch),
                },
            ],
        },
        {
            value: "yours",
            label: "Yours",
            empty: "You have not pushed an image yet.",
            groups: [{ key: "yours", items: IMAGES.filter((image) => image.owner === "you") }],
        },
        {
            value: "pull",
            label: "Pull",
            matches: (query) => query.includes("/") || query.includes(":"),
            panel: (query) => (
                <PullPanel
                    seed={query}
                    onPull={(name) => {
                        setPulled(name);
                        setOpen(false);
                    }}
                />
            ),
        },
    ];
    const current = IMAGES.find((image) => image.id === picked);
    return (
        <Spec
            name="TabbedSearchList"
            note="One search field over tabs of lists, for picking one item that can come from a few places. The search filters every tab at once and each tab shows its matches; an empty tab points to the tabs that have some. A tab can hold labelled groups, a toolbar of filters, or a form instead of a list. Tab from the field reaches the tabs, arrows switch them and Arrow down returns to the field; in the field, arrows move the highlight, Enter picks and Escape clears, then closes the dialog."
        >
            <div className="flex flex-col items-start gap-3">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-72 justify-between">
                            <span className="truncate">
                                {pulled ?? (current ? `${current.name}:${current.tag}` : "Choose")}
                            </span>
                            <ChevronDown className="text-muted-foreground" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="flex h-[min(40rem,calc(100%-2rem))] flex-col sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Choose an image</DialogTitle>
                            <DialogDescription>
                                Suggested for this project, with what runs on this machine first.
                            </DialogDescription>
                        </DialogHeader>
                        <TabbedSearchList
                            tabs={tabs}
                            tab={tab}
                            onTabChange={setTab}
                            itemKey={(image) => image.id}
                            itemText={(image) => `${image.name} ${image.tag}`}
                            renderItem={(image) => <ImageRow image={image} />}
                            currentKey={pulled ? undefined : picked}
                            onPick={(image) => {
                                setPicked(image.id);
                                setPulled(null);
                                setOpen(false);
                            }}
                            label="Search images"
                            placeholder="Search every tab"
                            className="min-h-0 flex-1"
                            listClassName="max-h-none"
                        />
                    </DialogContent>
                </Dialog>
                <Note>
                    An item can sit in two groups, such as recently used and runs here; both rows
                    carry the tick when it is the current choice.
                </Note>
            </div>
            <Api
                items={[
                    {
                        name: "tabs",
                        note: "value, label, and either groups ({ key, label?, items }) with an optional toolbar and empty line, or panel(query) for a form; matches(query) lets a panel tab show up among the tabs with matches.",
                    },
                    {
                        name: "tab, onTabChange",
                        note: "the selected tab, controlled.",
                    },
                    {
                        name: "itemKey, itemText, renderItem, onPick",
                        note: "as in SearchList. itemKey must be unique within a group (the same item may sit in two groups); itemText is what the search matches (every word, case and accent insensitive).",
                    },
                    {
                        name: "currentKey",
                        note: "the item already chosen: an --accent row with a tick.",
                    },
                    {
                        name: "className, listClassName",
                        note: "in a dialog of fixed height, give the root min-h-0 flex-1 and the list max-h-none so the list takes the rest of the height.",
                    },
                ]}
            />
        </Spec>
    );
}
