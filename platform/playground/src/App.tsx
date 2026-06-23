import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Checkbox,
  Dialog,
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
  EmptyState,
  ErrorState,
  Footer,
  Input,
  Label,
  LoadingState,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toaster,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@offbeatport/microsaas-core/ui";
import {
  type ColumnDef,
  DataTable,
} from "@offbeatport/microsaas-core/ui/data-table";
import {
  CTASection,
  FeatureGrid,
  Hero,
  LogoCloud,
  Testimonials,
} from "@offbeatport/microsaas-core/marketing";
import {
  DashboardLayout,
  SettingsLayout,
  SettingsNavItem,
  SettingsSection,
} from "@offbeatport/microsaas-core/layouts";
import { PricingPage } from "@offbeatport/microsaas-core/pages/pricing";
import {
  STYLE_PRESETS,
  RADIUS_PRESETS,
  hexToTriplet,
  type Style,
  type RadiusPreset,
} from "@offbeatport/microsaas-core/theme/styles";
import { type ReactNode, useEffect, useState } from "react";

/* Style + Radius presets are now imported from @offbeatport/microsaas-core/theme/styles
 * - single source of truth shared with the build-microsaas skill. Edit there. */

type Mode = "system" | "light" | "dark";
type State = {
  theme: Mode;
  style: Style | null;
  radius: { sm: number; md: number } | null;
};

type BlueprintId =
  | "tool-first"
  | "wizard"
  | "classic"
  | "alert"
  | "dashboard"
  | "widget"
  | "directory";

type Blueprint = {
  id: BlueprintId;
  name: string;
  shape: string;
  loop: string;
  monetization: string;
  routes: string[];
  data: string[];
  risks: string[];
  preview: string;
};

type FullScreenTarget =
  | "login"
  | "register"
  | "pricing"
  | "marketing"
  | "dashboard"
  | "settings";

type PlaygroundPage = "blueprints" | "ui-kit" | "screens" | "tokens";

const INITIAL: State = { theme: "system", style: null, radius: null };

const PLAYGROUND_PAGES: Array<{
  id: PlaygroundPage;
  label: string;
  description: string;
}> = [
    { id: "blueprints", label: "Blueprints", description: "Factory app shapes" },
    { id: "ui-kit", label: "UI Kit", description: "Core components" },
    { id: "screens", label: "Screens", description: "Auth and app layouts" },
    { id: "tokens", label: "Tokens", description: "Color and spacing" },
  ];

const BLUEPRINTS: Blueprint[] = [
  {
    id: "tool-first",
    name: "Tool-first",
    shape: "AI generator / converter / calculator",
    loop: "Use tool -> see result -> save/export -> upgrade",
    monetization: "Free daily runs, paid unlimited history and export.",
    routes: ["/", "/api/run", "/dashboard", "/dashboard/$runId", "/pricing"],
    data: ["runs", "usage_day", "processor input/output"],
    risks: ["Generic hero before the tool", "Client-only limits", "No useful free result"],
    preview: "Inline processor with output and run ledger.",
  },
  {
    id: "wizard",
    name: "Wizard",
    shape: "Multi-step flow with paid export",
    loop: "Answer steps -> preview artifact -> pay for final",
    monetization: "Watermarked preview is free; full artifact is paid.",
    routes: ["/", "/build/$step", "/build/result", "/api/preview", "/api/generate"],
    data: ["builds", "inputs", "paid flag"],
    risks: ["Paywall too early", "CSS-only watermark", "Lost state between steps"],
    preview: "Step rail with paid result preview.",
  },
  {
    id: "classic",
    name: "Classic",
    shape: "Deep authenticated app",
    loop: "Marketing -> signup -> dashboard -> recurring workflow",
    monetization: "Plan gates around seats, projects, integrations, or volume.",
    routes: ["/", "/features", "/pricing", "/dashboard", "/dashboard/settings"],
    data: ["projects", "product resource", "user tier"],
    risks: ["Dashboard with no activation path", "Gated pricing", "No self-serve billing"],
    preview: "Marketing strip plus authenticated workspace.",
  },
  {
    id: "alert",
    name: "Alert",
    shape: "Watch-and-notify",
    loop: "Configure monitor -> background check -> actionable notification",
    monetization: "Free monitor cap, paid frequency and notification channels.",
    routes: ["/dashboard", "/dashboard/new", "/dashboard/$monitorId", "/api/check"],
    data: ["monitors", "alerts", "state hash"],
    risks: ["No cron auth", "Flapping notifications", "App-only value"],
    preview: "Monitor list with recent state changes.",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    shape: "Daily-use data tracker",
    loop: "Quick-add record -> review trend -> export/share",
    monetization: "Paid export, insights, longer history, or team views.",
    routes: ["/dashboard", "/dashboard/log", "/dashboard/history", "/dashboard/insights"],
    data: ["entries", "time-series payload", "aggregates"],
    risks: ["Fake charts", "Slow quick-add", "Queries not scoped by user"],
    preview: "Quick-add, metric strip, and history table.",
  },
  {
    id: "widget",
    name: "Widget",
    shape: "JS snippet on customer sites",
    loop: "Install snippet -> collect events -> tune behavior",
    monetization: "Paid branding removal, volume, customization, or analytics.",
    routes: ["/dashboard", "/dashboard/$siteId/install", "/embed.js", "/api/widget/event"],
    data: ["sites", "events", "allowed hosts", "public config"],
    risks: ["React in embed", "No domain allowlist", "Underpriced branding removal"],
    preview: "Install snippet and live widget controls.",
  },
  {
    id: "directory",
    name: "Directory",
    shape: "Curated listings + paid submissions",
    loop: "Search/browse -> listing page -> submission/review -> SEO growth",
    monetization: "Skip-the-line, featured slots, sponsorships.",
    routes: ["/", "/category/$slug", "/$listingSlug", "/submit", "/admin"],
    data: ["listings", "categories", "submission status"],
    risks: ["Thin SEO pages", "Auto-published spam", "Featured slot invisible"],
    preview: "Search surface with listing cards and curation queue.",
  },
];

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

function useCustomization(prefersDark: boolean): [State, (next: Partial<State>) => void] {
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return INITIAL;
    try {
      const saved = JSON.parse(localStorage.getItem("custom") || "{}") as Partial<State>;
      // Migrate stale radius state: before this fix, the Pill preset stored
      // md=999, which renders as a chunky rectangle on cards (not a pill).
      // The new preset clamps md to 24 - rewrite saved state to match.
      if (saved.radius?.sm === 999 && saved.radius?.md === 999) {
        saved.radius = { sm: 999, md: 24 };
      }
      return { ...INITIAL, ...saved };
    } catch {
      return INITIAL;
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    // data-theme = explicit toggle, or unset for "system" (lets prefers-color-scheme do its thing).
    const effectiveMode: "light" | "dark" | null = state.theme === "system" ? null : state.theme;
    if (effectiveMode) root.setAttribute("data-theme", effectiveMode);
    else root.removeAttribute("data-theme");

    // Style: pick the light or dark variant based on the resolved theme.
    // Hex → RGB triplet so the value works with `rgb(var(--X) / <alpha-value>)`.
    if (state.style) {
      const isDark = effectiveMode === "dark" || (effectiveMode === null && prefersDark);
      const variant = isDark ? state.style.dark : state.style.light;
      root.style.setProperty("--primary", hexToTriplet(variant.primary));
      root.style.setProperty("--primary-fg", hexToTriplet(variant.primaryFg));
      root.style.setProperty("--bg", hexToTriplet(variant.bg));
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-fg");
      root.style.removeProperty("--bg");
    }

    // Radius override.
    if (state.radius) {
      root.style.setProperty("--r-sm", `${state.radius.sm}px`);
      root.style.setProperty("--r-md", `${state.radius.md}px`);
    } else {
      root.style.removeProperty("--r-sm");
      root.style.removeProperty("--r-md");
    }

    localStorage.setItem("custom", JSON.stringify(state));
  }, [state, prefersDark]);

  const update = (next: Partial<State>) => setState((prev) => ({ ...prev, ...next }));
  return [state, update];
}

/* ---- App ---- */

export function App() {
  const prefersDark = usePrefersDark();
  const [state, update] = useCustomization(prefersDark);
  const [page, setPage] = useState<PlaygroundPage>("blueprints");

  const onPickStyle = (style: Style | null) => update({ style });

  const [fullScreen, setFullScreen] = useState<FullScreenTarget | null>(null);

  if (fullScreen) {
    return (
      <TooltipProvider delayDuration={150}>
        <FullScreenView onExit={() => setFullScreen(null)}>
          {fullScreen === "login" && (
            <AuthFullPage>
              <LoginScreen />
            </AuthFullPage>
          )}
          {fullScreen === "register" && (
            <AuthFullPage>
              <RegisterScreen />
            </AuthFullPage>
          )}
          {fullScreen === "pricing" && <PricingScreen />}
          {fullScreen === "marketing" && <MarketingScreen />}
          {fullScreen === "dashboard" && <DashboardScreen fullPage />}
          {fullScreen === "settings" && <SettingsScreen fullPage />}
        </FullScreenView>
        <Toaster />
      </TooltipProvider>
    );
  }

  const onPickRadius = (preset: RadiusPreset | null) =>
    update({ radius: preset ? { sm: preset.sm, md: preset.md } : null });
  const onCustomRadius = (sm: number | null) =>
    update({
      radius: sm === null ? null : { sm, md: sm >= 999 ? 999 : sm + 4 },
    });

  return (
    <TooltipProvider delayDuration={150}>
      <Toaster />
      <div className="max-w-[880px] mx-auto px-6 pt-12 pb-16">
        <header className="mb-12 pb-6 border-b border-border">
          <div className="flex justify-between items-end gap-6 flex-wrap">
            <div>
              <Eyebrow>Playground</Eyebrow>
              <h1 className="font-display font-light text-[64px] leading-[1.05] tracking-[-0.03em] mt-2">
                Micro<span className="text-primary">SaaS</span> Core.
              </h1>
              <p className="text-fg-muted text-[13px] mt-2">
                Focused previews for the factory blueprints, core UI, app screens, and tokens.
              </p>
            </div>
            <div className="flex gap-2">
              <ThemeBtn
                label="System"
                active={state.theme === "system"}
                onClick={() => update({ theme: "system" })}
              />
              <ThemeBtn
                label="Light"
                active={state.theme === "light"}
                onClick={() => update({ theme: "light" })}
              />
              <ThemeBtn
                label="Dark"
                active={state.theme === "dark"}
                onClick={() => update({ theme: "dark" })}
              />
            </div>
          </div>

          <PlaygroundNav page={page} onChange={setPage} />

          <div className="mt-6 space-y-3">
            <StyleRow value={state.style} onPick={onPickStyle} />
            <RadiusRow value={state.radius} onPick={onPickRadius} onCustom={onCustomRadius} />
          </div>
        </header>

        {page === "blueprints" && (
          <Section number="01" title="Blueprints">
            <BlueprintLab />
          </Section>
        )}

        {page === "ui-kit" && (
          <>
            <Section number="01" title="Typography">
              <TypeRow meta="Display / 64">
                <div className="font-display font-light text-[64px] leading-[1.05] tracking-[-0.03em]">
                  Quiet by default.
                </div>
              </TypeRow>
              <TypeRow meta="H1 / 40">
                <h1>Build small, focused tools.</h1>
              </TypeRow>
              <TypeRow meta="H2 / 28">
                <h2>One job, done well.</h2>
              </TypeRow>
              <TypeRow meta="H3 / 18">
                <h3>Section heading</h3>
              </TypeRow>
              <TypeRow meta="Body / 15">
                <p>
                  The body copy carries most of the weight. Set in Inter at a comfortable reading size,
                  with calm leading and no decoration - the type scale itself does the work of hierarchy.
                </p>
              </TypeRow>
              <TypeRow meta="Small / 13">
                <p className="text-[13px] text-fg-muted leading-[1.5]">
                  Smaller text for secondary information, helper notes, and metadata.
                </p>
              </TypeRow>
              <TypeRow meta="Caption / 11">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted font-medium">
                  Labels &amp; eyebrows
                </span>
              </TypeRow>
              <TypeRow meta="Mono / 13">
                <code className="font-mono text-[13px] text-fg-muted">const radius = var(--r-sm);</code>
              </TypeRow>
            </Section>

            <Section number="02" title="Buttons">
              <Demo label="Variants">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Delete</Button>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </Demo>
              <Demo label="Sizes">
                <Button size="sm">Small</Button>
                <Button size="md">Default</Button>
                <Button size="lg">Large</Button>
              </Demo>
              <Demo label="Link">
                <Button variant="link">Read the docs →</Button>
              </Demo>
            </Section>

            <Section number="03" title="Forms">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FieldGroup label="Workspace name">
                  <Input type="text" placeholder="Acme Inc." />
                </FieldGroup>
                <FieldGroup label="Email">
                  <Input type="email" placeholder="you@company.com" />
                </FieldGroup>
                <FieldGroup label="Disabled">
                  <Input type="text" defaultValue="Read-only value" disabled />
                </FieldGroup>
                <FieldGroup label="With placeholder">
                  <Input type="text" placeholder="Type something…" />
                </FieldGroup>
              </div>
            </Section>

            <Section number="04" title="Cards">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="flat">
                  <Eyebrow>Flat</Eyebrow>
                  <div className="mt-2">
                    <CardTitle>Recurring revenue</CardTitle>
                    <CardDescription className="mt-1.5">
                      No border. No background. Pure type and rhythm.
                    </CardDescription>
                  </div>
                </Card>
                <Card variant="bordered">
                  <Eyebrow>Bordered</Eyebrow>
                  <div className="mt-2">
                    <CardTitle>Active subscribers</CardTitle>
                    <CardDescription className="mt-1.5">
                      A single hairline divides this from the page.
                    </CardDescription>
                  </div>
                </Card>
                <Card variant="shadow">
                  <Eyebrow>Shadow</Eyebrow>
                  <div className="mt-2">
                    <CardTitle>Trial conversions</CardTitle>
                    <CardDescription className="mt-1.5">
                      Use sparingly - for floating panels and popovers.
                    </CardDescription>
                  </div>
                </Card>
              </div>
            </Section>

            <Section number="05" title="Components">
              <Demo label="Spinner">
                <Spinner size="sm" />
                <Spinner size="md" brand />
                <Spinner size="lg" brand />
                <span className="text-[13px] text-fg-muted ml-2">inline + brand-colored variants</span>
              </Demo>

              <Demo label="Checkbox">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox defaultChecked />
                  <span>Send me product updates</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox />
                  <span>Subscribe to the changelog</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-not-allowed opacity-60">
                  <Checkbox disabled />
                  <span>Disabled option</span>
                </label>
              </Demo>

              <Demo label="Textarea">
                <Textarea
                  placeholder="Tell us what you're building…"
                  className="max-w-md"
                  defaultValue="Editable. Resizable from the bottom-right corner. Same border + focus pattern as Input."
                />
              </Demo>

              <Demo label="Select">
                <div className="w-[200px]">
                  <Select defaultValue="pro">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hobby">Hobby - free</SelectItem>
                      <SelectItem value="starter">Starter - $9/mo</SelectItem>
                      <SelectItem value="pro">Pro - $29/mo</SelectItem>
                      <SelectItem value="team">Team - $99/mo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Demo>

              <Demo label="Dropdown menu">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      Account
                      <svg
                        viewBox="0 0 12 12"
                        className="w-3 h-3 ml-1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M3 4.5 L6 7.5 L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Acme Inc.</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Billing</DropdownMenuItem>
                    <DropdownMenuItem>Team members</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-danger">Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Demo>

              <Demo label="Tooltip">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="sm">
                      Hover me
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tooltips use the inverse of the surface tokens</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Info">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5.5v.01M8 7.5v3" strokeLinecap="round" />
                      </svg>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Icon-button tooltip</TooltipContent>
                </Tooltip>
              </Demo>

              <Demo label="Dialog (and Confirm pattern)">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update billing email</DialogTitle>
                      <DialogDescription>
                        Receipts and invoice notifications go to this address.
                      </DialogDescription>
                    </DialogHeader>
                    <Input defaultValue="finance@acme.com" />
                    <DialogFooter>
                      <Button variant="ghost">Cancel</Button>
                      <Button variant="primary">Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="danger">Delete account…</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete this account?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. All your data will be permanently removed.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="secondary">Keep account</Button>
                      <Button variant="primary" className="bg-danger border-danger text-white">
                        Delete forever
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Demo>

              <Demo label="Alert (persistent banner)">
                <div className="flex flex-col gap-3 w-full max-w-xl">
                  <Alert variant="info">
                    <AlertIcon variant="info" />
                    <div>
                      <AlertTitle>Heads up</AlertTitle>
                      <AlertDescription>
                        Your trial ends in 3 days. Upgrade to keep your data.
                      </AlertDescription>
                    </div>
                  </Alert>
                  <Alert variant="success">
                    <AlertIcon variant="success" />
                    <div>
                      <AlertTitle>Saved</AlertTitle>
                      <AlertDescription>Your changes are live.</AlertDescription>
                    </div>
                  </Alert>
                  <Alert variant="warning">
                    <AlertIcon variant="warning" />
                    <div>
                      <AlertTitle>Configuration incomplete</AlertTitle>
                      <AlertDescription>Add a webhook secret to start receiving events.</AlertDescription>
                    </div>
                  </Alert>
                  <Alert variant="danger">
                    <AlertIcon variant="danger" />
                    <div>
                      <AlertTitle>Payment failed</AlertTitle>
                      <AlertDescription>
                        Update your card to avoid losing access on the next renewal.
                      </AlertDescription>
                    </div>
                  </Alert>
                </div>
              </Demo>

              <Demo label="Switch">
                <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
                  <Switch defaultChecked />
                  <span>Email notifications</span>
                </label>
                <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
                  <Switch />
                  <span>Two-factor authentication</span>
                </label>
                <label className="inline-flex items-center gap-3 text-sm cursor-not-allowed opacity-60">
                  <Switch disabled defaultChecked />
                  <span>Disabled (locked on)</span>
                </label>
              </Demo>

              <Demo label="Radio Group">
                <RadioGroup defaultValue="annual" className="flex flex-col gap-2.5">
                  <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
                    <RadioGroupItem value="monthly" />
                    <span>Monthly - $29/mo</span>
                  </label>
                  <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
                    <RadioGroupItem value="annual" />
                    <span>Annual - $23/mo, billed yearly (save 20%)</span>
                  </label>
                  <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
                    <RadioGroupItem value="lifetime" />
                    <span>Lifetime - $499 once</span>
                  </label>
                </RadioGroup>
              </Demo>

              <Demo label="Accordion">
                <Accordion type="single" collapsible className="w-full max-w-xl">
                  <AccordionItem value="a">
                    <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
                    <AccordionContent>
                      Yes - cancel from your account settings. Your plan stays active until the end of
                      the billing period.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="b">
                    <AccordionTrigger>Do you offer refunds?</AccordionTrigger>
                    <AccordionContent>
                      Within 14 days of upgrade, no questions asked. Email us and we'll process it.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="c">
                    <AccordionTrigger>Is there a free trial?</AccordionTrigger>
                    <AccordionContent>
                      Yes - 14 days of Pro features when you sign up, no card required.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Demo>

              <Demo label="Tabs">
                <Tabs defaultValue="overview" className="w-full max-w-xl">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="usage">Usage</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                    <TabsTrigger value="api">API</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="text-sm text-fg-muted">
                    Account at a glance - connected services, recent activity, current plan.
                  </TabsContent>
                  <TabsContent value="usage" className="text-sm text-fg-muted">
                    How much of your plan you've used this billing cycle.
                  </TabsContent>
                  <TabsContent value="billing" className="text-sm text-fg-muted">
                    Invoices, payment method, plan changes.
                  </TabsContent>
                  <TabsContent value="api" className="text-sm text-fg-muted">
                    API keys + webhook configuration.
                  </TabsContent>
                </Tabs>
              </Demo>

              <Demo label="Avatar">
                <Avatar>
                  <AvatarFallback>VP</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>OB</AvatarFallback>
                </Avatar>
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-[14px]">AC</AvatarFallback>
                </Avatar>
                <span className="text-[13px] text-fg-muted ml-2">
                  with image fallback to initials
                </span>
              </Demo>

              <Demo label="Badge">
                <Badge>Default</Badge>
                <Badge variant="primary">New</Badge>
                <Badge variant="success">Live</Badge>
                <Badge variant="warning">Beta</Badge>
                <Badge variant="danger">Deprecated</Badge>
                <Badge variant="outline">Internal</Badge>
              </Demo>

              <Demo label="Skeleton (loading placeholder)">
                <div className="w-full max-w-md flex flex-col gap-3">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </Demo>

              <Demo label="Separator">
                <div className="w-full max-w-md">
                  <div className="text-sm text-fg">Account</div>
                  <Separator className="my-3" />
                  <div className="text-sm text-fg-muted">Billing</div>
                  <Separator className="my-3" />
                  <div className="text-sm text-fg-muted">Team</div>
                </div>
              </Demo>

              <Demo label="Toast (sonner)">
                <Button variant="secondary" onClick={() => toast.success("Saved", { description: "Your changes are live." })}>
                  Success
                </Button>
                <Button variant="secondary" onClick={() => toast.error("Couldn't save", { description: "Network error - try again." })}>
                  Error
                </Button>
                <Button variant="secondary" onClick={() => toast("Action available", { description: "Click anywhere to dismiss.", action: { label: "Undo", onClick: () => toast("Undone") } })}>
                  With action
                </Button>
              </Demo>

              <Demo label="Empty / Error / Loading states">
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                  <EmptyState
                    title="No projects yet"
                    description="Create your first project to get started."
                    action={<Button variant="primary" size="sm">New project</Button>}
                  />
                  <ErrorState
                    title="Couldn't load"
                    description="The server didn't respond in time."
                    error={new Error("ECONNREFUSED 127.0.0.1:5432")}
                    action={<Button variant="secondary" size="sm">Retry</Button>}
                  />
                  <LoadingState label="Fetching billing history…" />
                </div>
              </Demo>

              <Demo label="Data table (TanStack Table)">
                <DataTableDemo />
              </Demo>
            </Section>
          </>
        )}

        {page === "screens" && (
          <Section number="01" title="App screens">
            <p className="text-[13px] text-fg-muted leading-[1.5] mb-6 max-w-[56ch]">
              Mockups of the screens every app needs. The components above plus the layered theme
              tokens compose into these without any per-app code.
            </p>

            <Demo label="Login">
              <FullScreenButton onClick={() => setFullScreen("login")} />
              <AppFrame>
                <LoginScreen />
              </AppFrame>
            </Demo>

            <Demo label="Register">
              <FullScreenButton onClick={() => setFullScreen("register")} />
              <AppFrame>
                <RegisterScreen />
              </AppFrame>
            </Demo>

            <Demo label="Pricing">
              <FullScreenButton onClick={() => setFullScreen("pricing")} />
              <AppFrame>
                <PricingScreen />
              </AppFrame>
            </Demo>

            <Demo label="Marketing landing">
              <FullScreenButton onClick={() => setFullScreen("marketing")} />
              <AppFrame>
                <div className="text-center text-fg-muted text-[13px] py-12">
                  Hero + FeatureGrid + Testimonials + LogoCloud + CTASection.
                  Open full-screen to see the composed page.
                </div>
              </AppFrame>
            </Demo>

            <Demo label="Dashboard layout">
              <FullScreenButton onClick={() => setFullScreen("dashboard")} />
              <AppFrame>
                <div className="text-center text-fg-muted text-[13px] py-12">
                  52px sticky topnav + main. Open full-screen to interact.
                </div>
              </AppFrame>
            </Demo>

            <Demo label="Settings layout">
              <FullScreenButton onClick={() => setFullScreen("settings")} />
              <AppFrame>
                <div className="text-center text-fg-muted text-[13px] py-12">
                  Sidebar + content with section grouping. Open full-screen to interact.
                </div>
              </AppFrame>
            </Demo>

            <Demo label="Footer">
              <AppFrame>
                <Footer
                  brandName="MicroSaaS Core"
                  tagline="A factory for indie SaaS, built on care."
                  columns={[
                    {
                      title: "Product",
                      links: [
                        { label: "Features", href: "#" },
                        { label: "Pricing", href: "#" },
                        { label: "Changelog", href: "#" },
                      ],
                    },
                    {
                      title: "Company",
                      links: [
                        { label: "About", href: "#" },
                        { label: "Blog", href: "#" },
                        { label: "Contact", href: "#" },
                      ],
                    },
                    {
                      title: "Resources",
                      links: [
                        { label: "Docs", href: "#" },
                        { label: "API", href: "#" },
                        { label: "Status", href: "#" },
                      ],
                    },
                  ]}
                  legal={[
                    { label: "Privacy", href: "#" },
                    { label: "Terms", href: "#" },
                    { label: "Cookies", href: "#" },
                  ]}
                />
              </AppFrame>
            </Demo>
          </Section>
        )}

        {page === "tokens" && (
          <>
            <Section number="01" title="Color">
              <p className="text-[13px] text-fg-muted leading-[1.5] mb-6 max-w-[56ch]">
                All color flows through CSS variables. Pick a Style above to swap the primary + bg pair,
                or override <code className="font-mono text-fg">--primary</code> /{" "}
                <code className="font-mono text-fg">--bg</code> directly in any consuming app's{" "}
                <code className="font-mono text-fg">app.css</code>.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(
                  [
                    ["Primary", "--primary"],
                    ["Primary fg", "--primary-fg"],
                    ["Background", "--bg"],
                    ["Foreground", "--fg"],
                    ["Muted", "--fg-muted"],
                    ["Subtle", "--fg-subtle"],
                    ["Border", "--border"],
                    ["Border strong", "--border-strong"],
                    ["Field", "--field"],
                    ["Hover", "--hover"],
                    ["Success", "--success"],
                    ["Warning", "--warning"],
                    ["Danger", "--danger"],
                  ] as const
                ).map(([name, varName]) => (
                  <div key={name} className="flex flex-col gap-1.5">
                    <div
                      className="h-14 rounded border border-border"
                      style={{ background: `rgb(var(${varName}))` }}
                    />
                    <div className="font-mono text-[11px] text-fg">{name}</div>
                    <div className="font-mono text-[11px] text-fg-subtle">{varName}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section number="02" title="Spacing">
              <div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
                  const px = [4, 8, 12, 16, 24, 32, 48, 64][n - 1];
                  return (
                    <div key={n} className="grid grid-cols-[60px_1fr_80px] items-center gap-4 py-1.5">
                      <div className="font-mono text-[12px] text-fg-muted">--s-{n}</div>
                      <div className="h-px bg-fg" style={{ width: `${px}px` }} />
                      <div className="font-mono text-[12px] text-fg-subtle text-right">{px}px</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[13px] text-fg-muted leading-[1.5] mt-6 max-w-[56ch]">
                Radius tokens: <code className="font-mono text-fg">--r-sm</code> (4px) for fields and
                buttons, <code className="font-mono text-fg">--r-md</code> (8px) for cards,{" "}
                <code className="font-mono text-fg">--r-pill</code> (999px) for tags and switches.
              </p>
            </Section>
          </>
        )}

        <footer className="mt-16 pt-6 border-t border-border text-fg-subtle font-mono text-[12px] flex justify-between flex-wrap gap-2">
          <span>microsaas-core / playground</span>
          <span>
            {state.style?.name ?? "default"} · {state.theme} ·{" "}
            {state.radius
              ? state.radius.sm === 999
                ? "pill"
                : `${state.radius.sm}/${state.radius.md}`
              : "subtle"}
          </span>
        </footer>
      </div>
    </TooltipProvider>
  );
}

/* ------------ helpers ------------ */

function PlaygroundNav({
  page,
  onChange,
}: {
  page: PlaygroundPage;
  onChange: (page: PlaygroundPage) => void;
}) {
  return (
    <nav className="mt-8 grid grid-cols-2 gap-2 border-y border-border py-3 md:grid-cols-4">
      {PLAYGROUND_PAGES.map((item) => {
        const active = item.id === page;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={active ? "page" : undefined}
            className={`min-h-[64px] px-3 py-2 text-left transition-colors ${active ? "bg-fg text-bg" : "text-fg hover:bg-hover"
              }`}
          >
            <span className="block font-mono text-[11px] uppercase tracking-[0.08em] opacity-70">
              {item.label}
            </span>
            <span className="mt-1 block text-[12px] leading-[1.35] opacity-75">
              {item.description}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function BlueprintLab() {
  const [selectedId, setSelectedId] = useState<BlueprintId>("tool-first");

  return (
    <div
      className="relative left-1/2 -translate-x-1/2 space-y-6"
      style={{ width: "min(1180px, calc(100vw - 48px))" }}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_340px] md:items-end">
        <p className="text-[13px] text-fg-muted leading-[1.5] max-w-[68ch]">
          These are app-shape previews, not component demos. Each tab shows the first serious
          product surface the generator should produce for that blueprint, plus the contract the
          generated app must satisfy.
        </p>
        <div className="border border-border px-4 py-3">
          <Eyebrow>Quality gate</Eyebrow>
          <p className="mt-2 text-sm leading-[1.45]">
            Generate from the archetype, then run the anti-slop gate in{" "}
            <code className="font-mono text-[12px]">FACTORY.md</code> §8.
          </p>
        </div>
      </div>

      <Tabs value={selectedId} onValueChange={(value) => setSelectedId(value as BlueprintId)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="mb-6 flex h-auto w-max min-w-full justify-start gap-1 bg-transparent p-0">
            {BLUEPRINTS.map((blueprint) => (
              <TabsTrigger
                key={blueprint.id}
                value={blueprint.id}
                className="font-mono text-[11px] uppercase tracking-[0.08em]"
              >
                {blueprint.id}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {BLUEPRINTS.map((blueprint) => (
          <TabsContent key={blueprint.id} value={blueprint.id} className="mt-0">
            <BlueprintPanel blueprint={blueprint} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function BlueprintPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <Eyebrow>{blueprint.id}</Eyebrow>
            <h3 className="mt-1 text-[32px] leading-tight">{blueprint.name}</h3>
            <p className="mt-2 text-sm text-fg-muted">{blueprint.shape}</p>
          </div>
          <Badge variant="outline">{blueprint.preview}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BlueprintSpecBlock label="Product loop" value={blueprint.loop} />
          <BlueprintSpecBlock label="Monetization" value={blueprint.monetization} />
        </div>

        <div className="mt-5 border border-border-strong bg-bg">
          <div className="grid border-b border-border bg-hover/50 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted md:grid-cols-[180px_1fr]">
            <span>Generation contract</span>
            <span>What the app must implement</span>
          </div>
          <BlueprintContractRow
            title="First screen"
            body={firstScreenRequirement(blueprint.id)}
          />
          <BlueprintContractRow
            title="Niche slot"
            body={nicheSlotRequirement(blueprint.id)}
          />
          <BlueprintContractRow
            title="Paywall"
            body={paywallRequirement(blueprint.id)}
          />
          <BlueprintContractRow
            title="Day-one proof"
            body={proofRequirement(blueprint.id)}
          />
        </div>
      </div>

      <aside className="space-y-5 xl:pt-[84px]">
        <div>
          <Eyebrow>Routes</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {blueprint.routes.map((route) => (
              <code
                key={route}
                className="border border-border bg-bg px-2 py-1 font-mono text-[11px]"
              >
                {route}
              </code>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Data</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
            {blueprint.data.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[0.55em] h-px w-4 shrink-0 bg-border-strong" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-warning/40 bg-warning/10 px-4 py-3">
          <Eyebrow>Anti-slop risks</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-fg">
            {blueprint.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>

        <div className="border border-border-strong px-4 py-3">
          <Eyebrow>Use before generation</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
            <li>Write a concrete `APP_BRIEF.md`.</li>
            <li>Pick one niche and one retention loop.</li>
            <li>Reject the build if the first screen could belong to another app.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function BlueprintSpecBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-4 py-3">
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-2 text-sm leading-[1.5] text-fg">{value}</p>
    </div>
  );
}

function BlueprintContractRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[180px_1fr]">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
        {title}
      </div>
      <p className="text-sm leading-[1.5] text-fg">{body}</p>
    </div>
  );
}

function firstScreenRequirement(id: BlueprintId): string {
  const map: Record<BlueprintId, string> = {
    "tool-first": "The working tool is the hero. No generic marketing screen before the input.",
    wizard: "The first step starts the build and makes the final artifact concrete.",
    classic: "The public page drives signup, but the authenticated dashboard owns the product.",
    alert: "Show monitor setup and recent alert evidence; the notification is the product.",
    dashboard: "Quick-add is more important than charts. The main action must be immediately usable.",
    widget: "Show install/configuration and the public embed contract, not a generic dashboard.",
    directory: "Search, category pages, and listing quality are the product surface.",
  };
  return map[id];
}

function nicheSlotRequirement(id: BlueprintId): string {
  const map: Record<BlueprintId, string> = {
    "tool-first": "`src/features/processor.ts` owns the domain-specific processor.",
    wizard: "Preview/final generation functions own the artifact quality.",
    classic: "The app-specific resource model defines the workspace workflow.",
    alert: "`runCheck` and `shouldAlert` own the notification value.",
    dashboard: "The entry schema and aggregation logic define the tracker.",
    widget: "The embed behavior, config, and event payload define the product.",
    directory: "The listing schema, curation rules, and SEO metadata define quality.",
  };
  return map[id];
}

function paywallRequirement(id: BlueprintId): string {
  const map: Record<BlueprintId, string> = {
    "tool-first": "Free run first; paid save, export, history, volume, or advanced output.",
    wizard: "Pay at the end after the user can inspect a watermarked preview.",
    classic: "Paid plans gate durable workspace value: seats, resources, integrations, or limits.",
    alert: "Paid plans gate monitor count, frequency, retention, and notification channels.",
    dashboard: "Paid plans gate export, longer history, insights, team views, or automation.",
    widget: "Paid plans gate branding removal, usage volume, customization, and analytics.",
    directory: "Paid submissions, featured placement, sponsorship, or submitter analytics.",
  };
  return map[id];
}

function proofRequirement(id: BlueprintId): string {
  const map: Record<BlueprintId, string> = {
    "tool-first": "One realistic input produces one domain-specific result.",
    wizard: "A generated preview artifact exists and visibly differs from the paid final.",
    classic: "A user can reach the first activation milestone after signup.",
    alert: "A monitor can run, persist state, and dedupe an alert.",
    dashboard: "A user can add a real record and see it affect history or aggregates.",
    widget: "The public script can load config and send at least one event.",
    directory: "A listing can be submitted, reviewed, approved, and rendered with SEO metadata.",
  };
  return map[id];
}

function ThemeBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}

function StyleRow({
  value,
  onPick,
}: {
  value: Style | null;
  onPick: (next: Style | null) => void;
}) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle w-[88px] shrink-0 pt-3">
        Style
      </span>
      <div className="flex gap-2 items-start flex-wrap flex-1">
        {STYLE_PRESETS.map((s) => {
          const active = value?.name === s.name;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onPick(s)}
              title={`${s.name} - light ${s.light.primary} on ${s.light.bg}, dark ${s.dark.primary} on ${s.dark.bg}`}
              aria-label={s.name}
              aria-pressed={active}
              className="group flex flex-col items-center gap-1.5"
            >
              <span
                className="relative block w-[120px] h-[72px] rounded-md border border-border-strong overflow-hidden group-hover:scale-[1.03]"
                style={{
                  background: `linear-gradient(90deg, ${s.light.bg} 50%, ${s.dark.bg} 50%)`,
                  boxShadow: active ? "0 0 0 2px rgb(var(--bg)), 0 0 0 3px rgb(var(--fg))" : undefined,
                }}
              >
                {/* Light-mode primary mini-button on the left half */}
                <span
                  className="absolute top-1/2 left-[25%] -translate-x-1/2 -translate-y-1/2 w-10 h-4 rounded-[3px]"
                  style={{ background: s.light.primary }}
                />
                {/* Dark-mode primary mini-button on the right half */}
                <span
                  className="absolute top-1/2 left-[75%] -translate-x-1/2 -translate-y-1/2 w-10 h-4 rounded-[3px]"
                  style={{ background: s.dark.primary }}
                />
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] ${active ? "text-fg" : "text-fg-subtle group-hover:text-fg"
                  }`}
              >
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onPick(null)}
        disabled={value === null}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle hover:text-fg disabled:opacity-30 disabled:hover:text-fg-subtle pt-3 shrink-0"
      >
        reset
      </button>
    </div>
  );
}

function RadiusRow({
  value,
  onPick,
  onCustom,
}: {
  value: { sm: number; md: number } | null;
  onPick: (preset: RadiusPreset | null) => void;
  onCustom: (sm: number | null) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value.sm) : "");

  useEffect(() => {
    setDraft(value ? String(value.sm) : "");
  }, [value]);

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return onCustom(null);
    const n = Number.parseInt(trimmed, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 999) onCustom(n);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle w-[88px] shrink-0">
        Radius
      </span>
      <div className="flex gap-1.5 items-center flex-wrap">
        {RADIUS_PRESETS.map((p) => {
          const active = value?.sm === p.sm && value?.md === p.md;
          const previewRadius = Math.min(p.sm, 12);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => onPick(p)}
              title={`${p.name} - ${p.sm === 999 ? "pill" : `${p.sm}px`} / ${p.md === 999 ? "pill" : `${p.md}px`}`}
              aria-label={p.name}
              aria-pressed={active}
              className="w-7 h-5 border border-border-strong bg-fg hover:scale-110"
              style={{
                borderRadius: p.sm === 999 ? "999px" : `${previewRadius}px`,
                boxShadow: active ? "0 0 0 2px rgb(var(--bg)), 0 0 0 3px rgb(var(--fg))" : undefined,
              }}
            />
          );
        })}
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => e.key === "Enter" && commitDraft()}
        placeholder="px"
        spellCheck={false}
        className="font-mono text-[12px] px-2 py-[5px] w-[88px] border border-border-strong rounded bg-field text-fg placeholder:text-fg-subtle focus:outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => onPick(null)}
        disabled={value === null}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle hover:text-fg disabled:opacity-30 disabled:hover:text-fg-subtle"
      >
        reset
      </button>
      <code className="font-mono text-[11px] text-fg-subtle ml-auto hidden sm:inline">--r-sm</code>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-12 border-t border-border first-of-type:border-t-0 first-of-type:pt-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-6">
        {number} - {title}
      </div>
      {children}
    </section>
  );
}

function Demo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-6 [&+&]:border-t [&+&]:border-dashed [&+&]:border-border">
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-fg-subtle mb-3">
        {label}
      </div>
      <div className="flex flex-wrap gap-3 items-center">{children}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted font-medium">
      {children}
    </div>
  );
}

function TypeRow({ meta, children }: { meta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-6 items-baseline py-3 border-b border-dashed border-border last:border-b-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle">{meta}</div>
      <div>{children}</div>
    </div>
  );
}

/** Browser-chrome frame that wraps an "app screen" mockup. Forces the inner
 * content to read as a self-contained UI rather than as part of the playground. */
function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full border border-border-strong bg-bg overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-hover">
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
        <span className="w-2.5 h-2.5 rounded-full bg-border-strong" />
      </div>
      <div className="px-6 py-10">{children}</div>
    </div>
  );
}

/** Full-screen wrapper used when an app screen is opened standalone. */
function FullScreenView({ onExit, children }: { onExit: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <button
        type="button"
        onClick={onExit}
        className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[11px] uppercase tracking-[0.08em] border border-border-strong bg-field text-fg-muted hover:text-fg hover:bg-hover"
        aria-label="Exit full screen"
      >
        <svg
          viewBox="0 0 12 12"
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M3 3 L9 9 M9 3 L3 9" strokeLinecap="round" />
        </svg>
        Exit
      </button>
      {children}
    </div>
  );
}

function FullScreenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle hover:text-fg"
      aria-label="View full screen"
    >
      <svg
        viewBox="0 0 12 12"
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M2 4 V2 H4 M8 2 H10 V4 M10 8 V10 H8 M4 10 H2 V8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Full screen
    </button>
  );
}

function AuthFullPage({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-hover/30 px-6 py-12">
      {children}
    </main>
  );
}

/* ---------- App-screen mockups (also used full-screen) ---------- */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.42 3.46 1.18 4.95l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function LoginScreen() {
  return (
    <Card variant="bordered" className="w-full max-w-sm mx-auto">
      <div className="text-center mb-6">
        <CardTitle className="text-[22px]">Welcome back</CardTitle>
        <CardDescription className="mt-1">
          Sign in to your <span className="text-primary">SaaS</span> account.
        </CardDescription>
      </div>

      <Button variant="secondary" size="lg" className="w-full mb-4">
        <GoogleIcon />
        <span className="ml-2">Continue with Google</span>
      </Button>

      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
          or with email
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="you@company.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <Label>Password</Label>
            <a
              href="#"
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary hover:underline"
            >
              Forgot?
            </a>
          </div>
          <Input type="password" placeholder="••••••••" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox />
          <span>Stay signed in for 30 days</span>
        </label>
        <Button variant="primary" size="lg" className="mt-2">
          Sign in
        </Button>
        <p className="text-center text-[13px] text-fg-muted">
          Don't have an account?{" "}
          <a href="#" className="text-primary hover:underline">
            Create one
          </a>
        </p>
      </div>
    </Card>
  );
}

function RegisterScreen() {
  return (
    <Card variant="bordered" className="w-full max-w-sm mx-auto">
      <div className="text-center mb-6">
        <CardTitle className="text-[22px]">Create your account</CardTitle>
        <CardDescription className="mt-1">
          Start your free trial - no card required.
        </CardDescription>
      </div>

      <Button variant="secondary" size="lg" className="w-full mb-4">
        <GoogleIcon />
        <span className="ml-2">Sign up with Google</span>
      </Button>

      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
          or with email
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Workspace name</Label>
          <Input type="text" placeholder="Acme Inc." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="you@company.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Password</Label>
          <Input type="password" placeholder="At least 8 characters" />
        </div>
        <label className="inline-flex items-start gap-2 text-[13px] text-fg-muted cursor-pointer">
          <Checkbox className="mt-0.5" />
          <span>
            I agree to the{" "}
            <a href="#" className="text-primary hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <Button variant="primary" size="lg" className="mt-2">
          Create account
        </Button>
        <p className="text-center text-[13px] text-fg-muted">
          Already have an account?{" "}
          <a href="#" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </Card>
  );
}

function PricingScreen() {
  return (
    <PricingPage
      eyebrow="Pricing"
      title="Pricing that scales with you"
      subtitle="Start free. Upgrade when you're ready. Annual saves you 20%."
      tiers={[
        {
          name: "Hobby",
          price: { monthly: "$0", cadence: "forever" },
          description: "For tinkering and side projects.",
          features: ["Up to 100 records", "Community support", "Public projects only"],
          ctaLabel: "Start free",
          ctaHref: "#",
        },
        {
          name: "Pro",
          price: { monthly: "$29", annual: "$23", annualSaving: "Save 20%" },
          description: "For solo founders and small teams.",
          features: [
            "Unlimited records",
            "Priority email support",
            "Private projects",
            "Custom domains",
            "Export to CSV / JSON",
          ],
          ctaLabel: "Upgrade to Pro",
          ctaHref: "#",
          highlighted: true,
        },
        {
          name: "Team",
          price: { monthly: "$99", annual: "$79" },
          description: "For growing companies.",
          features: [
            "Everything in Pro",
            "Up to 10 team members",
            "SSO / SAML",
            "Audit log",
            "Priority phone support",
          ],
          ctaLabel: "Contact sales",
          ctaHref: "#",
          badge: "Best value",
        },
      ]}
      faq={[
        {
          q: "Can I cancel anytime?",
          a: "Yes - cancel from your account settings. Your plan stays active until the end of the billing period.",
        },
        {
          q: "Do you offer refunds?",
          a: "Within 14 days of upgrade, no questions asked. Email us and we'll process it.",
        },
        {
          q: "Is there a free trial on paid plans?",
          a: "Yes - 14 days of Pro features when you sign up, no card required.",
        },
        {
          q: "What payment methods do you support?",
          a: "Card, Apple Pay, and Google Pay via Polar. EU SEPA on annual plans.",
        },
      ]}
      reassurance={<>Cancel anytime · 14-day money-back · No surprise charges</>}
    />
  );
}

/* ---------- Marketing landing ---------- */

function MarketingScreen() {
  return (
    <div className="w-full">
      <Hero
        eyebrow="Public beta"
        title={
          <>
            Ship a SaaS in a weekend.
            <br />
            Then <span className="text-primary">ship 99 more</span>.
          </>
        }
        subtitle="A factory for indie SaaS - auth, billing, analytics, and a typography-forward design system, ready out of the box."
        ctaLabel="Start building"
        ctaHref="#"
        secondaryLabel="See pricing"
        secondaryHref="#"
        reassurance="No card required · Cancel anytime"
      />
      <LogoCloud
        eyebrow="Trusted by makers at"
        logos={[
          <span key="1" className="font-display text-[18px]">Acme</span>,
          <span key="2" className="font-display text-[18px]">Globex</span>,
          <span key="3" className="font-display text-[18px]">Initech</span>,
          <span key="4" className="font-display text-[18px]">Hooli</span>,
          <span key="5" className="font-display text-[18px]">Pied Piper</span>,
        ]}
      />
      <FeatureGrid
        eyebrow="Why this stack"
        title="Everything you need, none of what you don't."
        subtitle="Pre-wired for auth, billing, and emails. The rest of the stack is your choice."
        items={[
          {
            icon: <FeatureIcon path="M2 7 L8 3 L14 7 L8 11 Z M2 9 L8 13 L14 9" />,
            title: "Auth + billing wired",
            body: "better-auth + Polar plug in via one import. Magic links, OAuth, subscriptions, webhooks - all included.",
          },
          {
            icon: <FeatureIcon path="M3 4 H13 V12 H3 Z M3 7 H13" />,
            title: "Design system in the box",
            body: "14 brand styles, dark mode that just works, opacity-aware tokens. Your app looks intentional from day 1.",
          },
          {
            icon: <FeatureIcon path="M8 2 V14 M2 8 H14" />,
            title: "Type-safe everywhere",
            body: "Drizzle, Zod, TanStack Router - typed end-to-end. Boot fails loudly when env is wrong.",
          },
          {
            icon: <FeatureIcon path="M2 12 L8 4 L14 12 Z" />,
            title: "Local-first, deploy anywhere",
            body: "SQLite per app. Push to Coolify, Vercel, Fly, or your own VPS - same code, different host.",
          },
          {
            icon: <FeatureIcon path="M3 8 L7 12 L13 4" />,
            title: "Honest open core",
            body: "MIT licensed. No tracking, no telemetry, no upsell. Fork the factory if you want.",
          },
          {
            icon: <FeatureIcon path="M4 4 H12 V12 H4 Z M4 8 H12" />,
            title: "Real ergonomics",
            body: "Form helpers, toasts, empty states, layouts. Stop writing the same 50 lines in every app.",
          },
        ]}
      />
      <Testimonials
        eyebrow="What people say"
        title="Indie hackers, shipping more."
        items={[
          {
            quote: "Cut my time-to-launch from a week to a weekend. The design system is the killer feature.",
            name: "Sasha Lee",
            role: "Solo founder, Inventree",
          },
          {
            quote: "I had auth, billing, and a landing page in two hours. The boring parts are done for you.",
            name: "Jordan Park",
            role: "Maker, Stationery.so",
          },
          {
            quote: "Finally a factory that doesn't look like a factory. Each app feels handcrafted.",
            name: "Riley Chen",
            role: "Indie SaaS, multiple",
          },
        ]}
      />
      <CTASection
        title="Ship the next one this weekend."
        subtitle="Scaffold an app, pick a brand style, and you're staring at a real signup flow in 10 minutes."
        ctaLabel="Start free"
        ctaHref="#"
        secondaryLabel="Read the docs"
        secondaryHref="#"
        reassurance="No card · 14-day money-back · MIT licensed"
      />
      <Footer
        brandName="MicroSaaS Core"
        tagline="A factory for indie SaaS, built on care."
        columns={[
          {
            title: "Product",
            links: [
              { label: "Features", href: "#" },
              { label: "Pricing", href: "#" },
              { label: "Changelog", href: "#" },
            ],
          },
          {
            title: "Company",
            links: [
              { label: "About", href: "#" },
              { label: "Contact", href: "#" },
            ],
          },
        ]}
        legal={[
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ]}
      />
    </div>
  );
}

function FeatureIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Dashboard layout ---------- */

function DashboardScreen({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? "min-h-screen w-full" : "w-screen -mx-6 -my-6"}>
      <DashboardLayout
        brand={
          <span className="font-display font-medium text-[16px] tracking-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 -translate-y-[2px]" />
            MicroSaaS Core
          </span>
        }
        nav={
          <>
            <a href="#" className="px-2 py-1 text-[13px] rounded-sm text-fg font-medium bg-hover">Overview</a>
            <a href="#" className="px-2 py-1 text-[13px] rounded-sm text-fg-muted hover:text-fg">Customers</a>
            <a href="#" className="px-2 py-1 text-[13px] rounded-sm text-fg-muted hover:text-fg">Revenue</a>
            <a href="#" className="px-2 py-1 text-[13px] rounded-sm text-fg-muted hover:text-fg">Settings</a>
          </>
        }
        user={
          <>
            <Button variant="primary" size="sm">Upgrade</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>VP</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>vlad@offbeatport.com</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-danger">Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="max-w-5xl mx-auto px-6 py-12">
          <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[28px] mb-1">Overview</h1>
              <p className="text-fg-muted text-[14px]">What changed since last week.</p>
            </div>
            <Button variant="primary">New project</Button>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card variant="bordered">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle mb-1">Active subscribers</div>
              <div className="font-display text-[40px] font-light leading-none tracking-[-0.02em]">1,284</div>
              <div className="text-success text-[12px] mt-1">+12% vs last month</div>
            </Card>
            <Card variant="bordered">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle mb-1">MRR</div>
              <div className="font-display text-[40px] font-light leading-none tracking-[-0.02em]">$8,420</div>
              <div className="text-success text-[12px] mt-1">+$612 this month</div>
            </Card>
            <Card variant="bordered">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle mb-1">Trial conversions</div>
              <div className="font-display text-[40px] font-light leading-none tracking-[-0.02em]">42%</div>
              <div className="text-fg-muted text-[12px] mt-1">over the last 30 days</div>
            </Card>
          </div>
          <h2 className="text-[18px] mb-3">Recent customers</h2>
          <DataTableDemo />
        </div>
      </DashboardLayout>
    </div>
  );
}

/* ---------- Settings layout ---------- */

function SettingsScreen({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? "min-h-screen w-full" : "w-screen -mx-6 -my-6"}>
      <SettingsLayout
        title="Settings"
        description="Configure your account, team, and integrations."
        nav={
          <>
            <SettingsNavItem href="#" active>Profile</SettingsNavItem>
            <SettingsNavItem href="#">Account</SettingsNavItem>
            <SettingsNavItem href="#">Billing</SettingsNavItem>
            <SettingsNavItem href="#">Team</SettingsNavItem>
            <SettingsNavItem href="#">API keys</SettingsNavItem>
            <SettingsNavItem href="#">Notifications</SettingsNavItem>
            <SettingsNavItem href="#">Danger zone</SettingsNavItem>
          </>
        }
      >
        <SettingsSection title="Profile" description="How others see you in shared workspaces.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input defaultValue="Vlad Palos" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input defaultValue="vlad@offbeatport.com" type="email" />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Notifications" description="Pick what reaches your inbox.">
          <label className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0">
            <div>
              <div className="text-sm">Weekly digest</div>
              <div className="text-fg-muted text-[12px]">Summary of new signups and revenue every Monday.</div>
            </div>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0">
            <div>
              <div className="text-sm">Failed payments</div>
              <div className="text-fg-muted text-[12px]">Get notified when a customer's card fails.</div>
            </div>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between gap-4 py-2">
            <div>
              <div className="text-sm">Marketing updates</div>
              <div className="text-fg-muted text-[12px]">Newsletters and product launches.</div>
            </div>
            <Switch />
          </label>
        </SettingsSection>

        <SettingsSection title="Billing cadence" description="Control how you're charged.">
          <RadioGroup defaultValue="annual" className="flex flex-col gap-2.5">
            <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
              <RadioGroupItem value="monthly" />
              <span>Monthly - $29/mo</span>
            </label>
            <label className="inline-flex items-center gap-3 text-sm cursor-pointer">
              <RadioGroupItem value="annual" />
              <span>Annual - $23/mo, billed yearly (save 20%)</span>
            </label>
          </RadioGroup>
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <Alert variant="danger">
            <AlertIcon variant="danger" />
            <div className="flex-1">
              <AlertTitle>Delete this workspace</AlertTitle>
              <AlertDescription>
                Permanently deletes the workspace and all its data. This cannot be undone.
              </AlertDescription>
            </div>
            <Button variant="danger">Delete</Button>
          </Alert>
        </SettingsSection>
      </SettingsLayout>
    </div>
  );
}

/* ---------- Data-table demo ---------- */

type Customer = {
  name: string;
  email: string;
  plan: "Hobby" | "Pro" | "Team";
  mrr: number;
  status: "Active" | "Trial" | "Cancelled";
};

const CUSTOMERS: Customer[] = [
  { name: "Sasha Lee", email: "sasha@inventree.io", plan: "Pro", mrr: 29, status: "Active" },
  { name: "Jordan Park", email: "jordan@stationery.so", plan: "Team", mrr: 99, status: "Active" },
  { name: "Riley Chen", email: "riley@example.com", plan: "Hobby", mrr: 0, status: "Trial" },
  { name: "Ariel Brooks", email: "ariel@example.com", plan: "Pro", mrr: 29, status: "Active" },
  { name: "Morgan Vu", email: "morgan@example.com", plan: "Pro", mrr: 29, status: "Cancelled" },
];

const customerColumns: ColumnDef<Customer>[] = [
  { accessorKey: "name", header: "Customer" },
  { accessorKey: "email", header: "Email" },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => {
      const plan = row.original.plan;
      const variant: "default" | "primary" | "success" =
        plan === "Team" ? "primary" : plan === "Pro" ? "success" : "default";
      return <Badge variant={variant}>{plan}</Badge>;
    },
  },
  {
    accessorKey: "mrr",
    header: "MRR",
    cell: ({ row }) => `$${row.original.mrr}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status;
      const variant: "success" | "warning" | "danger" =
        s === "Active" ? "success" : s === "Trial" ? "warning" : "danger";
      return <Badge variant={variant}>{s}</Badge>;
    },
  },
];

function DataTableDemo() {
  return (
    <DataTable
      columns={customerColumns}
      data={CUSTOMERS}
      initialSorting={[{ id: "mrr", desc: true }]}
    />
  );
}

const ALERT_ICON_PATHS = {
  info: <path d="M8 5.5v.01M8 7.5v3" strokeLinecap="round" />,
  success: <path d="M5 8 L7 10 L11 6" strokeLinecap="round" strokeLinejoin="round" />,
  warning: <path d="M8 5v3.5M8 11v.01" strokeLinecap="round" />,
  danger: <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" strokeLinecap="round" />,
} as const;

const ALERT_ICON_COLOR = {
  info: "text-fg-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

function AlertIcon({ variant }: { variant: keyof typeof ALERT_ICON_PATHS }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-4 h-4 mt-0.5 shrink-0 ${ALERT_ICON_COLOR[variant]}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      {ALERT_ICON_PATHS[variant]}
    </svg>
  );
}
