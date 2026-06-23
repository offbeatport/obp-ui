import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signIn, signUp, useSession } from "../lib/auth-client.js";
import { Github } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already logged in - redirect
  if (session?.user) {
    navigate({ to: "/dashboard" });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const result = await signIn.email({ email, password, callbackURL: "/dashboard" });
        if (result.error) setError(result.error.message ?? "Login failed");
      } else {
        const result = await signUp.email({ email, password, name, callbackURL: "/dashboard" });
        if (result.error) setError(result.error.message ?? "Sign up failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHub() {
    setError(null);
    setLoading(true);
    try {
      await signIn.social({ provider: "github", callbackURL: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth failed");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border-strong)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--fg)",
    fontSize: "0.9rem",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 52px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
              marginBottom: 8,
            }}
          >
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--fg-muted)" }}>
            {mode === "login" ? "Sign in to your account" : "Start for free, no card required"}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* GitHub OAuth */}
          <button
            onClick={handleGitHub}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 0",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--fg-muted)",
              fontWeight: 500,
              fontSize: "0.9rem",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
            }}
          >
            <Github size={16} />
            Continue with GitHub
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--fg-dim)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && (
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,255,136,0.4)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
                }}
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inputStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,255,136,0.4)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
              }}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={inputStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0,255,136,0.4)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
              }}
            />

            {error && (
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--danger)",
                  margin: 0,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.08)",
                  borderRadius: "var(--radius)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: "var(--radius)",
                border: "none",
                background: "var(--accent)",
                color: "#000",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontFamily: "inherit",
                marginTop: 4,
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        {/* Toggle mode */}
        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--fg-muted)" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "inherit",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--fg-dim)" }}>
          By continuing, you agree to our{" "}
          <Link to="/" style={{ color: "var(--fg-subtle)" }}>Terms</Link>
          {" and "}
          <Link to="/" style={{ color: "var(--fg-subtle)" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
