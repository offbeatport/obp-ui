import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 440 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(1,4,7,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width, maxWidth: "calc(100vw - 40px)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "calc(var(--radius) * 2)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {title && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px 12px",
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--fg)" }}>
              {title}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="modal-close"
              style={{ padding: "4px" }}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        <div style={{ padding: "16px 18px" }}>
          {children}
        </div>
        {footer && (
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 8,
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
