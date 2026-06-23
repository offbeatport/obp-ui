import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { createProject } from "~/lib/project-fns";
import type { ChannelType } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import { CHANNEL_GROUPS, CHANNEL_LABELS, CHANNEL_DISABLED } from "~/lib/channels";
import { ChannelIcon } from "~/lib/channel-icons";
import { getOpportunityById } from "~/lib/server-fns";

export const Route = createFileRoute("/i/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    opportunityId: s.opportunityId ? Number(s.opportunityId) : undefined,
  }),
  loader: async ({ location }) => {
    const { opportunityId } = location.search as { opportunityId?: number };
    if (!opportunityId) return null;
    return getOpportunityById({ data: { id: opportunityId } });
  },
  component: NewProjectPage,
});

// ── Direction type detection ──────────────────────────────────────────────────

const KNOWN_PLATFORMS = [
  "twitter", "x.com", "notion", "shopify", "figma", "airtable", "monday",
  "slack", "discord", "youtube", "instagram", "tiktok", "linkedin", "github",
  "jira", "salesforce", "hubspot", "stripe", "zapier", "make.com", "asana",
  "trello", "clickup", "webflow", "squarespace", "wordpress", "wix",
  "mailchimp", "intercom", "zendesk", "typeform", "calendly",
];

type DirectionType = "domain" | "platform" | "space" | "hunch";

const DOMAIN_RE = /^[a-z0-9-]+\.(com|io|co|app|dev|net|org|ai|so|xyz|gg|me|sh|co\.uk|to|is|it|do|vc|us)$/i;

function detectType(direction: string): DirectionType {
  const lower = direction.toLowerCase().trim();
  if (!lower) return "hunch";
  if (DOMAIN_RE.test(lower)) return "domain";
  if (KNOWN_PLATFORMS.some(p => lower.includes(p))) return "platform";
  if (lower.split(/\s+/).length <= 4) return "space";
  return "hunch";
}

const TYPE_LABELS: Record<DirectionType, { label: string; color: string; desc: string }> = {
  domain: {
    label: "Domain-first discovery",
    color: "#f59e0b",
    desc: "Decompose the domain's meaning, find all spaces it could own, rank by pain × WTP × domain fit",
  },
  platform: {
    label: "Platform gap exploration",
    color: "#60a5fa",
    desc: "Find what's missing, broken, or over-priced in this platform's ecosystem",
  },
  space: {
    label: "Problem space discovery",
    color: "var(--accent)",
    desc: "Scan for pain signals, manual workarounds, and unmet needs in this space",
  },
  hunch: {
    label: "Hunch validation",
    color: "#a78bfa",
    desc: "Test if this pain is real, how big it is, and who's paying to solve it",
  },
};

const EXAMPLES: { label: string; type: DirectionType; text: string }[] = [
  { label: "Domain", type: "domain", text: "invoiceflow.io" },
  { label: "Domain", type: "domain", text: "trackify.app" },
  { label: "Platform", type: "platform", text: "X.com" },
  { label: "Platform", type: "platform", text: "Notion" },
  { label: "Space", type: "space", text: "content creators" },
  { label: "Hunch", type: "hunch", text: "YouTube demonetization is poorly understood by small creators" },
];

function autoName(direction: string, type: DirectionType): string {
  const d = direction.trim();
  if (!d) return "";
  if (type === "domain") return d.replace(/\.[^.]+$/, ""); // strip TLD
  if (type === "platform") return `${d} gaps`;
  if (type === "space") return d.charAt(0).toUpperCase() + d.slice(1);
  return d.split(/\s+/).slice(0, 5).join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────────

function NewProjectPage() {
  const router = useRouter();
  const loaderData = Route.useLoaderData();
  const { opportunityId } = Route.useSearch();
  const [step, setStep] = useState<1 | 2>(1);
  const [direction, setDirection] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const ALL_AVAILABLE = CHANNEL_GROUPS.flatMap((g) => g.channels).filter((t) => !CHANNEL_DISABLED.has(t));
  const [selected, setSelected] = useState<Set<ChannelType>>(new Set(ALL_AVAILABLE));
  const [busy, setBusy] = useState(false);

  // Pre-fill from opportunity loader data
  useEffect(() => {
    if (loaderData) {
      setDirection(loaderData.painSummary || loaderData.title);
    }
  }, [loaderData]);

  const type = detectType(direction);
  const typeInfo = TYPE_LABELS[type];
  const allSelected = ALL_AVAILABLE.every((t) => selected.has(t));

  function toggleChannel(t: ChannelType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  async function submit() {
    if (!direction.trim()) return;
    setBusy(true);
    try {
      const name = loaderData?.title
        ? loaderData.title.split(/\s+/).slice(0, 6).join(" ")
        : autoName(direction, type);
      const { id } = await createProject({
        data: {
          name,
          hypothesis: direction.trim(),
          directionType: type,
          channelTypes: [...selected],
        },
      });
      window.dispatchEvent(new Event("projects:changed"));
      router.navigate({ to: "/i/$id/channels", params: { id: String(id) } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 580, padding: "52px 28px" }}>

        {/* Opportunity source banner */}
        {opportunityId && loaderData && !bannerDismissed && (
          <div style={{
            marginBottom: 24,
            padding: "10px 14px",
            background: "rgba(96,165,250,0.08)",
            border: "1px solid rgba(96,165,250,0.25)",
            borderRadius: "var(--radius)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <span style={{ fontSize: "0.80rem", color: "var(--fg-subtle)", lineHeight: 1.5 }}>
              Pre-filled from opportunity:{" "}
              <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{loaderData.title}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBannerDismissed(true)}
              style={{ color: "var(--fg-subtle)", fontSize: "0.75rem", flexShrink: 0, height: "auto", padding: "0 4px" }}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.70rem", fontWeight: 700,
                background: step === s ? "var(--accent)" : step > s ? "rgba(96,165,250,0.2)" : "transparent",
                border: `1px solid ${step >= s ? "var(--accent)" : "var(--border-strong)"}`,
                color: step === s ? "#010407" : step > s ? "var(--accent)" : "var(--fg-subtle)",
              }}>{s}</span>
              {s === 1 && <div style={{ width: 32, height: 1, background: step > 1 ? "var(--accent)" : "var(--border-strong)" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Direction ── */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                What are you exploring?
              </h2>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
                A platform, a problem space, or a hunch. The system discovers opportunities from there - you don't need to know what you're building yet.
              </p>
            </div>

            {/* Direction input */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <textarea
                autoFocus
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && direction.trim()) { e.preventDefault(); setStep(2); } }}
                placeholder={"e.g. \"X.com\", \"content creators\", or \"YouTube demonetization is poorly understood by small creators\""}
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius)", color: "var(--fg)", fontSize: "0.92rem",
                  padding: "12px 14px", fontFamily: "inherit", outline: "none",
                  resize: "none", lineHeight: 1.6,
                  borderColor: direction.trim() ? typeInfo.color : "var(--border-strong)",
                  transition: "border-color 0.15s",
                }}
              />
            </div>

            {/* Auto-detected type badge */}
            {direction.trim() && (
              <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(0,0,0,0.2)", border: `1px solid ${typeInfo.color}22`, borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: typeInfo.color }}>
                  {typeInfo.label}
                </span>
                <span style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.45)", lineHeight: 1.5 }}>{typeInfo.desc}</span>
                <span style={{ fontSize: "0.70rem", color: "rgba(250,250,250,0.25)", marginTop: 2 }}>
                  Project name: <strong style={{ color: "rgba(250,250,250,0.5)" }}>
                    {loaderData?.title
                      ? loaderData.title.split(/\s+/).slice(0, 6).join(" ")
                      : autoName(direction, type)}
                  </strong>
                </span>
              </div>
            )}

            {/* Examples - only show when not pre-filled */}
            {!loaderData && (
              <div style={{ marginBottom: 28 }}>
                <p style={{ margin: "0 0 8px", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(250,250,250,0.25)" }}>
                  Examples
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EXAMPLES.map((ex) => (
                    <button key={ex.text} type="button" onClick={() => setDirection(ex.text)}
                      style={{
                        padding: "4px 10px", background: direction === ex.text ? `${TYPE_LABELS[ex.type].color}18` : "transparent",
                        border: `1px solid ${direction === ex.text ? TYPE_LABELS[ex.type].color : "var(--border-strong)"}`,
                        borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit",
                        fontSize: "0.76rem", color: direction === ex.text ? TYPE_LABELS[ex.type].color : "var(--fg-subtle)",
                      }}>
                      <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6, marginRight: 5 }}>{ex.label}</span>
                      {ex.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: loaderData ? 28 : 0 }}>
              <Button variant="primary" size="md" disabled={!direction.trim()} onClick={() => setStep(2)}>
                Next: Discovery channels →
              </Button>
              <Button variant="ghost" size="md" onClick={() => router.history.back()}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Channels ── */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Discovery channels</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(ALL_AVAILABLE))}
                  style={{ flexShrink: 0, fontSize: "0.76rem", color: "var(--fg-subtle)" }}>
                  {allSelected ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>
                Keywords for <span style={{ color: typeInfo.color, fontWeight: 600 }}>{typeInfo.label.toLowerCase()}</span> will be generated automatically across all signal types.
              </p>
            </div>

            <div style={{ marginBottom: 28 }}>
              {CHANNEL_GROUPS.map((group) => (
                <div key={group.label} style={{ marginBottom: 18 }}>
                  <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 8 }}>
                    {group.label}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {group.channels.filter((t) => !CHANNEL_DISABLED.has(t)).map((type) => {
                      const on = selected.has(type);
                      return (
                        <Button key={type} variant="ghost" size="sm" onClick={() => toggleChannel(type)}
                          style={{
                            border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
                            background: on ? "rgba(96,165,250,0.10)" : "transparent",
                            color: on ? "var(--accent)" : "var(--fg-subtle)",
                            fontSize: "0.80rem", fontWeight: on ? 600 : 400,
                            padding: "4px 12px", height: "auto",
                          }}>
                          <ChannelIcon type={type} size={12} />
                          {CHANNEL_LABELS[type]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selected.size > 0 && (
              <p style={{ margin: "0 0 20px", fontSize: "0.80rem", color: "var(--fg-subtle)" }}>
                {selected.size} channel{selected.size !== 1 ? "s" : ""} selected.
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="outline" size="md" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="primary" size="md" disabled={busy || selected.size === 0} onClick={submit}>
                {busy ? "Creating…" : "Start exploring →"}
              </Button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
