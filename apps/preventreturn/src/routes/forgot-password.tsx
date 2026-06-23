import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { Input } from "@offbeatport/ui/ui/input";
import { Label } from "@offbeatport/ui/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong");
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
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
          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto">
                <span className="text-success text-lg">✓</span>
              </div>
              <h1 className="text-lg font-semibold text-fg">Check your email</h1>
              <p className="text-sm text-fg-muted">
                We sent a password reset link to <span className="text-fg font-medium">{email}</span>.
                Check your inbox and click the link to reset your password.
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline block mt-4">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-fg mb-1">Reset your password</h1>
              <p className="text-sm text-fg-muted mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-primary text-primary-fg text-sm font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="text-center text-sm text-fg-muted mt-4">
                <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
