// The showcase: the design system laid out as a designed page rather than an inventory. It is
// the page `pnpm dev` opens on - see DEFAULT_PAGE in app.tsx for why the subset is the front door.
//
// It answers a different question from the gallery. The gallery asks "does every export still
// render?" - exhaustive, one block per family. This asks "does the system look right when you
// actually compose with it?" Both are needed; a kit can pass the first and fail the second.
//
// Moved here from the cslopslop web app, where it was a /design route nothing linked to. It has
// no router: like the rest of the gallery it renders as a plain component, so this file is also
// a usage example - every import below is what a real consumer writes.

import { Check, ChevronRight, Sparkles, X } from "lucide-react";
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
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Table,
    TableBody,
    TableCell,
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
} from "obp-ui";
import type { ReactNode } from "react";

export function Showcase() {
    return (
        <TooltipProvider>
            <div className="mx-auto max-w-5xl px-6 py-12">
                {/* No ThemeToggle here - the app header above owns it, and two on one page is a bug. */}
                <header className="mb-10">
                    <div>
                        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-faint">
                            obp-ui
                        </div>
                        {/* Not "the kitchen sink" any more - that is the gallery's name, and
                            this page is the front door precisely because it is NOT one. */}
                        <h1 className="font-display text-4xl font-light">The system, laid out</h1>
                        <p className="mt-2 max-w-xl font-serif text-lg italic text-muted-foreground">
                            Every surface on this page is tokens and primitives, nothing else.
                            Re-theme it with a preset or a product's own token block; never
                            re-invent it. Switch to{" "}
                            <b className="font-semibold not-italic">Gallery</b> in the header for
                            the exhaustive inventory - every export, one block per family. This is
                            the same system composed.
                        </p>
                    </div>
                </header>

                <Section title="Color" hint="Surfaces, brand & the status language">
                    <div className="mb-6">
                        <SubLabel>Surfaces</SubLabel>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Swatch name="background" className="bg-background" />
                            <Swatch name="card" className="bg-card" />
                            <Swatch name="secondary / muted" className="bg-secondary" />
                            <Swatch name="border" className="bg-border" />
                        </div>
                    </div>
                    <div className="mb-6">
                        <SubLabel>Brand</SubLabel>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Swatch
                                name="primary"
                                className="bg-primary"
                                fg="text-primary-foreground"
                            />
                            <Swatch
                                name="accent (soft)"
                                className="bg-accent"
                                fg="text-accent-foreground"
                            />
                            <Swatch name="ring" className="bg-ring" fg="text-primary-foreground" />
                            <Swatch
                                name="foreground"
                                className="bg-foreground"
                                fg="text-background"
                            />
                        </div>
                    </div>
                    <div>
                        <SubLabel>Status</SubLabel>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <Swatch
                                name="success"
                                className="bg-success"
                                fg="text-success-foreground"
                            />
                            <Swatch name="info" className="bg-info" fg="text-info-foreground" />
                            <Swatch
                                name="approval"
                                className="bg-approval"
                                fg="text-approval-foreground"
                            />
                            <Swatch
                                name="warning"
                                className="bg-warning"
                                fg="text-warning-foreground"
                            />
                            <Swatch
                                name="neutral"
                                className="bg-neutral"
                                fg="text-neutral-foreground"
                            />
                            <Swatch
                                name="destructive"
                                className="bg-destructive"
                                fg="text-destructive-foreground"
                            />
                        </div>
                    </div>
                </Section>

                {/* Four ROLES, not four family names. The header's preset control swaps all
                    four faces at once, so a line reading "Display - Space Grotesk Light" is a
                    lie one click after you arrive. The specimens still say what each role is
                    FOR, which is the part a preset cannot change. */}
                <Section
                    title="Typography"
                    hint="Four roles, four tokens - a theme preset swaps all of them"
                >
                    <div className="space-y-3">
                        <p className="font-display text-4xl font-light tracking-tight">
                            Display - headings, and only headings
                        </p>
                        <p className="font-sans text-lg">Sans - the working body typeface.</p>
                        <p className="font-serif text-lg italic text-muted-foreground">
                            Serif italic - for editorial voice and theses.
                        </p>
                        <p className="font-mono text-sm text-muted-foreground">
                            Mono - $12,480 MRR · run 4a275959 · 7/10
                        </p>
                    </div>
                </Section>

                <Section title="Buttons">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <Button>Promote bet</Button>
                        <Button variant="success">
                            <Check /> Approve
                        </Button>
                        <Button variant="outline">Reject</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Kill</Button>
                        <Button variant="link">Learn more</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button size="sm">Small</Button>
                        <Button>Default</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon" aria-label="next">
                            <ChevronRight />
                        </Button>
                        <Button disabled>Disabled</Button>
                    </div>
                </Section>

                <Section title="Status chips" hint="The action/company vocabulary">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="success">shipped</Badge>
                        <Badge variant="info">building</Badge>
                        <Badge variant="approval">awaiting you</Badge>
                        <Badge variant="neutral">queued</Badge>
                        <Badge variant="warning">at risk</Badge>
                        <Badge variant="destructive">blocked</Badge>
                        <Badge>default</Badge>
                        <Badge variant="accent">autopilot</Badge>
                        <Badge variant="outline">outline</Badge>
                    </div>
                </Section>

                <Section title="Forms">
                    <div className="grid max-w-lg gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="thought">Thought</Label>
                            <Input id="thought" placeholder="A tool that turns X into Y…" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="stack">Tech stack</Label>
                            <Select>
                                <SelectTrigger id="stack">
                                    <SelectValue placeholder="Choose a stack" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tanstack">TanStack Start</SelectItem>
                                    <SelectItem value="next">Next.js</SelectItem>
                                    <SelectItem value="node">Node + HTML</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="thesis">Thesis</Label>
                            <Textarea id="thesis" placeholder="Why does anyone want this?" />
                        </div>
                    </div>
                </Section>

                <Section title="Cards" hint="Basic + the action archetype">
                    <div className="grid gap-5 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Portfolio</CardTitle>
                                <CardDescription>3 active bets · 1 needs you</CardDescription>
                                <CardAction>
                                    <Badge variant="accent">autopilot</Badge>
                                </CardAction>
                            </CardHeader>
                            <CardContent className="grid grid-cols-3 gap-4">
                                <Stat v="$12.4k" l="MRR" />
                                <Stat v="284" l="users" />
                                <Stat v="7/10" l="cold-run" />
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline" size="sm" className="w-full">
                                    Open portfolio
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* the approval archetype - the one card the whole product revolves around */}
                        <Card className="border-approval shadow-e2 ring-4 ring-approval-soft">
                            <CardHeader>
                                <div className="mb-1 flex items-center gap-2">
                                    <Badge variant="approval">awaiting approval</Badge>
                                    <Badge variant="info">code</Badge>
                                </div>
                                <CardTitle>A visitor can sign up on a live URL</CardTitle>
                                <CardDescription>
                                    Demo Co · run 4a275959 · doneWhen green
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2 rounded-lg border bg-secondary px-3 py-2 font-mono text-sm text-muted-foreground">
                                    <span className="flex gap-1">
                                        <i className="size-2 rounded-full bg-destructive" />
                                        <i className="size-2 rounded-full bg-warning" />
                                        <i className="size-2 rounded-full bg-success" />
                                    </span>
                                    <a className="text-info" href="http://127.0.0.1:43117">
                                        127.0.0.1:43117
                                    </a>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-sm">
                                    <Check className="size-4 text-success" />
                                    <span>
                                        <b className="text-success">Green</b> - POST /signup → 200,
                                        record persisted
                                    </span>
                                </div>
                            </CardContent>
                            <CardFooter className="gap-2">
                                <Button variant="success" className="flex-1">
                                    <Check /> Approve &amp; ship
                                </Button>
                                <Button variant="outline">
                                    <X /> Reject
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </Section>

                <Section title="Tabs" hint="Company lenses">
                    <Tabs defaultValue="build" className="max-w-lg">
                        <TabsList>
                            <TabsTrigger value="build">Build</TabsTrigger>
                            <TabsTrigger value="distribute">Distribute</TabsTrigger>
                            <TabsTrigger value="monetize">Monetize</TabsTrigger>
                        </TabsList>
                        <TabsContent value="build" className="pt-3 text-sm text-muted-foreground">
                            The code actions - the walking skeleton, then capability + depth
                            features.
                        </TabsContent>
                        <TabsContent
                            value="distribute"
                            className="pt-3 text-sm text-muted-foreground"
                        >
                            SEO pages, build-in-public posts, cold outreach, channels.
                        </TabsContent>
                        <TabsContent
                            value="monetize"
                            className="pt-3 text-sm text-muted-foreground"
                        >
                            A "user can pay" feature on Stripe test-mode + pricing.
                        </TabsContent>
                    </Tabs>
                </Section>

                <Section title="Overlays" hint="Dialog · dropdown · tooltip">
                    <div className="flex flex-wrap items-center gap-3">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline">Open dialog</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Promote this bet?</DialogTitle>
                                    <DialogDescription>
                                        A planning run will decompose it into the first code actions
                                        and seed the company brain.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="ghost">Cancel</Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                        <Button>Promote</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Company</DropdownMenuLabel>
                                <DropdownMenuItem>Pause</DropdownMenuItem>
                                <DropdownMenuItem>Archive</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                    Kill
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="info">
                                    <Sparkles />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Reversible code actions auto-run on green
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </Section>

                <Section title="Table" hint="The action queue">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                ["A visitor can sign up", "code", "Demo Co", "success", "done"],
                                [
                                    "Post the launch on X",
                                    "message",
                                    "Demo Co",
                                    "approval",
                                    "awaiting you",
                                ],
                                ["Authorize $50 ad test", "money", "Nimbus", "neutral", "queued"],
                                ["Fix checkout 500", "code", "Nimbus", "destructive", "blocked"],
                            ].map(([title, type, co, variant, label]) => (
                                <TableRow key={title}>
                                    <TableCell className="font-medium">{title}</TableCell>
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                        {type}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{co}</TableCell>
                                    <TableCell className="text-right">
                                        {/* biome-ignore lint/suspicious/noExplicitAny: demo data */}
                                        <Badge variant={variant as any}>{label}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Section>

                <p className="mt-14 border-t pt-6 text-center text-sm text-faint">
                    Edit tokens in <code className="font-mono">src/styles/globals.css</code> · rules
                    in <code className="font-mono">obp-ui/DESIGN.md</code>
                </p>
            </div>
        </TooltipProvider>
    );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
    return (
        <section className="mb-12">
            <div className="mb-4 flex items-baseline gap-3">
                <h2 className="font-display text-xl font-medium">{title}</h2>
                {hint && <span className="text-sm text-faint">{hint}</span>}
            </div>
            <Separator className="mb-5" />
            {children}
        </section>
    );
}

function SubLabel({ children }: { children: ReactNode }) {
    return (
        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-faint">
            {children}
        </div>
    );
}

function Swatch({
    name,
    className,
    fg = "text-foreground",
}: { name: string; className: string; fg?: string }) {
    return (
        <div className={`flex h-16 items-end rounded-lg border p-2 shadow-e1 ${className}`}>
            <span className={`text-sm font-medium ${fg}`}>{name}</span>
        </div>
    );
}

function Stat({ v, l }: { v: string; l: string }) {
    return (
        <div>
            <div className="font-display text-2xl font-semibold tracking-tight">{v}</div>
            <div className="text-sm text-faint">{l}</div>
        </div>
    );
}
