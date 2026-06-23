export async function queryAI(
  queryText: string,
): Promise<{ response: string; domains: string[]; brandNames: Record<string, string> }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "google/gemini-flash-1.5";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://liveaipulse.com",
      "X-Title": "LiveAIPulse",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful shopping assistant. List exactly 5 online stores, one per line, in this format: Brand Name | domain.com - nothing else on each line.",
        },
        {
          role: "user",
          content: queryText,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const response: string = data.choices?.[0]?.message?.content ?? "";
  const { domains, brandNames } = extractDomainsAndBrands(response);
  return { response, domains, brandNames };
}

function extractDomainsAndBrands(text: string): {
  domains: string[];
  brandNames: Record<string, string>;
} {
  const domains: string[] = [];
  const brandNames: Record<string, string> = {};

  // Parse structured "Brand Name | domain.com" lines first
  const structuredRe = /^([^|\n]+?)\s*\|\s*([\w.-]+\.(?:com|store|shop|co|io|net|org))\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = structuredRe.exec(text)) !== null) {
    const brand = m[1].trim().replace(/^\*+|\*+$/g, "").trim();
    const domain = m[2].toLowerCase().replace(/^www\./, "");
    if (domain.length > 4 && !NOISE.has(domain)) {
      if (!domains.includes(domain)) domains.push(domain);
      if (brand) brandNames[domain] = brand;
    }
  }

  // Fall back: extract bare domains from any remaining text
  const bareRe = /\b(?:www\.)?([a-zA-Z0-9-]{2,}\.(?:com|store|shop|co|io|net|org))\b/g;
  while ((m = bareRe.exec(text)) !== null) {
    const domain = m[1].replace(/^www\./, "").toLowerCase();
    if (domain.length > 4 && !NOISE.has(domain) && !domains.includes(domain)) {
      domains.push(domain);
    }
  }

  return { domains, brandNames };
}

const NOISE = new Set([
  "openrouter.ai",
  "google.com",
  "wikipedia.org",
  "amazon.com",
  "reddit.com",
]);
