import type { CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const BASE_INPUT_CLASS = [
  "bg-[rgba(255,255,255,0.03)] border border-border-strong text-fg",
  "text-sm px-[11px] py-[7px] outline-none font-[inherit] w-full",
  "rounded-[var(--radius)]",
].join(" ");

const LABEL_CLASS = [
  "text-[0.70rem] font-semibold tracking-widest uppercase",
  "text-fg-subtle block mb-[5px]",
].join(" ");

const HINT_CLASS = "block text-xs text-fg-subtle mt-1 leading-[1.4]";

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="mb-[14px]" style={style}>
      {label && <label className={LABEL_CLASS}>{label}</label>}
      {children}
      {hint && <span className={HINT_CLASS}>{hint}</span>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  style?: CSSProperties;
}

export function Input({ className, style, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={[BASE_INPUT_CLASS, className ?? ""].join(" ")}
      style={style}
    />
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  style?: CSSProperties;
}

export function Textarea({ className, style, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={[BASE_INPUT_CLASS, "resize-y leading-[1.55]", className ?? ""].join(" ")}
      style={style}
    />
  );
}
