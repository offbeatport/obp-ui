import { useState } from "react";
import type { OpportunityStatus } from "~/lib/types";
import { updateStatus } from "~/lib/server-fns";
import { Button } from "~/components/ui/Button";

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; color: string }> = {
  new:        { label: "New",        color: "var(--status-new)" },
  interesting:{ label: "Interesting",color: "var(--status-interesting)" },
  validated:  { label: "Validated",  color: "#a78bfa" },
  building:   { label: "Building",   color: "var(--status-building)" },
  built:      { label: "Built",      color: "var(--accent)" },
  launched:   { label: "Launched",   color: "#22d3ee" },
  measuring:  { label: "Measuring",  color: "#f59e0b" },
  killed:     { label: "Killed",     color: "#6b7280" },
  parked:     { label: "Parked",     color: "#6b7280" },
  pass:       { label: "Pass",       color: "var(--status-pass)" },
  discovered: { label: "Discovered", color: "rgba(250,250,250,0.45)" },
};

interface Props {
  id: number;
  current: OpportunityStatus;
  onUpdate?: (status: OpportunityStatus) => void;
}

export function StatusToggle({ id, current, onUpdate }: Props) {
  const [status, setStatus] = useState<OpportunityStatus>(current);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const config = STATUS_CONFIG[status];

  async function handleSelect(next: OpportunityStatus) {
    if (next === status) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    setStatus(next);
    try {
      await updateStatus({ data: { id, status: next } });
      onUpdate?.(next);
    } catch {
      setStatus(status);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        disabled={saving}
        style={{
          border: `1px solid ${config.color}`,
          color: config.color,
          fontSize: "0.82rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "2px 10px",
          height: "auto",
        }}
      >
        {config.label}
      </Button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: "#111",
            border: "1px solid var(--border)",
            zIndex: 50,
            minWidth: "120px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(Object.entries(STATUS_CONFIG) as [OpportunityStatus, { label: string; color: string }][]).map(([key, cfg]) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => handleSelect(key)}
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "flex-start",
                background: key === status ? "var(--subtle)" : "transparent",
                color: cfg.color,
                fontSize: "0.86rem",
                fontWeight: 500,
                padding: "8px 12px",
                height: "auto",
                borderRadius: 0,
              }}
            >
              {cfg.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
