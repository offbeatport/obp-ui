import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { Input } from "@offbeatport/ui/ui/input";
import { Label } from "@offbeatport/ui/ui/label";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await authClient.resetPassword({ token, newPassword: password });
      if (res.error) {
        setError(res.error.message ?? "Reset failed. The link may have expired.");
      } else {
        navigate({ to: "/login" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-fg-muted mb-4">Invalid or expired reset link.</p>
          <Link to="/forgot-password" className="text-primary hover:underline text-sm">Request a new one</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="rgb(var(--primary-fg))" strokeWidth="1.5" fill="none" />
                <circle cx="7" cy="7" r="2" fill="rgb(var(--primary-fg))" />
              </svg>
            </span>
            <span className="font-semibold text-fg">PreventReturn</span>
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-fg mb-1">Set a new password</h1>
          <p className="text-sm text-fg-muted mb-6">Choose a strong password for your account.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-fg text-sm font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
