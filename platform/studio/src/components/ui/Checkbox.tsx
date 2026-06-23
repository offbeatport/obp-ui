import type { CSSProperties } from "react";

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  style?: CSSProperties;
}

export function Checkbox({ checked, indeterminate, onChange, onClick, style }: CheckboxProps) {
  const cls = ["cb", checked ? "cb--checked" : indeterminate ? "cb--indeterminate" : ""].filter(Boolean).join(" ");
  return (
    <span
      className={cls}
      onClick={(e) => { onClick?.(e); if (!onClick) onChange?.(); }}
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      style={style}
    />
  );
}
