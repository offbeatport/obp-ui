import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { Input } from "@offbeatport/ui/ui/input";
import { Label } from "@offbeatport/ui/ui/label";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const session = (context as any)?.session;
    if (session?.user) throw redirect({ to: "/app" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "sign-in") {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) { setError(res.error.message ?? "Sign in failed"); return; }
      } else {
        const res = await authClient.signUp.email({ email, password, name: email.split("@")[0] });
        if (res.error) { setError(res.error.message ?? "Sign up failed"); return; }
      }
      navigate({ to: "/app" });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="rgb(var(--primary-fg))" strokeWidth="1.5" fill="none" />
              <circle cx="7" cy="7" r="2" fill="rgb(var(--primary-fg))" />
            </svg>
          </span>
          <span className="font-semibold text-fg">PreventReturn</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h1 className="text-lg font-semibold text-fg mb-1">
            {mode === "sign-in" ? "Sign in to your account" : "Create your account"}
          </h1>
          <p className="text-sm text-fg-muted mb-6">
            {mode === "sign-in" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); }}
              className="text-primary hover:underline"
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/app" })}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-border rounded-lg text-sm font-medium text-fg hover:bg-hover transition mb-4"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M15.68 8.18c0-.57-.05-1.12-.14-1.64H8v3.1h4.3a3.67 3.67 0 01-1.59 2.41v2h2.57c1.5-1.38 2.4-3.42 2.4-5.87z" fill="#4285F4"/>
              <path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.57-2a4.8 4.8 0 01-7.16-2.52H.89v2.07A8 8 0 008 16z" fill="#34A853"/>
              <path d="M3.56 9.54A4.83 4.83 0 013.31 8c0-.54.09-1.06.25-1.54V4.39H.89A8 8 0 000 8c0 1.29.31 2.51.89 3.61l2.67-2.07z" fill="#FBBC05"/>
              <path d="M8 3.18c1.22 0 2.31.42 3.17 1.24l2.37-2.37A8 8 0 00.89 4.39L3.56 6.46A4.77 4.77 0 018 3.18z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs text-fg-muted">or continue with email</span>
            </div>
          </div>

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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
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
            {mode === "sign-in" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-fg-muted hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-fg text-sm font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition"
            >
              {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-fg-muted mt-6">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-fg">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-fg">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
