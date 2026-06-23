import { useState, type ReactNode } from "react";
import { SiGoogle } from "react-icons/si";

interface LoginBlockProps {
  logo?: ReactNode;
  title: string;
  subtitle?: string;
  bottomNote?: string;
  onGoogleSignIn: () => Promise<unknown>;
}

export function LoginBlock({ logo, title, subtitle, bottomNote, onGoogleSignIn }: LoginBlockProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await onGoogleSignIn();
    } catch {
      setError("Sign-in failed. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          {logo && <div className="flex justify-center mb-6">{logo}</div>}
          <h1 className="text-xl font-display font-light tracking-tight text-fg mb-2">{title}</h1>
          {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
        </div>

        {error && <p className="text-xs text-danger text-center mb-4">{error}</p>}

        <button type="button" onClick={handleGoogle} disabled={loading}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 text-sm font-medium border border-border text-fg bg-bg-elevated hover:bg-hover transition-colors disabled:opacity-40">
          <SiGoogle size={16} />
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>

        {bottomNote && (
          <p className="text-center text-xs text-fg-subtle mt-6">{bottomNote}</p>
        )}
      </div>
    </div>
  );
}
