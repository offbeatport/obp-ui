import { useState } from "react";
import { togglePass } from "~/lib/server-fns";
import { Button } from "~/components/ui/Button";

interface Props {
  id: number;
  pass: boolean;
  onUpdate?: (pass: boolean) => void;
}

export function PassButton({ id, pass: initialPass, onUpdate }: Props) {
  const [pass, setPass] = useState(initialPass);
  const [saving, setSaving] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !pass;
    setPass(next);
    setSaving(true);
    try {
      await togglePass({ data: { id, pass: next } });
      onUpdate?.(next);
    } catch {
      setPass(pass);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={saving}
      style={{
        background: pass ? "rgba(239,68,68,0.08)" : "transparent",
        border: `1px solid ${pass ? "rgba(239,68,68,0.35)" : "var(--border)"}`,
        color: pass ? "rgba(239,68,68,0.75)" : "rgba(250,250,250,0.3)",
        fontSize: "0.74rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 8px",
        height: "auto",
        transition: "all 0.15s",
      }}
    >
      {pass ? "passed" : "pass"}
    </Button>
  );
}
