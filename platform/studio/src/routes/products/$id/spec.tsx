import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useProjectContext } from "~/lib/project-context";
import { getProductSpec, saveProductSpec, getProductMessages, sendProductChat } from "~/lib/spec-fns";
import { Button } from "~/components/ui/Button";
import { Hammer, Send, Save } from "lucide-react";

export const Route = createFileRoute("/products/$id/spec")({
  loader: async ({ params }) => {
    const productId = parseInt(params.id, 10);
    const [{ spec }, messages] = await Promise.all([
      getProductSpec({ data: { productId } }),
      getProductMessages({ data: { productId } }),
    ]);
    return { productId, spec, messages };
  },
  staleTime: 5_000,
  component: SpecPage,
});

type Msg = { role: string; content: string };

function SpecPage() {
  const { productId, spec: initialSpec, messages: initialMessages } = Route.useLoaderData();
  const { product } = useProjectContext();
  const navigate = useNavigate();

  const [spec, setSpec] = useState(initialSpec);
  const [savedSpec, setSavedSpec] = useState(initialSpec);
  const [messages, setMessages] = useState<Msg[]>(initialMessages.map((m) => ({ role: m.role, content: m.content })));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingSpec, setSavingSpec] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const res = await sendProductChat({ data: { productId, message: msg } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      if (res.spec !== spec) { setSpec(res.spec); setSavedSpec(res.spec); }
    } catch (err: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${err?.message ?? "failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function saveSpec() {
    setSavingSpec(true);
    try {
      await saveProductSpec({ data: { productId, spec } });
      setSavedSpec(spec);
    } finally {
      setSavingSpec(false);
    }
  }

  const dirty = spec !== savedSpec;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left — chat */}
      <div style={{ width: "42%", minWidth: 320, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
          Build agent
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
              Chat with the build agent to shape the spec on the right. Ask it to add features, change the stack, refine the roadmap — it edits the spec live. When ready, hit <strong style={{ color: "var(--fg)" }}>Build</strong>.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{
                padding: "9px 12px", borderRadius: 10, fontSize: "0.84rem", lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "rgba(96,165,250,0.12)" : "var(--bg-elevated)",
                border: `1px solid ${m.role === "user" ? "rgba(96,165,250,0.25)" : "var(--border)"}`,
                color: "var(--fg)",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div style={{ alignSelf: "flex-start", fontSize: "0.8rem", color: "var(--fg-subtle)" }}>Agent thinking…</div>}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask the agent to refine the spec…"
            rows={2}
            style={{ flex: 1, resize: "none", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg)", fontFamily: "inherit", fontSize: "0.84rem", outline: "none" }}
          />
          <Button variant="primary" size="sm" onClick={send} disabled={busy || !input.trim()}><Send size={14} /></Button>
        </div>
      </div>

      {/* Right — spec blueprint */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Build spec</span>
          {product?.domain && <span style={{ fontSize: "0.78rem", color: "var(--fg-muted)" }}>· {product.domain}</span>}
          <div style={{ flex: 1 }} />
          <Button variant="outline" size="sm" onClick={saveSpec} disabled={!dirty || savingSpec} style={{ gap: 5 }}>
            <Save size={13} /> {savingSpec ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate({ to: "/products/$id/build", params: { id: String(productId) } })} style={{ gap: 5 }}>
            <Hammer size={13} /> Build
          </Button>
        </div>
        <textarea
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          spellCheck={false}
          style={{ flex: 1, resize: "none", padding: "18px 22px", background: "var(--bg)", border: "none", color: "var(--fg)", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.82rem", lineHeight: 1.6, outline: "none" }}
        />
      </div>
    </div>
  );
}
