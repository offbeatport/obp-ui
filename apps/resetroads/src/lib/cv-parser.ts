import type { CvProfile, GapRow } from "../db/schema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const FAST_MODEL = "google/gemini-flash-1.5";

async function callOpenRouter(model: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://resetroads.com",
      "X-Title": "ResetRoads",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function extractProfile(cvText: string): Promise<CvProfile> {
  const prompt = `Extract structured information from this CV text. Return ONLY a valid JSON object matching this exact shape — no markdown, no commentary:

{
  "name": "Full Name",
  "currentTitle": "Most recent job title",
  "lastCompany": "Most recent employer",
  "location": "City, State/Country",
  "yoe": 0,
  "titles": [
    { "role": "Job Title", "co": "Company Name", "yrs": "YYYY — YYYY" }
  ],
  "skills": ["skill1", "skill2"],
  "industries": ["Industry 1", "Industry 2"],
  "education": [
    { "degree": "Degree Name", "school": "School Name", "yr": "YYYY" }
  ],
  "languages": ["English (native)"]
}

Rules:
- yoe: integer, years of professional experience total
- titles: chronological, most recent first, max 5
- skills: extract only what is explicitly stated on the CV, max 12
- industries: infer from companies/roles, max 4
- If a field cannot be determined from the CV, use an empty string or empty array
- Do NOT invent or hallucinate anything not present in the CV

CV TEXT:
${cvText.slice(0, 8000)}`;

  const raw = await callOpenRouter(FAST_MODEL, [{ role: "user", content: prompt }]);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse profile JSON from CV");

  return JSON.parse(jsonMatch[0]) as CvProfile;
}

export async function analyzeGap(cvText: string, jdText: string): Promise<{ rows: GapRow[]; jdTitle: string }> {
  const prompt = `Compare this CV against this job description. Return ONLY a valid JSON object — no markdown, no commentary.

Shape:
{
  "jdTitle": "Job title from JD",
  "rows": [
    {
      "jd": "Requirement from JD (concise, 1 sentence)",
      "cv": "What the CV shows for this requirement (factual, 1 sentence)",
      "status": "ok" | "partial" | "missing"
    }
  ]
}

Rules:
- Extract 5-8 of the most important requirements from the JD
- status "ok": clearly evidenced in CV
- status "partial": partially evidenced or unclear from CV
- status "missing": not present in CV at all
- Be factual. Do not invent CV content. Do not invent JD requirements.
- cv field: quote or paraphrase what the CV actually says, or "Not found in CV"

CV:
${cvText.slice(0, 4000)}

JOB DESCRIPTION:
${jdText.slice(0, 4000)}`;

  const raw = await callOpenRouter(FAST_MODEL, [{ role: "user", content: prompt }]);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse gap analysis JSON");

  const parsed = JSON.parse(jsonMatch[0]) as { jdTitle: string; rows: GapRow[] };
  return { rows: parsed.rows, jdTitle: parsed.jdTitle };
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf" || mimeType === "application/octet-stream") {
    const pdfParse = await import("pdf-parse");
    const result = await pdfParse.default(buffer);
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}
