import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import type { CvProfile, GapRow, Debate, DebateRound, Stance } from "../db/schema";

export const Route = createFileRoute("/r/$slug")({
  loader: async ({ params, context }) => {
    const { db } = await import("../db/client");
    const { analyses } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");

    const [analysis] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, params.slug))
      .limit(1);

    if (!analysis) return null;

    const req = (context as any).request as Request | undefined;
    const cookieHeader = req?.headers.get("cookie") ?? "";
    const ownerToken = parseCookie(cookieHeader, `rr_own_${params.slug}`);
    const isOwner = ownerToken === analysis.ownerToken;

    return {
      id: analysis.id,
      isOwner,
      decisionType: analysis.decisionType,
      profile: analysis.profile,
      gapAnalysis: analysis.gapAnalysis,
      gapJdTitle: analysis.gapJdTitle,
      fastDebate: analysis.fastDebate,
      topDebate: analysis.topDebate,
    };
  },
  component: ResultPage,
});

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="spinner-row" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </div>
  );
}

function ProfileSection({ profile, isShareView = false }: { profile: CvProfile; isShareView?: boolean }) {
  return (
    <section className="section-block">
      <div className="sec-head">
        <div>
          <div className="num">SECTION A · EXTRACTED FROM YOUR CV</div>
          <h2 style={{ marginTop: 6 }}>Your profile</h2>
        </div>
        <div className="h-meta">Factual only — no scores</div>
      </div>

      <div className="profile-card">
        <div className="profile-hd">
          <div>
            <div className="name">{profile.name || "—"}</div>
            <div className="title-line">
              {profile.currentTitle}{" "}
              <span style={{ color: "var(--ink-3)" }}>· last at</span> {profile.lastCompany}{" "}
              <span style={{ color: "var(--ink-3)" }}>· {profile.location}</span>
            </div>
          </div>
          <div className="right">
            <span className="yoe tnum">{profile.yoe}</span>
            <span>YEARS · EXP</span>
          </div>
        </div>

        <div className="kv-grid">
          <div className="kv">
            <div className="kv-label">Recent titles</div>
            <div className="kv-body">
              {profile.titles.slice(0, 3).map((t) => (
                <div
                  key={t.role + t.co}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: "4px 0",
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 500 }}>{t.role}</span>{" "}
                    <span className="muted">· {t.co}</span>
                  </span>
                  <span className="mono tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {t.yrs}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="kv">
            <div className="kv-label">Industries worked in</div>
            <div className="kv-body">
              <div className="pill-row">
                {profile.industries.map((i) => (
                  <span key={i} className="pill industry">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="kv">
            <div className="kv-label">Primary skills · from CV</div>
            <div className="kv-body">
              <div className="pill-row">
                {profile.skills.map((s) => (
                  <span key={s} className="pill skill">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="kv">
            <div className="kv-label">Education</div>
            <div className="kv-body">
              {profile.education.map((e) => (
                <div key={e.school} style={{ padding: "2px 0" }}>
                  <span style={{ fontWeight: 500 }}>{e.degree}</span>
                  <br />
                  <span className="muted">
                    {e.school} · {e.yr}
                  </span>
                </div>
              ))}
              {profile.languages.length > 0 && (
                <div style={{ marginTop: 12 }} className="pill-row">
                  {profile.languages.map((l) => (
                    <span key={l} className="pill lang">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="profile-foot">
          {isShareView ? (
            <>
              <span>EXTRACTED PROFILE · PUBLIC SHARE VIEW</span>
              <span style={{ color: "var(--ink-4)" }}>CV FILE NOT EXPOSED</span>
            </>
          ) : (
            <span>REVIEW THIS — IF SOMETHING LOOKS WRONG, IT AFFECTS THE DEBATE QUALITY</span>
          )}
        </div>
      </div>
    </section>
  );
}

function GapSection({ rows, jdTitle }: { rows: GapRow[]; jdTitle: string | null }) {
  return (
    <section className="section-block">
      <div className="sec-head">
        <div>
          <div className="num">SECTION B · CV vs JD</div>
          <h2 style={{ marginTop: 6 }}>What the JD asks for, what your CV shows</h2>
        </div>
        <div className="h-meta">Presence, not score</div>
      </div>

      <div className="gap-block">
        <div className="gap-hd">
          <div>
            <div className="jd">{jdTitle || "Job Description"}</div>
            <div className="jd-sub">Based on what's in your CV and this job description — not a prediction.</div>
          </div>
          <div className="legend">
            <span>
              <i className="dot ok" /> PRESENT
            </span>
            <span>
              <i className="dot partial" /> PARTIAL
            </span>
            <span>
              <i className="dot missing" /> MISSING
            </span>
          </div>
        </div>

        <div className="gap-rows">
          {rows.map((r, i) => (
            <div key={i} className="gap-row">
              <div className="gap-cell">
                <span className="label">JD asks</span>
                {r.jd}
              </div>
              <div className="gap-cell">
                <span className="label">Your CV shows</span>
                {r.cv}
              </div>
              <div className="gap-cell" style={{ display: "flex", alignItems: "center" }}>
                <span className={`gap-status ${r.status}`}>
                  {r.status === "ok" ? "PRESENT" : r.status === "partial" ? "PARTIAL" : "NOT IN CV"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StanceBlock({ s }: { s: Stance }) {
  return (
    <div className="stance">
      <div className="model">
        <div className="who">{s.who}</div>
        <div className="what">{s.what}</div>
        <div className={`tag lean-${s.lean}`}>{s.leanLabel}</div>
      </div>
      <div className="body">
        <p>{s.body}</p>
        {s.kicker && (
          <>
            <span className="kicker">{s.kicker}</span>
            <p>{s.tail}</p>
          </>
        )}
      </div>
    </div>
  );
}

function DebateMeta({
  debate,
  tier,
}: {
  debate: { question: string; context: string; modelsUsed: string; runTime: string };
  tier: "fast" | "top";
}) {
  return (
    <div className="debate-meta">
      <div>
        <span className="lbl">QUESTION</span>
        <span className="val">{debate.question}</span>
      </div>
      <div>
        <span className="lbl">CONTEXT</span>
        <span className="val">{debate.context}</span>
      </div>
      <div>
        <span className="lbl">MODELS</span>
        <span className="val">
          {tier === "top" ? "Three frontier models" : debate.modelsUsed}
        </span>
      </div>
      <div className="right">
        <span className="lbl">RUN TIME</span>
        <span className="val tnum">{debate.runTime}</span>
      </div>
    </div>
  );
}

function DebateBlock({ debate, tier }: { debate: Debate; tier: "fast" | "top" }) {
  return (
    <div className="debate fade-in">
      <DebateMeta debate={debate} tier={tier} />

      {debate.rounds.map((r, i) => (
        <div key={i} className="round">
          <div className="round-hd">
            <span className="num">{r.n.toUpperCase()}</span>
            <h3>{r.title}</h3>
          </div>
          {r.stances.map((s, j) => (
            <StanceBlock key={j} s={s} />
          ))}
        </div>
      ))}

      <div className="verdict">
        <div className="v-lbl">FINAL VERDICT</div>
        <div className="v-headline">{debate.verdict.line}</div>
        <p className="v-body">{debate.verdict.body}</p>
        <div className="v-foot">
          <span>{debate.verdict.confidence.toUpperCase()}</span>
          <span>
            RUN ID · {debate.modelsUsed.slice(0, 3).toLowerCase()}_{Date.now().toString(36)} ·{" "}
            {new Date().toISOString().slice(0, 10)}
          </span>
        </div>
      </div>

      <div className="debate-disclaimer">
        AI opinion, not fact. Models disagree on purpose — the verdict is a synthesis.
      </div>
    </div>
  );
}

function GatedPreview({
  round1,
  meta,
  analysisId,
  onUnlock,
}: {
  round1: DebateRound;
  meta: { question: string; context: string; modelsUsed: string; runTime: string };
  analysisId: string;
  onUnlock: (debate: Debate) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debate/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: analysisId, email: email.trim() }),
      });
      if (!res.ok) throw new Error("Unlock failed");
      const { debate } = await res.json();
      onUnlock(debate);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="debate fade-in">
      <DebateMeta debate={meta} tier="top" />

      <div className="round">
        <div className="round-hd">
          <span className="num">{round1.n.toUpperCase()}</span>
          <h3>{round1.title}</h3>
        </div>
        {round1.stances.map((s, j) => (
          <StanceBlock key={j} s={s} />
        ))}
      </div>

      <form className="gate" onSubmit={submit}>
        <div className="gate-eyebrow">{`${1} MORE ROUND · VERDICT BELOW`}</div>
        <div className="gate-title">Continue reading</div>
        <p className="gate-body">
          You've seen the initial stances. The cross-pushback round and final verdict need a free
          account.
        </p>
        <div className="gate-row">
          <input
            ref={inputRef}
            className="gate-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <button className="btn btn-primary" type="submit" disabled={!valid || loading}>
            {loading ? <span className="spinner" style={{ borderTopColor: "var(--bg)" }} /> : null}
            Continue
            {!loading && <span className="btn-arrow">→</span>}
          </button>
        </div>
        {error && (
          <div style={{ color: "var(--warn)", fontFamily: "Geist Mono, monospace", fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        )}
        <div className="gate-foot">
          Used to save your run. No marketing emails.
        </div>
      </form>
    </div>
  );
}

type DebateStatus = "idle" | "running" | "gated" | "done";

function DebateSection({
  analysisId,
  initialFastDebate,
  initialTopDebate,
}: {
  analysisId: string;
  initialFastDebate: Debate | null;
  initialTopDebate: Debate | null;
}) {
  const [fastStatus, setFastStatus] = useState<DebateStatus>(initialFastDebate ? "done" : "idle");
  const [topStatus, setTopStatus] = useState<DebateStatus>(initialTopDebate ? "done" : "idle");
  const [fastDebate, setFastDebate] = useState<Debate | null>(initialFastDebate);
  const [topDebate, setTopDebate] = useState<Debate | null>(initialTopDebate);
  const [topRound1, setTopRound1] = useState<DebateRound | null>(null);
  const [topMeta, setTopMeta] = useState<{ question: string; context: string; modelsUsed: string; runTime: string } | null>(null);
  const [fastError, setFastError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  const runFast = async () => {
    setFastStatus("running");
    setFastError(null);
    try {
      const res = await fetch("/api/debate/fast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: analysisId }),
      });
      if (!res.ok) throw new Error("Debate failed");
      const { debate } = await res.json();
      setFastDebate(debate);
      setFastStatus("done");
    } catch {
      setFastError("Debate failed. Try again.");
      setFastStatus("idle");
    }
  };

  const runTop = async () => {
    setTopStatus("running");
    setTopError(null);
    try {
      const res = await fetch("/api/debate/top", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: analysisId }),
      });
      if (!res.ok) throw new Error("Top debate failed");
      const { round1, meta } = await res.json();
      setTopRound1(round1);
      setTopMeta(meta);
      setTopStatus("gated");
    } catch {
      setTopError("Top debate failed. Try again.");
      setTopStatus("idle");
    }
  };

  const onUnlock = (debate: Debate) => {
    setTopDebate(debate);
    setTopStatus("done");
  };

  const activeDebate = topStatus === "done" ? topDebate : fastStatus === "done" ? fastDebate : null;
  const activeTier = topStatus === "done" ? "top" : "fast";

  return (
    <section className="section-block">
      <div className="sec-head">
        <div>
          <div className="num">SECTION C · THE DEBATE</div>
          <h2 style={{ marginTop: 6 }}>The debate</h2>
        </div>
      </div>

      <div className="debate-actions">
        <div className="action-card" style={fastStatus === "done" ? { borderColor: "var(--ink)" } : undefined}>
          <h3>Get Verdict</h3>
          <div className="ac-sub">FAST · FREE · EFFICIENT MODELS</div>
          <p className="muted-2" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Three lightweight models. ~15 seconds. Good directional read.
          </p>
          <div className="ac-foot">
            <button
              className="btn btn-secondary"
              onClick={runFast}
              disabled={fastStatus === "running" || topStatus === "running"}
            >
              {fastStatus === "running" ? (
                <span className="spinner" />
              ) : fastStatus === "done" ? (
                "Re-run"
              ) : (
                "Get Verdict"
              )}
            </button>
          </div>
        </div>

        <div
          className="action-card is-premium"
          style={topStatus === "done" || topStatus === "gated" ? { borderColor: "var(--accent-ink)" } : undefined}
        >
          <h3>Top Tier Debate</h3>
          <div className="ac-sub" style={{ color: "var(--accent-ink)" }}>
            FRONTIER MODELS · DEEPER ANALYSIS
          </div>
          <p className="muted-2" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            Longer reasoning, sharper disagreement, adversarial review. ~90s.
          </p>
          <div className="ac-foot">
            <button
              className="btn btn-premium"
              onClick={runTop}
              disabled={topStatus === "running" || topStatus === "gated" || topStatus === "done"}
            >
              {topStatus === "running" ? (
                <span className="spinner" style={{ borderTopColor: "#fff" }} />
              ) : topStatus === "done" ? (
                "Complete"
              ) : (
                <>
                  Run Top Tier<span className="btn-arrow">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {fastError && (
        <div style={{ color: "var(--warn)", fontFamily: "Geist Mono, monospace", fontSize: 12, marginBottom: 12 }}>
          {fastError}
        </div>
      )}
      {topError && (
        <div style={{ color: "var(--warn)", fontFamily: "Geist Mono, monospace", fontSize: 12, marginBottom: 12 }}>
          {topError}
        </div>
      )}

      {(fastStatus === "running" || topStatus === "running") && (
        <div className="run-card fade-in">
          <Spinner label={topStatus === "running" ? "Running top tier debate" : "Running debate"} />
        </div>
      )}

      {topStatus === "gated" && topRound1 && topMeta && (
        <GatedPreview
          round1={topRound1}
          meta={topMeta}
          analysisId={analysisId}
          onUnlock={onUnlock}
        />
      )}

      {topStatus === "done" && topDebate && <DebateBlock debate={topDebate} tier="top" />}

      {fastStatus === "done" && fastDebate && topStatus !== "done" && topStatus !== "gated" && (
        <DebateBlock debate={fastDebate} tier="fast" />
      )}

      {fastStatus === "idle" && topStatus === "idle" && (
        <div className="debate-empty">Pick a tier above. The debate renders inline.</div>
      )}
    </section>
  );
}

function ShareSection({ slug, onCopy }: { slug: string; onCopy: () => void }) {
  return (
    <section className="section-block">
      <div className="sec-head">
        <div>
          <div className="num">SECTION D · SHARE</div>
          <h2 style={{ marginTop: 6 }}>Share your profile</h2>
        </div>
        <div className="h-meta">Profile only — debate stays private</div>
      </div>

      <div className="share-card">
        <div>
          <div className="share-url">
            <span className="scheme">resetroads.com/r/</span>
            <span className="slug">{slug}</span>
          </div>
          <div className="share-note">
            THE SHARE PAGE SHOWS YOUR PROFILE ONLY · CV FILE IS NEVER EXPOSED
          </div>
        </div>
        <button className="btn btn-secondary" onClick={onCopy}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M5.5 3V2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H10.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
          Copy link
        </button>
      </div>
    </section>
  );
}

function LockedBlock({
  sectionLabel,
  title,
  teaser,
  lines = 4,
}: {
  sectionLabel: string;
  title: string;
  teaser: string;
  lines?: number;
}) {
  return (
    <section className="section-block">
      <div className="sec-head">
        <div>
          <div className="num">{sectionLabel}</div>
          <h2 style={{ marginTop: 6 }}>{title}</h2>
        </div>
        <div className="h-meta">Hidden on share view</div>
      </div>

      <div className="locked-block">
        <div className="lock-row">
          <div className="lock-title">Private</div>
          <div className="lock-pill">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="4.5" width="6" height="4" rx="0.8" stroke="currentColor" strokeWidth="0.9" />
              <path d="M3.4 4.5V3.2a1.6 1.6 0 0 1 3.2 0v1.3" stroke="currentColor" strokeWidth="0.9" />
            </svg>
            LOCKED
          </div>
        </div>
        <p className="teaser">{teaser}</p>
        <div className="locked-fade" aria-hidden="true">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className={`fb s${i + 1}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [toast, setToast] = useState<string | null>(null);

  if (!data) {
    return (
      <main className="shell" style={{ paddingTop: 80, textAlign: "center" }}>
        <h2 style={{ color: "var(--ink-3)" }}>Analysis not found</h2>
        <p style={{ marginTop: 12, color: "var(--ink-3)" }}>
          <Link to="/" style={{ color: "var(--accent)" }}>
            Start a new analysis
          </Link>
        </p>
      </main>
    );
  }

  const onCopy = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://resetroads.com"}/r/${slug}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setToast(`Copied · ${url}`);
    setTimeout(() => setToast(null), 1800);
  };

  if (!data.profile) {
    return (
      <main className="shell" style={{ paddingTop: 80, textAlign: "center" }}>
        <Spinner label="Profile loading" />
      </main>
    );
  }

  if (!data.isOwner) {
    return (
      <>
        <header className="topbar">
          <Link to="/" className="brand">
            <span className="brand-mark">R</span>
            <span>ResetRoads</span>
          </Link>
          <div className="right">
            <span>PUBLIC · /r/{slug}</span>
          </div>
        </header>

        <main className="shell">
          <section className="hero" style={{ paddingTop: 32, paddingBottom: 8 }}>
            <div className="eyebrow">PUBLIC PROFILE · /r/{slug}</div>
            <h1 style={{ fontSize: "clamp(28px,4vw,40px)", marginTop: 12 }}>
              {data.profile.name ? `${data.profile.name}'s profile.` : "Shared profile."}
            </h1>
            <p className="lede">
              This is the extracted profile. The rest is private.
            </p>
          </section>

          <ProfileSection profile={data.profile} isShareView />

          <LockedBlock
            sectionLabel="SECTION B · CV vs JD"
            title="Gap analysis"
            teaser="The full CV vs JD comparison is private to the owner."
            lines={4}
          />

          <LockedBlock
            sectionLabel="SECTION C · THE DEBATE"
            title="The debate"
            teaser="Three models argued the trade-offs. The verdict is private."
            lines={5}
          />

          <section className="shell" style={{ padding: 0 }}>
            <div className="flat-cta">
              <p>Try it with your CV.</p>
              <Link to="/" className="btn btn-primary">
                Upload CV<span className="btn-arrow">→</span>
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">R</span>
          <span>ResetRoads</span>
        </Link>
        <div className="right">
          <span className="dot-live" />
          <span>SESSION · /r/{slug}</span>
        </div>
      </header>

      <main className="shell">
        <section className="hero" style={{ paddingTop: 32, paddingBottom: 0 }}>
          <div className="eyebrow">
            REPORT · /r/{slug} · {new Date().toISOString().slice(0, 10)}
          </div>
          <h1 style={{ fontSize: "clamp(28px,4vw,40px)", marginTop: 12 }}>Your read.</h1>
        </section>

        <ProfileSection profile={data.profile} />

        {data.gapAnalysis && data.gapAnalysis.length > 0 && (
          <GapSection rows={data.gapAnalysis} jdTitle={data.gapJdTitle} />
        )}

        <DebateSection
          analysisId={data.id}
          initialFastDebate={data.fastDebate ?? null}
          initialTopDebate={data.topDebate ?? null}
        />

        <ShareSection slug={slug} onCopy={onCopy} />
      </main>

      {toast && <div className="copy-toast">{toast}</div>}
    </>
  );
}
