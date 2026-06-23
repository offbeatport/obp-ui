import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Globe,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle2,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import {
  generateDomainIdeas,
  checkDomainAvailability,
  saveDomainSearch,
  getDomainSearches,
  type DomainAvailabilityResult,
} from "~/lib/project-fns";
import type { DomainSearch, DomainResult } from "~/db/schema";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/domain-search")({
  loader: async () => getDomainSearches(),
  staleTime: 0,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DomainSearchPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type DomainRow = {
  domain: string;
  checked: boolean;
  available: boolean | null;
  price: string | null;
  isPremium: boolean;
  unknown: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_BG = "var(--bg, #010407)";
const ELEVATED = "var(--bg-elevated, #060d1c)";
const ACCENT = "var(--accent, #60a5fa)";
const BORDER = "rgba(100,130,180,0.14)";
const FG = "var(--fg, #e2e8f0)";
const MUTED = "rgba(148,163,184,0.55)";

const s = {
  page: {
    minHeight: "100vh",
    background: PAGE_BG,
    padding: "32px 28px",
    fontFamily: "monospace",
    color: FG,
    maxWidth: "740px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 700,
    color: FG,
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  subheading: {
    fontSize: "13px",
    color: MUTED,
    marginBottom: "28px",
  },
  section: {
    marginBottom: "36px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: MUTED,
    marginBottom: "14px",
  },
  card: {
    background: ELEVATED,
    border: `1px solid ${BORDER}`,
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  input: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid rgba(100,130,180,0.2)`,
    borderRadius: "8px",
    padding: "9px 13px",
    fontSize: "13px",
    color: FG,
    outline: "none",
    fontFamily: "monospace",
  },
  domainList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  domainRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 13px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.025)",
    border: `1px solid rgba(100,130,180,0.1)`,
  },
  domainName: {
    flex: 1,
    fontSize: "13px",
    color: FG,
    fontFamily: "monospace",
  },
  badge: (color: "green" | "red" | "grey") => ({
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background:
      color === "green"
        ? "rgba(34,197,94,0.12)"
        : color === "red"
        ? "rgba(239,68,68,0.12)"
        : "rgba(148,163,184,0.1)",
    color:
      color === "green"
        ? "#4ade80"
        : color === "red"
        ? "#f87171"
        : "#94a3b8",
    whiteSpace: "nowrap" as const,
  }),
  savedCard: {
    background: ELEVATED,
    border: `1px solid ${BORDER}`,
    borderRadius: "10px",
    marginBottom: "8px",
    overflow: "hidden",
  },
  savedCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "13px 16px",
    cursor: "pointer",
  },
  savedCardQuery: {
    flex: 1,
    fontSize: "13px",
    color: FG,
    fontWeight: 500,
  },
  savedCardMeta: {
    fontSize: "11px",
    color: MUTED,
  },
  savedCardBody: {
    padding: "0 16px 14px",
    borderTop: `1px solid rgba(100,130,180,0.08)`,
  },
  errorBox: {
    marginBottom: "12px",
    padding: "8px 12px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#f87171",
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  metaText: {
    fontSize: "12px",
    color: MUTED,
  },
};

// ── Search Panel (shared between modal and page) ───────────────────────────────

function SearchPanel({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    setDomains([]);
    setSaved(false);
    try {
      const ideas = await generateDomainIdeas({ data: { topic: topic.trim() } });
      setDomains(
        ideas.map((domain) => ({
          domain,
          checked: false,
          available: null,
          price: null,
          isPremium: false,
          unknown: false,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ideas");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCheckAvailability() {
    if (domains.length === 0) return;
    setChecking(true);
    setError(null);
    try {
      const results: DomainAvailabilityResult[] = await checkDomainAvailability({
        data: { domains: domains.map((d) => d.domain) },
      });
      const map = new Map(results.map((r) => [r.domain, r]));
      setDomains((prev) =>
        prev.map((d) => {
          const r = map.get(d.domain);
          if (!r) return d;
          return {
            ...d,
            checked: true,
            available: r.available,
            price: r.price,
            isPremium: r.isPremium,
            unknown: r.unknown ?? false,
          };
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check availability");
    } finally {
      setChecking(false);
    }
  }

  async function handleSave() {
    if (domains.length === 0) return;
    setSaving(true);
    try {
      const resultsJson: DomainResult[] = domains
        .filter((d) => d.checked)
        .map((d) => ({
          domain: d.domain,
          available: d.available ?? false,
          price: d.price,
          isPremium: d.isPremium,
        }));
      await saveDomainSearch({ data: { query: topic.trim(), resultsJson } });
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const anyChecked = domains.some((d) => d.checked);
  const availableCount = domains.filter((d) => d.available === true).length;

  return (
    <div style={s.card}>
      <div style={s.inputRow}>
        <input
          style={s.input}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Product name or topic..."
          onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
        />
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || !topic.trim()}
          style={{ whiteSpace: "nowrap", gap: "6px" }}
        >
          {generating ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {generating ? "Generating..." : "Generate Ideas"}
        </Button>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {domains.length > 0 ? (
        <>
          <div style={s.actionRow}>
            <span style={s.metaText}>
              {domains.length} suggestions
              {anyChecked && availableCount > 0 && ` · ${availableCount} available`}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {anyChecked && !saved && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ gap: "6px" }}
                >
                  {saving ? <Loader2 size={12} className="spin" /> : <Save size={12} />}
                  {saving ? "Saving..." : "Save Results"}
                </Button>
              )}
              {saved && (
                <span style={{ fontSize: "12px", color: "#4ade80", display: "flex", alignItems: "center", gap: "5px" }}>
                  <CheckCircle2 size={13} />
                  Saved
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCheckAvailability}
                disabled={checking || domains.length === 0}
                style={{ gap: "6px" }}
              >
                {checking ? <Loader2 size={12} className="spin" /> : <Globe size={12} />}
                {checking ? "Checking..." : "Check Availability"}
              </Button>
            </div>
          </div>

          <div style={s.domainList}>
            {domains.map((d) => (
              <div key={d.domain} style={s.domainRow}>
                <span style={s.domainName}>{d.domain}</span>
                {d.checked ? (
                  d.unknown ? (
                    <span style={s.badge("grey")}>
                      Unknown
                    </span>
                  ) : d.available ? (
                    <span style={s.badge("green")}>
                      Available{d.price ? ` · ${d.price}` : ""}
                    </span>
                  ) : (
                    <span style={s.badge("red")}>Taken</span>
                  )
                ) : checking ? (
                  <Loader2 size={12} className="spin" style={{ color: "rgba(148,163,184,0.4)" }} />
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : !generating ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: MUTED, fontSize: "13px" }}>
          Enter a topic and click "Generate Ideas" to get domain name suggestions.
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0", color: MUTED, fontSize: "13px" }}>
          <Loader2 size={18} className="spin" style={{ margin: "0 auto 8px", display: "block" }} />
          Generating domain ideas...
        </div>
      )}
    </div>
  );
}

// ── Saved Search Card ─────────────────────────────────────────────────────────

function SavedSearchCard({ search }: { search: DomainSearch }) {
  const [expanded, setExpanded] = useState(false);
  const results = search.resultsJson as DomainResult[];
  const available = results.filter((r) => r.available).length;
  const total = results.length;

  return (
    <div style={s.savedCard}>
      <div
        style={s.savedCardHeader}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <Globe size={14} style={{ color: ACCENT, flexShrink: 0 }} />
        <span style={s.savedCardQuery}>{search.query}</span>
        <span style={s.savedCardMeta}>
          {total > 0 ? `${available}/${total} available · ` : ""}
          {relTime(search.createdAt)}
        </span>
        {expanded ? (
          <ChevronUp size={14} style={{ color: MUTED, flexShrink: 0 }} />
        ) : (
          <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0 }} />
        )}
      </div>

      {expanded && results.length > 0 && (
        <div style={s.savedCardBody}>
          <div style={{ ...s.domainList, paddingTop: "10px" }}>
            {results.map((r) => (
              <div key={r.domain} style={s.domainRow}>
                <span style={s.domainName}>{r.domain}</span>
                {r.available ? (
                  <span style={s.badge("green")}>
                    Available{r.price ? ` · ${r.price}` : ""}
                  </span>
                ) : (
                  <span style={s.badge("red")}>Taken</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && results.length === 0 && (
        <div style={{ ...s.savedCardBody, paddingTop: "10px", color: MUTED, fontSize: "12px" }}>
          No availability results saved for this search.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function DomainSearchPage() {
  const initialSearches = Route.useLoaderData();
  const [searches, setSearches] = useState<DomainSearch[]>(initialSearches ?? []);

  useEffect(() => {
    setSearches(initialSearches ?? []);
  }, [initialSearches]);

  async function refreshSearches() {
    try {
      const fresh = await getDomainSearches();
      setSearches(fresh);
    } catch { /* non-critical */ }
  }

  return (
    <div style={s.page}>
      <style>{`
        .spin { animation: domain-spin 1s linear infinite; }
        @keyframes domain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={s.heading}>
        <Globe size={20} style={{ color: ACCENT }} />
        Domain Search
      </div>
      <div style={s.subheading}>
        Generate brandable .com domain ideas with AI and check real-time availability.
      </div>

      {/* Search section */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Search</div>
        <SearchPanel onSaved={refreshSearches} />
      </div>

      {/* Saved searches section */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          Saved Searches
          {searches.length > 0 && (
            <span style={{ marginLeft: "8px", fontWeight: 400, textTransform: "none", letterSpacing: 0, color: MUTED }}>
              ({searches.length})
            </span>
          )}
        </div>

        {searches.length === 0 ? (
          <div style={{
            background: ELEVATED,
            border: `1px solid ${BORDER}`,
            borderRadius: "10px",
            padding: "28px 20px",
            textAlign: "center",
            color: MUTED,
            fontSize: "13px",
          }}>
            No saved searches yet. Generate and save domain ideas above.
          </div>
        ) : (
          searches.map((search) => (
            <SavedSearchCard key={search.id} search={search} />
          ))
        )}
      </div>
    </div>
  );
}
