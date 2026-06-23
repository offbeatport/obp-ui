import type { CvProfile, Debate, DebateRound, Stance } from "../db/schema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FAST_MODELS = [
  { id: "google/gemini-flash-1.5", label: "Model A", role: "The cautious analyst" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Model B", role: "The contrarian" },
  { id: "mistralai/mistral-7b-instruct", label: "Model C", role: "The pragmatist" },
];

const TOP_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Model A", role: "The cautious analyst" },
  { id: "openai/gpt-4o", label: "Model B", role: "The contrarian" },
  { id: "google/gemini-pro-1.5", label: "Model C", role: "The pragmatist" },
];

async function callModel(modelId: string, prompt: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://resetroads.com",
      "X-Title": "ResetRoads",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${modelId} error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildContext(profile: CvProfile, decisionType: string, decisionDetail: string | null): string {
  const titles = profile.titles.slice(0, 3).map((t) => `${t.role} at ${t.co} (${t.yrs})`).join("; ");
  const skills = profile.skills.slice(0, 8).join(", ");

  const decisionMap: Record<string, string> = {
    offer: "whether to take a job offer",
    freelance: "whether to go freelance vs. take a full-time role",
    pivot: "whether to stay in tech or pivot to another field",
    salary: "whether a salary/compensation offer is fair",
    other: "a career decision",
  };

  return `
Candidate: ${profile.name || "the candidate"}
Most recent role: ${profile.currentTitle} at ${profile.lastCompany}
Years of experience: ${profile.yoe}
Career history: ${titles}
Key skills: ${skills}
Industries: ${profile.industries.join(", ")}
${decisionDetail ? `\nAdditional context: ${decisionDetail.slice(0, 1000)}` : ""}

The candidate is deciding: ${decisionMap[decisionType] || "a career decision"}`.trim();
}

async function getInitialStance(
  model: { id: string; label: string; role: string },
  context: string,
  question: string
): Promise<Stance> {
  const prompt = `You are ${model.role} in a panel debate about a career decision. Be direct, honest, and specific. Do NOT be agreeable for its own sake.

CONTEXT:
${context}

QUESTION: ${question}

Respond in this exact JSON format (no markdown):
{
  "lean": "take" | "pass" | "neg",
  "leanLabel": "Lean take" | "Lean pass" | "Negotiate",
  "body": "Your main argument in 2-4 sentences. Be specific to this person's situation.",
  "kicker": "WHAT I WOULD DO",
  "tail": "Your concrete recommendation in 1-2 sentences."
}

lean values: "take" = recommend taking/doing it, "pass" = recommend against, "neg" = negotiate/conditions apply`;

  const raw = await callModel(model.id, prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON from ${model.label}`);

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    who: model.label,
    what: model.role,
    lean: parsed.lean,
    leanLabel: parsed.leanLabel,
    body: parsed.body,
    kicker: parsed.kicker,
    tail: parsed.tail,
  };
}

async function getPushback(
  model: { id: string; label: string; role: string },
  context: string,
  question: string,
  round1Stances: Stance[]
): Promise<Stance> {
  const othersText = round1Stances
    .filter((s) => s.who !== model.label)
    .map((s) => `${s.who} (${s.leanLabel}): ${s.body}`)
    .join("\n\n");

  const prompt = `You are ${model.role} in Round 2 of a panel debate. You've heard the other models' arguments. Now push back, agree selectively, or reframe — but be specific and direct.

CONTEXT:
${context}

QUESTION: ${question}

OTHER MODELS' ROUND 1 ARGUMENTS:
${othersText}

Respond in this exact JSON format (no markdown):
{
  "lean": "take" | "pass" | "neg",
  "leanLabel": "Agrees" | "Disagrees" | "Reframes" | "Lean take" | "Lean pass" | "Negotiate",
  "body": "Your pushback or agreement in 2-3 sentences. Be specific — reference what the others said.",
  "what": "What you're responding to (e.g., 'On the ramp-up concern')"
}`;

  const raw = await callModel(model.id, prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON from ${model.label} round 2`);

  const parsed = JSON.parse(jsonMatch[0]);

  const targetModels = round1Stances.filter((s) => s.who !== model.label);
  const targetLabel = targetModels.map((s) => s.who).join(" → ");

  return {
    who: `${model.label} → ${targetLabel}`,
    what: parsed.what || model.role,
    lean: parsed.lean,
    leanLabel: parsed.leanLabel,
    body: parsed.body,
  };
}

async function getVerdict(
  context: string,
  question: string,
  rounds: DebateRound[],
  modelId: string
): Promise<{ line: string; body: string; confidence: string }> {
  const summary = rounds
    .flatMap((r) => r.stances)
    .map((s) => `${s.who} (${s.leanLabel}): ${s.body}`)
    .join("\n\n");

  const prompt = `Synthesize this panel debate into a final verdict. Be honest — if there is genuine disagreement, say so. Do not fabricate consensus.

CONTEXT:
${context}

QUESTION: ${question}

DEBATE SUMMARY:
${summary}

Respond in this exact JSON format (no markdown):
{
  "line": "One-sentence verdict headline (direct, specific, no hedging)",
  "body": "2-3 sentence synthesis. What do the models agree on? What remains contested? What should the candidate actually do?",
  "confidence": "Confidence level, e.g. 'Moderate agreement · 2 of 3 lean take with conditions'"
}`;

  const raw = await callModel(modelId, prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON from verdict model");

  return JSON.parse(jsonMatch[0]);
}

export async function runFastDebate(
  profile: CvProfile,
  decisionType: string,
  decisionDetail: string | null
): Promise<Debate> {
  const start = Date.now();
  const context = buildContext(profile, decisionType, decisionDetail);

  const decisionLabel =
    decisionType === "offer"
      ? `Should ${profile.name || "this candidate"} take the job offer?`
      : decisionType === "freelance"
        ? `Should ${profile.name || "this candidate"} go freelance or take a full-time role?`
        : decisionType === "pivot"
          ? `Should ${profile.name || "this candidate"} stay in tech or pivot?`
          : decisionType === "salary"
            ? `Is the salary offer fair for ${profile.name || "this candidate"}?`
            : decisionDetail || "What should this candidate do next?";

  const [stanceA, stanceB, stanceC] = await Promise.all(
    FAST_MODELS.map((m) => getInitialStance(m, context, decisionLabel))
  );

  const round1Stances = [stanceA, stanceB, stanceC];

  const [pushA, pushB, pushC] = await Promise.all(
    FAST_MODELS.map((m) => getPushback(m, context, decisionLabel, round1Stances))
  );

  const rounds: DebateRound[] = [
    { n: "Round 1", title: "Initial stances", stances: round1Stances },
    { n: "Round 2", title: "Pushback", stances: [pushA, pushB, pushC] },
  ];

  const verdict = await getVerdict(context, decisionLabel, rounds, FAST_MODELS[0].id);

  const elapsed = ((Date.now() - start) / 1000).toFixed(0) + "s";

  return {
    question: decisionLabel,
    context: `${decisionType} · ${profile.yoe} yrs exp · ${profile.lastCompany}`,
    modelsUsed: "Three efficient models",
    runTime: elapsed,
    rounds,
    verdict,
  };
}

export async function runTopDebate(
  profile: CvProfile,
  decisionType: string,
  decisionDetail: string | null
): Promise<Debate> {
  const start = Date.now();
  const context = buildContext(profile, decisionType, decisionDetail);

  const decisionLabel =
    decisionType === "offer"
      ? `Should ${profile.name || "this candidate"} take the job offer?`
      : decisionType === "freelance"
        ? `Should ${profile.name || "this candidate"} go freelance or take a full-time role?`
        : decisionType === "pivot"
          ? `Should ${profile.name || "this candidate"} stay in tech or pivot?`
          : decisionType === "salary"
            ? `Is the salary offer fair for ${profile.name || "this candidate"}?`
            : decisionDetail || "What should this candidate do next?";

  const [stanceA, stanceB, stanceC] = await Promise.all(
    TOP_MODELS.map((m) => getInitialStance(m, context, decisionLabel))
  );

  const round1Stances = [stanceA, stanceB, stanceC];

  const [pushA, pushB, pushC] = await Promise.all(
    TOP_MODELS.map((m) => getPushback(m, context, decisionLabel, round1Stances))
  );

  const rounds: DebateRound[] = [
    { n: "Round 1", title: "Initial stances", stances: round1Stances },
    { n: "Round 2", title: "Pushback", stances: [pushA, pushB, pushC] },
  ];

  const verdict = await getVerdict(context, decisionLabel, rounds, TOP_MODELS[0].id);

  const elapsed = ((Date.now() - start) / 1000).toFixed(0) + "s";

  return {
    question: decisionLabel,
    context: `${decisionType} · ${profile.yoe} yrs exp · ${profile.lastCompany}`,
    modelsUsed: "Three frontier models",
    runTime: elapsed,
    rounds,
    verdict,
  };
}
