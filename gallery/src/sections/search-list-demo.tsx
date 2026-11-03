import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    SearchList,
} from "obp-ui";
import { useState } from "react";
import { Api, Note, Row, Spec } from "../kit";

type Region = { id: string; name: string; city: string; latency: number; status: "ok" | "busy" };

const REGIONS: Region[] = [
    { id: "eu-west-1", name: "Europe West", city: "Dublin", latency: 18, status: "ok" },
    { id: "eu-central-1", name: "Europe Central", city: "Frankfurt", latency: 24, status: "ok" },
    { id: "eu-north-1", name: "Europe North", city: "Stockholm", latency: 31, status: "busy" },
    { id: "us-east-1", name: "US East", city: "Virginia", latency: 82, status: "ok" },
    { id: "us-west-2", name: "US West", city: "Oregon", latency: 141, status: "ok" },
    { id: "ap-south-1", name: "Asia Pacific South", city: "Mumbai", latency: 128, status: "busy" },
    {
        id: "ap-northeast-1",
        name: "Asia Pacific North East",
        city: "Tokyo",
        latency: 212,
        status: "ok",
    },
    { id: "sa-east-1", name: "South America East", city: "São Paulo", latency: 196, status: "ok" },
];

function RegionItem({ region }: { region: Region }) {
    return (
        <>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{region.name}</span>
                <span className="truncate text-muted-foreground">
                    {region.city} · <span className="font-mono">{region.id}</span>
                </span>
            </span>
            <span className="tabular-nums text-muted-foreground">{`${region.latency} ms`}</span>
            <Badge variant={region.status === "ok" ? "success" : "warning"}>
                {region.status === "ok" ? "Available" : "Busy"}
            </Badge>
        </>
    );
}

export function SearchListDemo() {
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);
    const left = REGIONS.filter((region) => !picked.includes(region.id));
    const pick = (region: Region) => setPicked([...picked, region.id]);
    return (
        <Spec
            name="SearchList"
            note="A search field over a list it filters. Arrows move the highlight, Enter or a click picks, Escape clears the text. Base UI's inline Autocomplete underneath, so screen readers hear a combobox and its options."
        >
            <div className="grid gap-6 lg:grid-cols-2">
                <SearchList
                    items={left}
                    itemKey={(region) => region.id}
                    itemText={(region) => `${region.name} ${region.city} ${region.id}`}
                    renderItem={(region) => <RegionItem region={region} />}
                    onPick={pick}
                    label="Search regions"
                    placeholder="Search regions"
                    empty="No region matches."
                    listClassName="max-h-72"
                />
                <div className="flex flex-col items-start gap-3">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        Add a region in a dialog
                    </Button>
                    <Row className="gap-2">
                        {picked.map((id) => (
                            <Badge key={id} variant="outline" className="font-mono">
                                {id}
                            </Badge>
                        ))}
                    </Row>
                    <Note>
                        {picked.length === 0
                            ? "Nothing picked yet."
                            : `${picked.length} picked; picked regions leave the list.`}
                    </Note>
                    {picked.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
                            Reset
                        </Button>
                    )}
                </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add a region</DialogTitle>
                        <DialogDescription>Regions you have not added yet.</DialogDescription>
                    </DialogHeader>
                    <SearchList
                        items={left}
                        itemKey={(region) => region.id}
                        itemText={(region) => `${region.name} ${region.city} ${region.id}`}
                        renderItem={(region) => <RegionItem region={region} />}
                        onPick={(region) => {
                            pick(region);
                            setOpen(false);
                        }}
                        label="Search regions"
                        placeholder="Search regions"
                        empty="No region matches."
                    />
                </DialogContent>
            </Dialog>
            <Api
                items={[
                    {
                        name: "items, itemKey, itemText",
                        note: "the list, a stable key per item, and the text the search matches (case and accent insensitive, anywhere in the text).",
                    },
                    {
                        name: "renderItem",
                        note: "the row's content. Rows are 32px or taller, flex with gap-3, highlighted on --secondary; put a name first and anything aligned right after it.",
                    },
                    {
                        name: "onPick",
                        note: "called on click and on Enter. The first match is always highlighted, so typing then Enter picks it.",
                    },
                    {
                        name: "empty, listClassName",
                        note: "the line shown when nothing matches, and a class for the list (max-h-[min(26rem,55vh)] by default).",
                    },
                ]}
            />
        </Spec>
    );
}
