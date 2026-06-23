import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string | number> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  align?: "left" | "right";
}

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  align = "left",
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    if (align === "right") {
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    } else {
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }

  const minW = btnRef.current?.offsetWidth ?? 80;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        data-open={open ? "true" : undefined}
        className="dropdown-trigger"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 8px 3px 10px",
          background: open ? "rgba(165,182,214,0.08)" : "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          color: "var(--fg-muted)",
          fontSize: "0.76rem", fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
          transition: "background 0.1s, border-color 0.1s",
          whiteSpace: "nowrap",
        }}
      >
        {label && (
          <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--fg-subtle)", marginRight: 2 }}>
            {label}
          </span>
        )}
        <span style={{ color: "var(--fg)" }}>{selected?.label ?? String(value)}</span>
        <ChevronDown size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.top,
            ...(pos.left !== undefined ? { left: pos.left } : { right: pos.right }),
            minWidth: minW,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
            zIndex: 9999,
            overflow: "hidden",
            padding: "3px 0",
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                data-active={active ? "true" : undefined}
                className="dropdown-item"
                style={{
                  display: "block", width: "100%",
                  padding: "6px 12px",
                  background: active ? "rgba(96,165,250,0.1)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: "0.76rem",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--accent)" : "var(--fg-muted)",
                  cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "background 0.08s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
