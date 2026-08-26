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
} from "@paperkit/ui";
import { Check, Plus, Rocket, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Api, Cell, Note, Row, Spec } from "../kit";

// The 16 shadcn primitives, themed with paperkit tokens. Every variant AND size the cva
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

export function PrimitivesSection() {
    const [plan, setPlan] = useState("scale");
    const [autopilot, setAutopilot] = useState(true);
    const [cadence, setCadence] = useState("daily");
    const [showCosts, setShowCosts] = useState(true);
    const [sort, setSort] = useState("recent");
    const [dialogOpen, setDialogOpen] = useState(false);

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
                note="both trigger sizes; opens, filters and reports the picked value."
            >
                <Row className="items-end gap-6">
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
                    <Note>
                        picked: <span className="font-mono">{plan}</span> ·{" "}
                        <span className="font-mono">{sort}</span>
                    </Note>
                </Row>
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
                            name: "buttonVariants · badgeVariants · tabsListVariants",
                            note: "the cva functions. Need a new look? Add a variant here - never restyle inline, never fork the file (DESIGN.md rule 2).",
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
