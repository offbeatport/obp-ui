import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, type DragEvent, type ChangeEvent } from "react";

export const Route = createFileRoute("/")({
  component: UploadPage,
});

const DECISIONS = [
  {
    id: "offer",
    label: "Should I take this offer?",
    sub: "Paste the JD — we compare against your CV and debate the trade-offs.",
    key: "01",
    reveals: "jd" as const,
  },
  {
    id: "freelance",
    label: "Freelance vs. full-time?",
    sub: "Weigh runway, network, market position and risk against your CV.",
    key: "02",
  },
  {
    id: "pivot",
    label: "Stay in tech or pivot?",
    sub: "Adjacent moves vs. a real reset — where does your experience travel?",
    key: "03",
  },
  {
    id: "salary",
    label: "Is this salary fair?",
    sub: "Tell us the offer details — we debate it against your level and market.",
    key: "04",
    reveals: "salary" as const,
  },
  {
    id: "other",
    label: "Something else",
    sub: "Describe the decision in your own words.",
    key: "05",
    reveals: "text" as const,
  },
];

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 14V4M11 4l-4 4M11 4l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 1.5h5l3 3V12a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 3 12V2a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path d="M8 1.5V4.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

interface FileInfo {
  file: File;
  filename: string;
  size: string;
}

function Dropzone({
  fileInfo,
  onFile,
  onClear,
}: {
  fileInfo: FileInfo | null;
  onFile: (f: FileInfo) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    onFile({
      file: f,
      filename: f.name,
      size: f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : "— KB",
    });
  };

  if (fileInfo) {
    return (
      <div className="dropzone" style={{ borderStyle: "solid", borderColor: "var(--line-strong)", cursor: "default" }}>
        <div className="icon" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M5 11l4 4 8-8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3>CV uploaded</h3>
        <div className="filechip">
          <IconDoc />
          <span>{fileInfo.filename}</span>
          <span style={{ color: "var(--ink-4)" }}>· {fileInfo.size}</span>
          <button
            className="x"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            ×
          </button>
        </div>
        <div className="formats">No file retained — only the extracted profile</div>
      </div>
    );
  }

  return (
    <div
      className={drag ? "dropzone is-drag" : "dropzone"}
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        style={{ display: "none" }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
      <div className="icon">
        <IconUpload />
      </div>
      <h3>Drop your CV here, or click to browse</h3>
      <div className="muted" style={{ fontSize: 13.5, maxWidth: 380 }}>
        Goes to our extractor, then a structured debate. The file itself is never stored.
      </div>
      <div className="formats">PDF · DOCX · TXT · up to 10 MB</div>
    </div>
  );
}

function UploadPage() {
  const navigate = useNavigate();
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [decision, setDecision] = useState<string>("");
  const [jd, setJd] = useState("");
  const [salary, setSalary] = useState("");
  const [other, setOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!fileInfo && !!decision && !loading;

  const onSubmit = async () => {
    if (!fileInfo || !decision) return;
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("cv", fileInfo.file);
      form.append("decisionType", decision);

      const detail =
        decision === "offer" ? jd : decision === "salary" ? salary : decision === "other" ? other : "";
      if (detail) form.append("decisionDetail", detail);

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Analysis failed");
      }

      const { id } = await res.json();
      navigate({ to: "/r/$slug", params: { slug: id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const selectedDecision = DECISIONS.find((d) => d.id === decision);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <span>ResetRoads</span>
        </div>
        <div className="right">
          <span>v1 · BETA</span>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <div className="eyebrow">A FREE TOOL FOR PEOPLE WHO JUST GOT LAID OFF</div>
          <h1>
            Upload your CV.
            <br />
            Get an <em>honest read</em> on your next move.
          </h1>
          <p className="lede">
            We read your CV, extract what matters, then debate your specific situation
            with AI — so you can make a better decision.
          </p>
          <div className="meta-row eyebrow">
            <span>NO SIGN-IN</span>
            <span className="sep" />
            <span>NO EMAIL</span>
            <span className="sep" />
            <span>FILE NEVER STORED</span>
          </div>

          <Dropzone fileInfo={fileInfo} onFile={setFileInfo} onClear={() => setFileInfo(null)} />
        </section>

        <section className="section-block" aria-labelledby="dec-h">
          <div className="sec-head">
            <div>
              <div className="num">QUESTION · REQUIRED</div>
              <h2 id="dec-h" style={{ marginTop: 6 }}>
                What are you deciding right now?
              </h2>
            </div>
            <div className="h-meta">Pick one — grounds the debate</div>
          </div>

          <div className="choices" role="radiogroup">
            {DECISIONS.map((d) => {
              const selected = decision === d.id;
              return (
                <div key={d.id}>
                  <button
                    type="button"
                    className="choice"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDecision(d.id)}
                  >
                    <span className="radio" aria-hidden="true" />
                    <span className="cbody">
                      <span className="clabel">{d.label}</span>
                      <span className="csub" style={{ display: "block" }}>
                        {d.sub}
                      </span>
                    </span>
                    <span className="ckey">{d.key}</span>
                  </button>

                  {selected && d.reveals === "jd" && (
                    <div className="reveal-field fade-in">
                      <label>Paste the job description</label>
                      <textarea
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                        placeholder="Paste the full JD here — title, responsibilities, requirements, comp if listed."
                      />
                      <div className="field-meta">
                        <span>Title, requirements + comp range work best</span>
                        <span className="tnum">{jd.length} chars</span>
                      </div>
                    </div>
                  )}
                  {selected && d.reveals === "salary" && (
                    <div className="reveal-field fade-in">
                      <label>Offer details</label>
                      <textarea
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        placeholder="Title · base · equity · location · level. Anything they told you about band."
                      />
                    </div>
                  )}
                  {selected && d.reveals === "text" && (
                    <div className="reveal-field compact fade-in">
                      <label>Describe the decision</label>
                      <input
                        type="text"
                        value={other}
                        onChange={(e) => setOther(e.target.value)}
                        placeholder="In a sentence — what are you actually trying to decide?"
                        style={{ minHeight: 0 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "var(--warn-soft)",
              border: "1px solid var(--warn)",
              borderRadius: "var(--r-md)",
              color: "var(--warn)",
              fontFamily: "Geist Mono, monospace",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div className="cta-row">
          <div className="left-note">
            {fileInfo ? "CV ready · " : "Upload a CV · "}
            {decision ? "decision chosen · " : "pick a decision · "}
            {canSubmit ? "ready to read" : "fill both to continue"}
          </div>
          <button className="btn btn-primary" disabled={!canSubmit} onClick={onSubmit}>
            {loading ? (
              <>
                <span className="spinner" style={{ borderTopColor: "var(--bg)" }} />
                Reading CV
              </>
            ) : (
              <>
                Read my CV
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </div>
      </main>
    </>
  );
}
