import {
    Badge,
    Button,
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Checkbox,
    CheckboxField,
    type CheckedState,
    ColorField,
    ColorPicker,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
    Input,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    RadioGroup,
    RadioGroupItem,
    ScrollArea,
    ScrollBar,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    Separator,
    Switch,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    contrastRatio,
    readableOn,
} from "obp-ui";
import {
    Bot,
    Check,
    Gauge,
    Plus,
    Rocket,
    Settings2,
    ShieldCheck,
    Sparkles,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import { Api, Cell, Note, Row, Spec } from "../kit";

// The 17 shadcn primitives, themed with obp-ui tokens. Every variant AND size the cva
// declares is on this page - if a variant exists and is not below, the gallery is wrong.

const BUTTON_VARIANTS = [
    "default",
    "success",
    "outline",
    "secondary",
    "ghost",
    "destructive",
    "link",
] as const;

const BUTTON_SIZES = [
    "xs",
    "sm",
    "default",
    "lg",
    "icon-xs",
    "icon-sm",
    "icon",
    "icon-lg",
] as const;

const BADGE_VARIANTS = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "link",
    "destructive",
    "success",
    "warning",
    "info",
    "approval",
    "neutral",
    "accent",
] as const;

const ROWS = [
    { slice: "landing-page", state: "shipped", cost: "$0.71" },
    { slice: "checkout", state: "building", cost: "$1.40" },
    { slice: "email-capture", state: "queued", cost: "-" },
];

const CHANNELS = [
    { id: "email", label: "Email", description: "The daily burn digest, 08:00 local." },
    { id: "slack", label: "Slack", description: "Only when a run is waiting on you." },
    { id: "sms", label: "SMS", description: "Kill switches and hard failures." },
];

const PROFILES = [
    { id: "ruthless", label: "Ruthless operator", description: "Kills anything without a buyer." },
    {
        id: "builder",
        label: "Patient builder",
        description: "Gives a thesis nine slices to prove itself.",
    },
    {
        id: "auditor",
        label: "Compliance auditor",
        description: "Ships nothing that leaks a secret.",
    },
];

export function PrimitivesSection() {
    const [brandColor, setBrandColor] = useState("#c8643c");
    const [inkColor, setInkColor] = useState("#2c2926");
    const [plan, setPlan] = useState("scale");
    const [autopilot, setAutopilot] = useState(true);
    const [cadence, setCadence] = useState("daily");
    const [showCosts, setShowCosts] = useState(true);
    const [sort, setSort] = useState("recent");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [unattended, setUnattended] = useState<CheckedState>(true);
    const [channels, setChannels] = useState<string[]>(["email"]);
    const [profile, setProfile] = useState("ruthless");
    const [provider, setProvider] = useState("anthropic");
    const [runtime, setRuntime] = useState("node");

    const allChannels = channels.length === CHANNELS.length;
    const someChannels = channels.length > 0 && !allChannels;

    return (
        <TooltipProvider>
            <Spec
                name="Button"
                note="seven variants over eight sizes; icon sizes are square and take a single glyph."
            >
                <Row>
                    {BUTTON_VARIANTS.map((v) => (
                        <Button key={v} variant={v}>
                            {v}
                        </Button>
                    ))}
                </Row>
                <Row className="mt-5">
                    {BUTTON_SIZES.map((s) => (
                        <Cell key={s} label={s}>
                            {s.startsWith("icon") ? (
                                <Button size={s} aria-label={`New company (${s})`}>
                                    <Plus />
                                </Button>
                            ) : (
                                <Button size={s}>
                                    <Rocket /> Ship it
                                </Button>
                            )}
                        </Cell>
                    ))}
                </Row>
                <Row className="mt-5">
                    <Button disabled>disabled</Button>
                    <Button variant="outline" disabled>
                        disabled
                    </Button>
                </Row>
            </Spec>

            <Spec
                name="Badge"
                note="chips. The last six carry the status language; the first six are plain chrome."
            >
                <Row>
                    {BADGE_VARIANTS.map((v) => (
                        <Badge key={v} variant={v}>
                            {v}
                        </Badge>
                    ))}
                </Row>
                <Row className="mt-4">
                    <Badge variant="success">
                        <Check /> with a glyph
                    </Badge>
                    <Badge variant="link" asChild>
                        <a href="#primitives">asChild anchor</a>
                    </Badge>
                </Row>
            </Spec>

            <Spec name="Card" note="Header · Title · Description · Action · Content · Footer.">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Ledgerly</CardTitle>
                        <CardDescription>Invoice chasing for freelancers.</CardDescription>
                        <CardAction>
                            <Badge variant="info">building</Badge>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Slice 4 of 9 is in flight. The agent is waiting on a Stripe key before
                            it can wire checkout.
                        </p>
                    </CardContent>
                    <CardFooter className="gap-2 border-t">
                        <Button size="sm">Open</Button>
                        <Button size="sm" variant="ghost">
                            Pause
                        </Button>
                    </CardFooter>
                </Card>
            </Spec>

            <Spec
                name="Input · Textarea · Label"
                note="the form floor: one field, one label, one box."
            >
                <div className="grid max-w-md gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="g-name">Company name</Label>
                        <Input id="g-name" placeholder="Ledgerly" defaultValue="Ledgerly" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="g-thesis">Thesis</Label>
                        <Textarea
                            id="g-thesis"
                            rows={3}
                            defaultValue="Freelancers lose 3 weeks a year chasing invoices."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="g-disabled">Disabled</Label>
                        <Input id="g-disabled" disabled placeholder="not editable" />
                    </div>
                </div>
            </Spec>

            <Spec
                name="Select"
                note="three trigger heights that match Button; a grouped list with a label, a separator and a disabled row."
            >
                <Row className="items-end gap-6">
                    <Cell label='size="sm"'>
                        <Select value={sort} onValueChange={setSort}>
                            <SelectTrigger size="sm" className="w-44">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">Most recent</SelectItem>
                                <SelectItem value="mrr">Highest MRR</SelectItem>
                                <SelectItem value="risk">Most at risk</SelectItem>
                            </SelectContent>
                        </Select>
                    </Cell>
                    <Cell label='size="default"'>
                        <Select value={plan} onValueChange={setPlan}>
                            <SelectTrigger className="w-56">
                                <SelectValue placeholder="Pick a plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Self-host</SelectLabel>
                                    <SelectItem value="solo">Solo</SelectItem>
                                    <SelectItem value="studio">Studio</SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectGroup>
                                    <SelectLabel>Hosted</SelectLabel>
                                    <SelectItem value="scale">Scale</SelectItem>
                                    <SelectItem value="fleet" disabled>
                                        Fleet (waitlist)
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </Cell>
                    <Cell label='size="lg"'>
                        <Select value={runtime} onValueChange={setRuntime}>
                            <SelectTrigger size="lg" className="w-52">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="node">Node 22</SelectItem>
                                <SelectItem value="bun">Bun 1.2</SelectItem>
                                <SelectItem value="deno">Deno 2</SelectItem>
                            </SelectContent>
                        </Select>
                    </Cell>
                    <Cell label="disabled">
                        <Select value="solo" disabled>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="solo">Solo</SelectItem>
                            </SelectContent>
                        </Select>
                    </Cell>
                </Row>
                <Row className="mt-6 items-end gap-6">
                    <Cell label="description={…}">
                        <Select value={profile} onValueChange={setProfile}>
                            <SelectTrigger className="w-60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-w-[22rem]">
                                {PROFILES.map((p) => (
                                    <SelectItem key={p.id} value={p.id} description={p.description}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Cell>
                    <Cell label="icon={…}">
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger className="w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="anthropic" icon={<Sparkles />}>
                                    Claude
                                </SelectItem>
                                <SelectItem value="openrouter" icon={<Bot />}>
                                    OpenRouter
                                </SelectItem>
                                <SelectItem
                                    value="local"
                                    icon={<ShieldCheck />}
                                    description="Never leaves the machine."
                                >
                                    Local (Ollama)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Cell>
                    <Cell label="icon + description">
                        <Select value={cadence} onValueChange={setCadence}>
                            <SelectTrigger className="w-60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-w-[22rem]">
                                <SelectItem
                                    value="daily"
                                    icon={<Gauge />}
                                    description="One mail a day, every day."
                                >
                                    Daily burn
                                </SelectItem>
                                <SelectItem
                                    value="weekly"
                                    icon={<Rocket />}
                                    description="Monday morning, everything at once."
                                >
                                    Weekly digest
                                </SelectItem>
                                <SelectItem
                                    value="never"
                                    icon={<Settings2 />}
                                    description="You will have to come looking."
                                    disabled
                                >
                                    Never (locked)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </Cell>
                </Row>
                <Note>
                    picked: <span className="font-mono">{plan}</span> ·{" "}
                    <span className="font-mono">{sort}</span> ·{" "}
                    <span className="font-mono">{runtime}</span> ·{" "}
                    <span className="font-mono">{profile}</span> ·{" "}
                    <span className="font-mono">{provider}</span> ·{" "}
                    <span className="font-mono">{cadence}</span>. `icon` and `description` are drawn
                    outside ItemText on purpose - the trigger keeps showing the label alone.
                </Note>
            </Spec>

            <Spec
                name="Checkbox"
                note="two sizes over every state. The tick is drawn rather than swapped in, and motion-reduce stills it."
            >
                <Row className="gap-8">
                    <Cell label='size="default"'>
                        <Row className="gap-4">
                            <Checkbox aria-label="Unchecked" />
                            <Checkbox defaultChecked aria-label="Checked" />
                            <Checkbox checked="indeterminate" aria-label="Indeterminate" />
                        </Row>
                    </Cell>
                    <Cell label='size="sm"'>
                        <Row className="gap-4">
                            <Checkbox size="sm" aria-label="Unchecked, small" />
                            <Checkbox size="sm" defaultChecked aria-label="Checked, small" />
                            <Checkbox
                                size="sm"
                                checked="indeterminate"
                                aria-label="Indeterminate, small"
                            />
                        </Row>
                    </Cell>
                    <Cell label="disabled">
                        <Row className="gap-4">
                            <Checkbox disabled aria-label="Disabled" />
                            <Checkbox disabled defaultChecked aria-label="Disabled, checked" />
                        </Row>
                    </Cell>
                    <Cell label="aria-invalid">
                        <Row className="gap-4">
                            <Checkbox aria-invalid aria-label="Invalid" />
                            <Checkbox aria-invalid defaultChecked aria-label="Invalid, checked" />
                        </Row>
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="CheckboxField"
                note="checkbox + label + optional description as one hit target - the whole row toggles, and a column of them lines up."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="grid gap-4">
                        <CheckboxField
                            label="Run unattended"
                            description="The agent ships slices without stopping for approval, up to the budget cap."
                            checked={unattended}
                            onCheckedChange={setUnattended}
                        />
                        <CheckboxField
                            size="sm"
                            label="Include costs in the digest"
                            description='size="sm", for dense rows.'
                            defaultChecked
                        />
                        <CheckboxField
                            label="Sell to enterprises"
                            description="Locked until the company has a signed DPA."
                            disabled
                            defaultChecked
                        />
                        <CheckboxField
                            label="I accept the guardrails"
                            description="Required before the first real-money run."
                            aria-invalid
                        />
                    </div>

                    <div>
                        <CheckboxField
                            label="All channels"
                            description="A parent row reports indeterminate while the list is split."
                            checked={allChannels ? true : someChannels ? "indeterminate" : false}
                            onCheckedChange={(v) =>
                                setChannels(v === true ? CHANNELS.map((c) => c.id) : [])
                            }
                        />
                        <div className="mt-3 grid gap-3 border-l border-border-soft pl-4">
                            {CHANNELS.map((c) => (
                                <CheckboxField
                                    key={c.id}
                                    size="sm"
                                    label={c.label}
                                    description={c.description}
                                    checked={channels.includes(c.id)}
                                    onCheckedChange={(v) =>
                                        setChannels((prev) =>
                                            v === true
                                                ? [...prev, c.id]
                                                : prev.filter((id) => id !== c.id),
                                        )
                                    }
                                />
                            ))}
                        </div>
                        <div className="mt-3">
                            <Note>
                                on:{" "}
                                <span className="font-mono">{channels.join(" · ") || "none"}</span>
                            </Note>
                        </div>
                    </div>
                </div>
            </Spec>

            <Spec
                name="Switch · RadioGroup"
                note="both sizes of the switch; a radio group with a disabled row."
            >
                <Row className="gap-8">
                    <Cell label='size="default"'>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="g-autopilot"
                                checked={autopilot}
                                onCheckedChange={setAutopilot}
                            />
                            <Label htmlFor="g-autopilot">Autopilot</Label>
                        </div>
                    </Cell>
                    <Cell label='size="sm"'>
                        <Switch size="sm" defaultChecked aria-label="Small switch" />
                    </Cell>
                    <Cell label="RadioGroup">
                        <RadioGroup value={cadence} onValueChange={setCadence}>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="daily" id="g-daily" />
                                <Label htmlFor="g-daily">Daily burn</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="weekly" id="g-weekly" />
                                <Label htmlFor="g-weekly">Weekly digest</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="never" id="g-never" disabled />
                                <Label htmlFor="g-never">Never (locked)</Label>
                            </div>
                        </RadioGroup>
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="Tabs"
                note="two list variants - the filled default and the underlined line."
            >
                <div className="grid gap-8 lg:grid-cols-2">
                    <Tabs defaultValue="build">
                        <TabsList>
                            <TabsTrigger value="build">Build</TabsTrigger>
                            <TabsTrigger value="grow">Grow</TabsTrigger>
                            <TabsTrigger value="run">Run</TabsTrigger>
                        </TabsList>
                        <TabsContent value="build" className="pt-3 text-sm text-muted-foreground">
                            variant="default" - the filled pill list.
                        </TabsContent>
                        <TabsContent value="grow" className="pt-3 text-sm text-muted-foreground">
                            Growth loops, channels, spend.
                        </TabsContent>
                        <TabsContent value="run" className="pt-3 text-sm text-muted-foreground">
                            Support, incidents, cost.
                        </TabsContent>
                    </Tabs>
                    <Tabs defaultValue="spec">
                        <TabsList variant="line">
                            <TabsTrigger value="spec">Spec</TabsTrigger>
                            <TabsTrigger value="code">Source</TabsTrigger>
                            <TabsTrigger value="log">Build log</TabsTrigger>
                        </TabsList>
                        <TabsContent value="spec" className="pt-3 text-sm text-muted-foreground">
                            variant="line" - underlined, no fill.
                        </TabsContent>
                        <TabsContent value="code" className="pt-3 text-sm text-muted-foreground">
                            The repo the agent writes into.
                        </TabsContent>
                        <TabsContent value="log" className="pt-3 text-sm text-muted-foreground">
                            Every run, every cost.
                        </TabsContent>
                    </Tabs>
                </div>
            </Spec>

            <Spec
                name="Dialog"
                note="modal; opens on the trigger, closes on Esc, the ✕ or a DialogClose."
            >
                <Row>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">Open dialog</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Raise the budget cap?</DialogTitle>
                                <DialogDescription>
                                    Ledgerly has spent $18.40 of its $20 cap this week. Raising it
                                    lets the agent finish slice 4.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Not now</Button>
                                </DialogClose>
                                <Button onClick={() => setDialogOpen(false)}>Raise to $40</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Note>open: {String(dialogOpen)}</Note>
                </Row>
            </Spec>

            <Spec
                name="DropdownMenu"
                note="label, items, checkbox + radio items, a submenu, a shortcut and a destructive row."
            >
                <Row>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Settings2 /> Company actions
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-60">
                            <DropdownMenuLabel>Ledgerly</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                <DropdownMenuItem>
                                    Open workspace
                                    <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
                                </DropdownMenuItem>
                                <DropdownMenuCheckboxItem
                                    checked={showCosts}
                                    onCheckedChange={setShowCosts}
                                >
                                    Show costs
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Digest</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={cadence} onValueChange={setCadence}>
                                <DropdownMenuRadioItem value="daily">Daily</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="weekly">Weekly</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem>Portfolio</DropdownMenuItem>
                                        <DropdownMenuItem>Archive</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">
                                <Trash2 /> Kill company
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Note>
                        costs: {String(showCosts)} · digest:{" "}
                        <span className="font-mono">{cadence}</span>
                    </Note>
                </Row>
            </Spec>

            <Spec
                name="Popover"
                note="the floating panel with no menu semantics - a form, a filter, a picker. DropdownMenu owns the arrow keys; this does not."
            >
                <Row>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">Open a popover</Button>
                        </PopoverTrigger>
                        <PopoverContent align="start">
                            <p className="text-sm font-semibold">Anything goes in here</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Same border, surface, elevation and entrance as SelectContent, so
                                the two read as one object when opened side by side.
                            </p>
                            <div className="mt-3 flex gap-2">
                                <Input placeholder="Type freely" />
                                <Button size="sm">Save</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Note>arrow keys, typing and focus all behave normally inside.</Note>
                </Row>
            </Spec>

            <Spec
                name="ColorPicker"
                note="saturation/brightness field, hue rail, hex entry, presets - and an eyedropper where the browser has one. Never the OS colour panel."
            >
                <div className="flex flex-wrap items-start gap-8">
                    <div className="w-64">
                        <ColorPicker
                            value={brandColor}
                            onChange={setBrandColor}
                            swatches={[
                                "#c8643c",
                                "#1e85cb",
                                "#349150",
                                "#9d6cbf",
                                "#a77d00",
                                "#2c2926",
                            ]}
                        />
                    </div>
                    <div className="space-y-3">
                        <Note>
                            Live value: <span className="font-mono">{brandColor}</span>
                        </Note>
                        <div className="flex items-center gap-2">
                            <span
                                className="grid size-16 place-items-center rounded-lg border border-border font-medium"
                                style={{ background: brandColor, color: readableOn(brandColor) }}
                            >
                                Aa
                            </span>
                            <Note>
                                readableOn() picks the label colour;
                                <br />
                                contrast{" "}
                                {contrastRatio(brandColor, readableOn(brandColor)).toFixed(2)}
                                :1
                            </Note>
                        </div>
                        <Note>
                            Drag saturation to zero and the hue rail stays where you left it - hue
                            is undefined for grey, so the picker remembers it rather than
                            re-deriving it.
                        </Note>
                    </div>
                </div>
            </Spec>

            <Spec
                name="ColorField"
                note="the form-control shape: a labelled swatch that opens the picker in a popover."
            >
                <div className="grid max-w-lg gap-2 sm:grid-cols-2">
                    <ColorField label="Brand" value={brandColor} onChange={setBrandColor} />
                    <ColorField label="Ink" value={inkColor} onChange={setInkColor} />
                </div>
            </Spec>

            <Spec
                name="Tooltip"
                note="wrap the page (or the surface) in TooltipProvider once; hover or focus a trigger."
            >
                <Row>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline">Hover me</Button>
                        </TooltipTrigger>
                        <TooltipContent>The agent last ran 4 minutes ago.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Settings">
                                <Settings2 />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Settings</TooltipContent>
                    </Tooltip>
                </Row>
            </Spec>

            <Spec
                name="Table"
                note="Header · Body · Footer · Caption, with a right-aligned numeric column."
            >
                <Table>
                    <TableCaption>Slices in the current build.</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Slice</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ROWS.map((r) => (
                            <TableRow key={r.slice}>
                                <TableCell className="font-mono">{r.slice}</TableCell>
                                <TableCell>{r.state}</TableCell>
                                <TableCell className="text-right font-mono">{r.cost}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right font-mono">$2.11</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Spec>

            <Spec
                name="Separator · ScrollArea"
                note="a hairline in both orientations, and a scroll box with a styled bar."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                        <p className="text-sm text-muted-foreground">above</p>
                        <Separator className="my-3" />
                        <p className="text-sm text-muted-foreground">below</p>
                        <div className="mt-4 flex h-8 items-center gap-3 text-sm">
                            <span>spec</span>
                            <Separator orientation="vertical" />
                            <span>build</span>
                            <Separator orientation="vertical" />
                            <span>ship</span>
                        </div>
                    </div>
                    <ScrollArea className="h-40 rounded-lg border border-border p-3">
                        <div className="space-y-1.5">
                            {Array.from({ length: 14 }, (_, i) => (
                                <p key={`line-${i + 1}`} className="font-mono text-sm">
                                    {String(i + 1).padStart(2, "0")} · the log keeps going
                                </p>
                            ))}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </div>
            </Spec>

            <Spec
                name="Parts you compose with"
                note="exported, but drawn by their parent rather than written by hand - and the cva functions the variants live in."
                bare
            >
                <Api
                    items={[
                        {
                            name: "buttonVariants · badgeVariants · tabsListVariants · checkboxVariants · selectTriggerVariants",
                            note: "the cva functions. Need a new look? Add a variant here - never restyle inline, never fork the file (DESIGN.md rule 2).",
                        },
                        {
                            name: "CheckedState",
                            note: "radix's checkbox value: true | false | \"indeterminate\". Type a parent row's state with it.",
                        },
                        {
                            name: "DialogPortal · DialogOverlay",
                            note: "DialogContent renders both; exported so a dialog with unusual layering can compose them itself.",
                        },
                        {
                            name: "SelectScrollUpButton · SelectScrollDownButton",
                            note: "SelectContent renders them automatically once the option list is taller than the viewport.",
                        },
                    ]}
                />
            </Spec>
        </TooltipProvider>
    );
}
