import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Globe, CheckCircle2, XCircle, Loader2, Save, HelpCircle } from "lucide-react";
import { Button } from "./Button";
import {
  generateDomainIdeas,
  checkDomainAvailability,
  saveDomainSearch,
  type DomainAvailabilityResult,
} from "~/lib/project-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  topic: string;
  open: boolean;
  onClose: () => void;
  onSelect: (domain: string) => void;
}

type DomainRow = {
  domain: string;
  checked: boolean;
  available: boolean | null;
  price: string | null;
  isPremium: boolean;
  unknown: boolean;
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(1,4,7,0.82)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "16px",
  },
  modal: {
    background: "var(--bg-elevated, #060d1c)",
    border: "1px solid rgba(100,130,180,0.14)",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px 14px",
    borderBottom: "1px solid rgba(100,130,180,0.1)",
    flexShrink: 0,
  },
  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--fg, #e2e8f0)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "rgba(148,163,184,0.7)",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  body: {
    padding: "16px 20px",
    overflowY: "auto" as const,
    flex: 1,
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  input: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(100,130,180,0.18)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--fg, #e2e8f0)",
    outline: "none",
    fontFamily: "inherit",
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
    padding: "9px 12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(100,130,180,0.1)",
  },
  domainName: {
    flex: 1,
    fontSize: "13px",
    color: "var(--fg, #e2e8f0)",
    fontFamily: "monospace",
  },
  badge: (color: string) => ({
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: color === "green"
      ? "rgba(34,197,94,0.12)"
      : color === "red"
        ? "rgba(239,68,68,0.12)"
        : "rgba(148,163,184,0.1)",
    color: color === "green"
      ? "#4ade80"
      : color === "red"
        ? "#f87171"
        : "#94a3b8",
    whiteSpace: "nowrap" as const,
  }),
  footer: {
    padding: "12px 20px",
    borderTop: "1px solid rgba(100,130,180,0.1)",
    display: "flex",
    gap: "8px",
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "32px 16px",
    color: "rgba(148,163,184,0.5)",
    fontSize: "13px",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DomainSuggestModal({ topic, open, onClose, onSelect }: Props) {
  const [inputTopic, setInputTopic] = useState(topic);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync topic prop on open
  useEffect(() => {
    if (open) {
      setInputTopic(topic);
      setDomains([]);
      setSaved(false);
      setError(null);
    }
  }, [open, topic]);

  if (!open) return null;

  async function handleGenerate() {
    if (!inputTopic.trim()) return;
    setGenerating(true);
    setError(null);
    setDomains([]);
    setSaved(false);
    try {
      const ideas = await generateDomainIdeas({ data: { topic: inputTopic.trim() } });
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
      const domainNames = domains.map((d) => d.domain);
      const results: DomainAvailabilityResult[] = await checkDomainAvailability({
        data: { domains: domainNames },
      });
      const resultMap = new Map(results.map((r) => [r.domain, r]));
      setDomains((prev) =>
        prev.map((d) => {
          const r = resultMap.get(d.domain);
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
      const resultsJson = domains
        .filter((d) => d.checked)
        .map((d) => ({
          domain: d.domain,
          available: d.available ?? false,
          price: d.price,
          isPremium: d.isPremium,
        }));
      await saveDomainSearch({
        data: { query: inputTopic.trim(), resultsJson },
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectDomain(domain: string) {
    onSelect(domain);
    onClose();
  }

  const anyChecked = domains.some((d) => d.checked);
  const availableCount = domains.filter((d) => d.available === true).length;

  const content = (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            <Globe size={15} style={{ color: "var(--accent, #60a5fa)" }} />
            Domain Suggestions
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} type="button" aria-label="Close" style={{ padding: "4px" }}>
            <X size={16} />
          </Button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Input row */}
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={inputTopic}
              onChange={(e) => setInputTopic(e.target.value)}
              placeholder="Product name or topic..."
              onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
            />
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating || !inputTopic.trim()}
              style={{ whiteSpace: "nowrap", gap: "6px" }}
            >
              {generating ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Sparkles size={13} />
              )}
              {generating ? "Generating..." : "Generate Ideas"}
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: "12px",
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#f87171",
            }}>
              {error}
            </div>
          )}

          {/* Domain list */}
          {domains.length > 0 ? (
            <>
              {/* Check availability bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "rgba(148,163,184,0.6)" }}>
                  {domains.length} suggestions
                  {anyChecked && availableCount > 0 && ` · ${availableCount} available`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCheckAvailability}
                  disabled={checking || domains.length === 0}
                  style={{ gap: "6px" }}
                >
                  {checking ? (
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Globe size={12} />
                  )}
                  {checking ? "Checking..." : "Check Availability"}
                </Button>
              </div>

              <div style={styles.domainList}>
                {domains.map((d) => (
                  <div key={d.domain} style={styles.domainRow}>
                    <span style={styles.domainName}>{d.domain}</span>

                    {/* Status badge */}
                    {d.checked ? (
                      d.unknown ? (
                        <span style={styles.badge("grey")}>
                          <HelpCircle size={10} style={{ display: "inline", marginRight: 3 }} />
                          Unknown
                        </span>
                      ) : d.available ? (
                        <span style={styles.badge("green")}>
                          Available{d.price ? ` · ${d.price}` : ""}
                        </span>
                      ) : (
                        <span style={styles.badge("red")}>Taken</span>
                      )
                    ) : checking ? (
                      <Loader2 size={12} style={{ color: "rgba(148,163,184,0.4)", animation: "spin 1s linear infinite" }} />
                    ) : null}

                    {/* Select button - only when available */}
                    {d.checked && d.available && !d.unknown && (
                      <Button
                        size="sm"
                        onClick={() => handleSelectDomain(d.domain)}
                        style={{ fontSize: "11px", padding: "3px 10px", flexShrink: 0 }}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : !generating ? (
            <div style={styles.emptyState}>
              Enter a topic and click "Generate Ideas" to get domain suggestions.
            </div>
          ) : (
            <div style={styles.emptyState}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} />
              Generating domain ideas...
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          {anyChecked && !saved && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={saving}
              style={{ gap: "6px" }}
            >
              {saving ? (
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Save size={12} />
              )}
              {saving ? "Saving..." : "Save Results"}
            </Button>
          )}
          {saved && (
            <span style={{ fontSize: "12px", color: "#4ade80", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={13} />
              Saved
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}
