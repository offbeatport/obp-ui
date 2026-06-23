import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getFounderProfile, upsertFounderProfile, getTechStacks, createTechStack, updateTechStack, deleteTechStack } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import { Input, Textarea, Field } from "~/components/ui/Input";
import { Badge } from "~/components/ui/Badge";
import { useConfirm } from "~/components/ui/Confirm";
import type { TechStack } from "~/db/schema";

export const Route = createFileRoute("/settings")({
  loader: async () => {
    const [profile, stacks] = await Promise.all([getFounderProfile(), getTechStacks()]);
    return { profile, stacks };
  },
  staleTime: 60_000,
  component: SettingsLayout,
});

// ── Shared styles ─────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 6,
};

const HINT: React.CSSProperties = {
  margin: "5px 0 0", fontSize: "0.70rem", color: "var(--fg-subtle)", lineHeight: 1.55,
};

const CARD: React.CSSProperties = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 16,
};

// ── Nav items ─────────────────────────────────────────────────────────────────

type NavGroup = { group: string; items: { id: string; label: string; desc: string }[] };

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Account",
    items: [
      { id: "profile", label: "Profile", desc: "Identity & background" },
    ],
  },
  {
    group: "Build Context",
    items: [
      { id: "stacks", label: "Tech Stacks", desc: "Reusable stack presets" },
      { id: "design-systems", label: "Design Systems", desc: "HTML component reference files" },
      { id: "designs", label: "Design Guidelines", desc: "Aesthetic intent for prototypes" },
      { id: "distribution-playbooks", label: "Distribution Playbooks", desc: "Reusable distribution strategies" },
    ],
  },
  {
    group: "Integrations",
    items: [
      { id: "source-control", label: "Source Control", desc: "Git hosting & repos" },
      { id: "integrations", label: "API Keys", desc: "OpenRouter, VPS IP, Stripe" },
      { id: "ai-models", label: "AI Models", desc: "Per-task model & tool routing" },
    ],
  },
];

// ── TagInput ──────────────────────────────────────────────────────────────────

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }
  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map(tag => (
            <Badge key={tag} variant="accent" style={{ gap: 5, paddingRight: 4 }}>
              {tag}
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter(t => t !== tag))}
                style={{ color: "var(--fg-subtle)", padding: "0 2px", lineHeight: 1, fontSize: "0.80rem", height: "auto" }}>×</Button>
            </Badge>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Type and press Enter"} style={{ flex: 1 }} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

export function ProfileSection({ initial }: { initial: any }) {
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [cvRaw, setCvRaw] = useState(initial?.cvRaw ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [expertise, setExpertise] = useState<string[]>(initial?.domainExpertise ?? []);
  const [advantages, setAdvantages] = useState<string[]>(initial?.unfairAdvantages ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertFounderProfile({ data: { handle: handle.trim() || undefined, companyName: companyName.trim() || undefined, domain: domain.trim() || undefined, cvRaw: cvRaw.trim() || undefined, skills, domainExpertise: expertise, unfairAdvantages: advantages } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save}>
      <SectionHeader title="Profile" desc="Your identity and background. Used to personalise opportunity scoring and brief generation." />

      <div style={CARD}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>Identity</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LABEL}>Handle</label>
            <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@you" style={{ width: "100%" }} />
            <p style={HINT}>e.g. @vladpalos</p>
          </div>
          <div>
            <label style={LABEL}>Company Name</label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="BurningDemand" style={{ width: "100%" }} />
          </div>
        </div>
        <div>
          <label style={LABEL}>Primary Domain</label>
          <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="burningdemand.com" style={{ width: "100%" }} />
          <p style={HINT}>Your main product or company URL</p>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>Unfair Advantages</div>
        <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>
          What you know, have access to, or can do that most builders can't. These sharpen opportunity scoring.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={LABEL}>Technical Skills</label>
            <TagInput value={skills} onChange={setSkills} placeholder="e.g. TypeScript, React, SQLite" />
            <p style={HINT}>Languages, frameworks, infra you can build fast</p>
          </div>
          <div>
            <label style={LABEL}>Domain Expertise</label>
            <TagInput value={expertise} onChange={setExpertise} placeholder="e.g. SaaS, fintech, developer tools" />
            <p style={HINT}>Industries or problems you know deeply</p>
          </div>
          <div>
            <label style={LABEL}>Advantages</label>
            <TagInput value={advantages} onChange={setAdvantages} placeholder="e.g. 5k Twitter followers in dev tools" />
            <p style={HINT}>Distribution, audience, access, or past experience</p>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>Background</div>
        <label style={LABEL}>Bio / CV</label>
        <Textarea value={cvRaw} onChange={e => setCvRaw(e.target.value)}
          placeholder="20yr fullstack engineer. Head of Data Platform at T Rowe Price…"
          style={{ minHeight: 110 }} />
        <p style={HINT}>Paste a short bio, LinkedIn summary, or resume. Used to match opportunities to your background.</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button type="submit" variant="primary" size="md" disabled={busy}>{busy ? "Saving…" : "Save Profile"}</Button>
        {saved && <span style={{ fontSize: "0.82rem", color: "var(--accent)" }}>✓ Saved</span>}
      </div>
    </form>
  );
}

// ── Git section ───────────────────────────────────────────────────────────────

export function GitSection({ initial }: { initial: any }) {
  const [gitOrg, setGitOrg] = useState(initial?.gitOrg ?? "");
  const [gitToken, setGitToken] = useState(initial?.gitToken ?? "");
  const [localReposDir, setLocalReposDir] = useState(initial?.localReposDir ?? "");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save() {
    setSaving(true);
    try {
      await upsertFounderProfile({ data: { gitOrg: gitOrg.trim() || undefined, gitToken: gitToken.trim() || undefined, localReposDir: localReposDir.trim() || undefined } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function testConnection() {
    const token = gitToken.trim();
    const org = gitOrg.trim();
    if (!token) { setTestResult({ ok: false, message: "Enter a token first." }); return; }
    if (!org) { setTestResult({ ok: false, message: "Enter a GitHub org / user first." }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };

      // Step 1: verify the token is valid
      const userRes = await fetch("https://api.github.com/user", { headers });
      const userData = await userRes.json() as any;
      if (!userRes.ok) {
        setTestResult({ ok: false, message: `✗ Token invalid: ${userData.message ?? `HTTP ${userRes.status}`}` });
        return;
      }
      const login = userData.login as string;

      // Step 2: check if the org field refers to the user's own account or an org
      const isPersonal = login.toLowerCase() === org.toLowerCase();

      if (isPersonal) {
        // Try creating a repo would require repo scope - check scopes header
        const scopes = userRes.headers.get("x-oauth-scopes") ?? "";
        const hasRepo = scopes.includes("repo");
        if (scopes && !hasRepo) {
          setTestResult({ ok: false, message: `✗ Token authenticated as @${login} but missing repo scope. Add "repo" scope to create repositories.` });
        } else {
          setTestResult({ ok: true, message: `✓ Authenticated as @${login} - repos will be created under your personal account` });
        }
      } else {
        // Check if the token can access the org
        const orgRes = await fetch(`https://api.github.com/orgs/${org}`, { headers });
        if (orgRes.status === 404) {
          setTestResult({ ok: false, message: `✗ Org "${org}" not found. Check the spelling or use your GitHub username instead.` });
          return;
        }
        const orgData = await orgRes.json() as any;
        if (!orgRes.ok) {
          setTestResult({ ok: false, message: `✗ Cannot access org "${org}": ${orgData.message ?? `HTTP ${orgRes.status}`}` });
          return;
        }
        // Check membership / repo creation permission
        const memberRes = await fetch(`https://api.github.com/orgs/${org}/members/${login}`, { headers });
        if (memberRes.status === 302 || memberRes.status === 204) {
          setTestResult({ ok: true, message: `✓ Authenticated as @${login}, member of ${orgData.login} - repos will be created in the org` });
        } else {
          setTestResult({ ok: false, message: `✗ @${login} is not a member of "${org}", or the token lacks org access` });
        }
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `✗ Network error: ${err.message}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Git" desc="Used to automatically create a GitHub repository when initializing a new project (v0)." />

      <div style={CARD}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={LABEL}>GitHub Organisation / User</label>
            <Input value={gitOrg} onChange={e => setGitOrg(e.target.value)} placeholder="my-github-org" style={{ width: "100%" }} />
            <p style={HINT}>New repos will be created under this org or user account.</p>
          </div>
          <div>
            <label style={LABEL}>Local repos directory</label>
            <Input value={localReposDir} onChange={e => setLocalReposDir(e.target.value)} placeholder="~/Development" style={{ width: "100%" }} />
            <p style={HINT}>Where you clone repos locally. Used to load prototype previews (e.g. <code style={{ background: "rgba(165,182,214,0.08)", padding: "0 4px", borderRadius: 3 }}>~/Development</code> → <code style={{ background: "rgba(165,182,214,0.08)", padding: "0 4px", borderRadius: 3 }}>~/Development/my-repo/proto/index.html</code>).</p>
          </div>
          <div>
            <label style={LABEL}>
              Personal Access Token
              {initial?.gitToken && <span style={{ marginLeft: 8, fontSize: "0.62rem", color: "var(--accent)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>✓ saved</span>}
            </label>
            <div style={{ position: "relative" }}>
              <Input type={showToken ? "text" : "password"} value={gitToken} onChange={e => { setGitToken(e.target.value); setTestResult(null); }}
                placeholder="ghp_••••••••••••••••••••••••••••••••••••••"
                style={{ width: "100%", paddingRight: 72 }} />
              <button type="button" onClick={() => setShowToken(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--fg-subtle)", fontFamily: "inherit", padding: 0 }}>
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p style={HINT}>
              Needs <code style={{ background: "rgba(165,182,214,0.08)", padding: "0 4px", borderRadius: 3 }}>repo</code> scope (classic) or Administration write (fine-grained, All repositories).{" "}
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>Create one →</a>
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius)", fontSize: "0.80rem", lineHeight: 1.5,
              background: testResult.ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: testResult.ok ? "#22c55e" : "#ef4444",
            }}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="primary" size="md" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button variant="outline" size="md" onClick={testConnection} disabled={testing || !gitToken.trim()}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {saved && <span style={{ fontSize: "0.82rem", color: "var(--accent)" }}>✓ Saved</span>}
      </div>
    </div>
  );
}

// ── Tech Stacks section ───────────────────────────────────────────────────────

// ── Tech catalog ──────────────────────────────────────────────────────────────

interface CatalogItem { id: string; name: string; cat: string; bg: string; fg: string; abbr: string; }

const CATALOG: CatalogItem[] = [
  // Framework
  { id: "tanstack-start", name: "TanStack Start", cat: "Framework", bg: "#f97316", fg: "#fff", abbr: "TS" },
  { id: "nextjs", name: "Next.js", cat: "Framework", bg: "#000", fg: "#fff", abbr: "N" },
  { id: "remix", name: "Remix", cat: "Framework", bg: "#1d1d1f", fg: "#e8f2ff", abbr: "RX" },
  { id: "sveltekit", name: "SvelteKit", cat: "Framework", bg: "#ff3e00", fg: "#fff", abbr: "SK" },
  { id: "astro", name: "Astro", cat: "Framework", bg: "#17191e", fg: "#ff5d01", abbr: "AS" },
  // UI
  { id: "react", name: "React", cat: "UI", bg: "#0f1117", fg: "#61dafb", abbr: "Re" },
  { id: "tailwind", name: "Tailwind CSS", cat: "UI", bg: "#06b6d4", fg: "#fff", abbr: "TW" },
  { id: "shadcn", name: "shadcn/ui", cat: "UI", bg: "#18181b", fg: "#fff", abbr: "UI" },
  { id: "radix", name: "Radix UI", cat: "UI", bg: "#1c1c1e", fg: "#8e4ec6", abbr: "RX" },
  // Language
  { id: "typescript", name: "TypeScript", cat: "Language", bg: "#3178c6", fg: "#fff", abbr: "TS" },
  // Database
  { id: "sqlite", name: "SQLite", cat: "Database", bg: "#0f3c56", fg: "#5ba8d0", abbr: "SQ" },
  { id: "postgres", name: "PostgreSQL", cat: "Database", bg: "#336791", fg: "#fff", abbr: "PG" },
  { id: "mysql", name: "MySQL", cat: "Database", bg: "#00618a", fg: "#f29111", abbr: "MY" },
  { id: "supabase", name: "Supabase", cat: "Database", bg: "#1a1a2e", fg: "#3ecf8e", abbr: "SB" },
  { id: "planetscale", name: "PlanetScale", cat: "Database", bg: "#060606", fg: "#fff", abbr: "PS" },
  // ORM
  { id: "drizzle", name: "Drizzle ORM", cat: "ORM", bg: "#c5f74f", fg: "#0f0f0f", abbr: "DR" },
  { id: "prisma", name: "Prisma", cat: "ORM", bg: "#2d3748", fg: "#a0aec0", abbr: "PR" },
  // Auth
  { id: "better-auth", name: "better-auth", cat: "Auth", bg: "#7c3aed", fg: "#fff", abbr: "BA" },
  { id: "clerk", name: "Clerk", cat: "Auth", bg: "#6c47ff", fg: "#fff", abbr: "CK" },
  { id: "nextauth", name: "NextAuth.js", cat: "Auth", bg: "#21222c", fg: "#a78bfa", abbr: "NA" },
  { id: "lucia", name: "Lucia", cat: "Auth", bg: "#5c2d91", fg: "#e2d5f5", abbr: "LC" },
  // Payments
  { id: "polar", name: "Polar.sh", cat: "Payments", bg: "#0062ff", fg: "#fff", abbr: "PL" },
  { id: "stripe", name: "Stripe", cat: "Payments", bg: "#635bff", fg: "#fff", abbr: "ST" },
  { id: "lemonsqueezy", name: "Lemon Squeezy", cat: "Payments", bg: "#ffd832", fg: "#1a1a1a", abbr: "LS" },
  { id: "paddle", name: "Paddle", cat: "Payments", bg: "#0ea5e9", fg: "#fff", abbr: "PA" },
  // Analytics / Monitoring
  { id: "posthog", name: "PostHog", cat: "Monitoring", bg: "#1d4aff", fg: "#fff", abbr: "PH" },
  { id: "sentry", name: "Sentry", cat: "Monitoring", bg: "#362d59", fg: "#fb4226", abbr: "SN" },
  { id: "plausible", name: "Plausible", cat: "Monitoring", bg: "#5850ec", fg: "#fff", abbr: "PL" },
  // Deploy
  { id: "vercel", name: "Vercel", cat: "Deploy", bg: "#000", fg: "#fff", abbr: "VC" },
  { id: "coolify", name: "Coolify", cat: "Deploy", bg: "#6d28d9", fg: "#fff", abbr: "CF" },
  { id: "railway", name: "Railway", cat: "Deploy", bg: "#0b0d0e", fg: "#a78bfa", abbr: "RW" },
  { id: "fly", name: "Fly.io", cat: "Deploy", bg: "#7b3fe4", fg: "#fff", abbr: "FY" },
  // Tooling
  { id: "vite", name: "Vite", cat: "Tooling", bg: "#646cff", fg: "#fff", abbr: "VT" },
  { id: "pnpm", name: "pnpm", cat: "Tooling", bg: "#f69220", fg: "#fff", abbr: "PN" },
  { id: "vitest", name: "Vitest", cat: "Tooling", bg: "#6e9f18", fg: "#fff", abbr: "VI" },
  { id: "openrouter", name: "OpenRouter", cat: "AI", bg: "#10a37f", fg: "#fff", abbr: "OR" },
  { id: "openai", name: "OpenAI", cat: "AI", bg: "#10a37f", fg: "#fff", abbr: "AI" },
  { id: "anthropic", name: "Anthropic", cat: "AI", bg: "#c75a3a", fg: "#fff", abbr: "AN" },
];

const CATEGORIES = [...new Set(CATALOG.map(t => t.cat))];

function TechLogo({ item, size = 26 }: { item: CatalogItem; size?: number }) {
  return (
    <div title={item.name} style={{
      width: size, height: size, borderRadius: 5, background: item.bg, color: item.fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, flexShrink: 0, letterSpacing: "-0.01em",
      fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {item.abbr}
    </div>
  );
}

// Parse existing content to detect which catalog items are selected
function parseSelectedIds(content: string): Set<string> {
  const lower = content.toLowerCase();
  const selected = new Set<string>();
  for (const item of CATALOG) {
    const names = [item.name.toLowerCase(), item.id.toLowerCase()];
    if (names.some(n => lower.includes(n))) selected.add(item.id);
  }
  return selected;
}

// Generate content string from selected IDs + custom text
function generateContent(selectedIds: Set<string>, custom: string): string {
  const names = CATALOG.filter(t => selectedIds.has(t.id)).map(t => t.name);
  const lines: string[] = [];
  if (names.length > 0) lines.push(`- Stack: ${names.join(", ")}`);
  if (custom.trim()) lines.push(...custom.trim().split("\n").filter(Boolean));
  return lines.join("\n");
}

// ── Stack editor (inline checklist) ──────────────────────────────────────────

function StackEditor({ name: initName, content: initContent, onSave, onCancel, busy }: {
  name: string; content: string; onSave: (name: string, content: string) => void; onCancel: () => void; busy: boolean;
}) {
  const [name, setName] = useState(initName);
  const [selected, setSelected] = useState<Set<string>>(() => parseSelectedIds(initContent));
  const [custom, setCustom] = useState(() => {
    const lines = initContent.split("\n").filter(l => !l.startsWith("- Stack:"));
    return lines.join("\n");
  });

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem",
    padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={LABEL}>Stack name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. TanStack + Supabase" autoFocus />
      </div>

      {CATEGORIES.map(cat => {
        const items = CATALOG.filter(t => t.cat === cat);
        return (
          <div key={cat}>
            <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 10 }}>{cat}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 6 }}>
              {items.map(item => {
                const on = selected.has(item.id);
                return (
                  <button key={item.id} onClick={() => toggle(item.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                      background: on ? "rgba(255,255,255,0.05)" : "transparent",
                      border: `1px solid ${on ? "rgba(255,255,255,0.18)" : "var(--border)"}`,
                      borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <TechLogo item={item} />
                    <span style={{ fontSize: "0.80rem", color: on ? "var(--fg)" : "var(--fg-muted)", fontWeight: on ? 500 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                    {on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div>
        <label style={LABEL}>Additional notes <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "rgba(250,250,250,0.3)" }}>- optional</span></label>
        <textarea value={custom} onChange={e => setCustom(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65 }}
          placeholder="- Deployable via Coolify&#10;- Monorepo with Turborepo" />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => onSave(name.trim(), generateContent(selected, custom))} disabled={busy || !name.trim() || selected.size === 0}>
          {busy ? "Saving…" : "Save stack"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── StacksSection ──────────────────────────────────────────────────────────────

export function StacksSection({ initial }: { initial: TechStack[] }) {
  const [stacks, setStacks] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function handleSaveEdit(id: number, name: string, content: string) {
    setBusy(true);
    try {
      await updateTechStack({ data: { id, name, content } });
      setStacks(prev => prev.map(s => s.id === id ? { ...s, name, content, updatedAt: new Date() } : s));
      setEditingId(null);
    } finally { setBusy(false); }
  }

  async function handleCreate(name: string, content: string) {
    setBusy(true);
    try {
      const { id } = await createTechStack({ data: { name, content } });
      setStacks(prev => [...prev, { id, name, content, isDefault: false, createdAt: new Date(), updatedAt: new Date() }]);
      setAdding(false);
    } finally { setBusy(false); }
  }

  async function handleSetDefault(id: number) {
    await updateTechStack({ data: { id, isDefault: true } });
    setStacks(prev => prev.map(s => ({ ...s, isDefault: s.id === id })));
  }

  async function handleDelete(id: number, name: string) {
    const ok = await confirm(`Delete "${name}"?`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    await deleteTechStack({ data: { id } });
    setStacks(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div>
      <SectionHeader title="Tech Stacks" desc="Reusable stack presets selected per project. The chosen stack is injected into every build prompt sent to Claude Code." />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {stacks.map(s => {
          const selectedIds = parseSelectedIds(s.content);
          const selectedItems = CATALOG.filter(t => selectedIds.has(t.id));
          return (
            <div key={s.id} style={CARD}>
              {editingId === s.id ? (
                <StackEditor
                  name={s.name} content={s.content} busy={busy}
                  onSave={(name, content) => handleSaveEdit(s.id, name, content)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--fg)", flex: 1 }}>{s.name}</span>
                    {s.isDefault && (
                      <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", border: "1px solid rgba(0,255,136,0.25)", padding: "1px 6px", borderRadius: 3 }}>default</span>
                    )}
                    <div style={{ display: "flex", gap: 5 }}>
                      {!s.isDefault && (
                        <Button variant="outline" size="sm" onClick={() => handleSetDefault(s.id)}>Set default</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditingId(s.id)}>Edit</Button>
                      {stacks.length > 1 && !s.isDefault && (
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id, s.name)}>Delete</Button>
                      )}
                    </div>
                  </div>
                  {/* Logo row */}
                  {selectedItems.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedItems.map(item => <TechLogo key={item.id} item={item} size={28} />)}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>
                      {s.content.slice(0, 120)}{s.content.length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div style={CARD}>
          <StackEditor
            name="" content="" busy={busy}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} style={{ gap: 5 }}>+ New stack</Button>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "1.0rem", fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>{desc}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SettingsLayout() {
  const { profile, stacks } = Route.useLoaderData();
  const { location } = useRouterState();
  const path = location.pathname;

  function dot(ok: boolean) {
    return <span style={{ width: 5, height: 5, borderRadius: "50%", background: ok ? "#22c55e" : "rgba(245,158,11,0.7)", flexShrink: 0 }} />;
  }

  const statusFor = (id: string) => {
    if (id === "profile") return dot(!!(profile?.handle && profile?.skills?.length));
    if (id === "stacks") return dot(stacks.length > 0);
    if (id === "source-control") return dot(!!(profile?.gitOrg && profile?.gitToken));
    if (id === "integrations") return dot(!!(profile?.openRouterKey));
    return null;
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left nav */}
      <div style={{ width: 230, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto", padding: "20px 0 40px" }}>
        {NAV_GROUPS.map(group => (
          <div key={group.group} style={{ marginBottom: 8 }}>
            <div style={{ padding: "12px 16px 6px", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(250,250,250,0.28)" }}>
              {group.group}
            </div>
            {group.items.map(item => {
              const isActive = path === `/settings/${item.id}`;
              return (
                <Link key={item.id} to={`/settings/${item.id}` as any}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px", textDecoration: "none",
                    background: isActive ? "rgba(165,182,214,0.06)" : "transparent",
                    borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.83rem", fontWeight: isActive ? 600 : 400, color: isActive ? "var(--fg)" : "var(--fg-muted)" }}>{item.label}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", marginTop: 1 }}>{item.desc}</div>
                  </div>
                  {statusFor(item.id)}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      {/* Sub-route content */}
      <Outlet />
    </div>
  );
}
