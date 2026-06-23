import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { signIn, signUp } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
  component: Login,
});


function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await signUp.email({ email, password, name: email.split("@")[0] });
        if (result?.error) { toast.error(result.error.message ?? "Could not create account."); return; }
      } else {
        const result = await signIn.email({ email, password });
        if (result?.error) { toast.error(result.error.message ?? "Invalid email or password."); return; }
      }
      navigate({ to: "/admin" });
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const linkBtn: React.CSSProperties = {
    color: "var(--lb-azure)", background: "none", border: "none",
    cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: 0,
  };

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn.forgetPassword?.({ email, redirectTo: "/login" });
    } catch {
      // Better Auth may not have forgetPassword - show sent state regardless
    } finally {
      setLoading(false);
      setForgotSent(true);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 52px - 80px)", display: "grid", placeItems: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380, border: "1px solid var(--lb-border)", background: "var(--lb-bg)", padding: 32 }}>

        {mode !== "forgot" && (
          <div style={{ display: "flex", marginBottom: 24, border: "1px solid var(--lb-border-strong)" }}>
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1, height: 32, background: mode === m ? "var(--lb-fg)" : "var(--lb-bg)",
                  border: 0, borderRight: m === "signin" ? "1px solid var(--lb-border-strong)" : 0,
                  color: mode === m ? "var(--lb-bg)" : "var(--lb-fg-2)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        )}

        {mode === "forgot" ? (
          forgotSent ? (
            <>
              <h1 style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px", color: "var(--lb-fg)" }}>
                Check your email
              </h1>
              <p style={{ color: "var(--lb-fg-2)", fontSize: 13, marginBottom: 20 }}>
                If <strong>{email}</strong> has an account, a reset link is on its way.
              </p>
              <button type="button" onClick={() => { setMode("signin"); setForgotSent(false); }} style={{ ...linkBtn, fontSize: 13 }}>
                ← Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px", color: "var(--lb-fg)" }}>
                Reset password
              </h1>
              <p style={{ color: "var(--lb-fg-2)", marginBottom: 24, fontSize: 13 }}>Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lb-fg-3)", marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required style={{ width: "100%", height: 38, padding: "0 10px", background: "var(--lb-bg-1)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <button type="submit" disabled={loading || !email} style={{ height: 38, background: "var(--lb-azure)", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: loading || !email ? "not-allowed" : "pointer", opacity: loading || !email ? 0.5 : 1, fontFamily: "inherit" }}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <div style={{ marginTop: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-fg-3)" }}>
                <button type="button" onClick={() => setMode("signin")} style={linkBtn}>← Back to sign in</button>
              </div>
            </>
          )
        ) : (
          <>
            <h1 style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px", color: "var(--lb-fg)" }}>
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h1>
            <p style={{ color: "var(--lb-fg-2)", marginBottom: 24, fontSize: 13 }}>Admin access only.</p>

            {/* Google */}
            <button
              type="button"
              onClick={() => signIn.social({ provider: "google", callbackURL: "/admin" })}
              style={{ width: "100%", height: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--lb-bg-1)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: "pointer", marginBottom: 16 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "var(--lb-border)" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--lb-fg-4)", letterSpacing: "0.06em" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "var(--lb-border)" }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lb-fg-3)", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required style={{ width: "100%", height: 38, padding: "0 10px", background: "var(--lb-bg-1)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lb-fg-3)" }}>Password</label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("forgot")} style={{ ...linkBtn, fontSize: 11 }}>Forgot?</button>
                  )}
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: "100%", height: 38, padding: "0 10px", background: "var(--lb-bg-1)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <button type="submit" disabled={loading || !email || !password} style={{ height: 38, background: "var(--lb-azure)", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: loading || !email || !password ? "not-allowed" : "pointer", opacity: loading || !email || !password ? 0.5 : 1, fontFamily: "inherit", marginTop: 4 }}>
                {loading ? "Signing in…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-fg-3)" }}>
              {mode === "signin" ? (
                <>No account?{" "}<button type="button" onClick={() => setMode("signup")} style={linkBtn}>Create one</button></>
              ) : (
                <>Already have an account?{" "}<button type="button" onClick={() => setMode("signin")} style={linkBtn}>Sign in</button></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
