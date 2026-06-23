/**
 * Core normalizer - maps any marketing platform CSV to a canonical schema
 * using LLM semantic understanding, not string matching.
 *
 * Canonical columns: date, platform, campaign, adset, ad, spend, impressions,
 * clicks, cpc, ctr, conversions, roas
 */

export const CANONICAL_COLUMNS = [
  "date",
  "platform",
  "campaign",
  "adset",
  "ad",
  "spend",
  "impressions",
  "clicks",
  "cpc",
  "ctr",
  "conversions",
  "roas",
] as const;

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number];

export interface CanonicalRow {
  date: string;
  platform: string;
  campaign: string;
  adset: string;
  ad: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  cpc: number | null;
  ctr: number | null;
  conversions: number | null;
  roas: number | null;
}

export interface NormalizeInput {
  files: Array<{ name: string; content: string }>;
}

export interface NormalizeResult {
  rows: CanonicalRow[];
  platformsDetected: string[];
  columnMappings: Record<string, Record<string, CanonicalColumn | null>>;
  columnFingerprints: Record<string, string>;
  warnings: string[];
  schemaChanges: SchemaChange[];
}

export interface SchemaChange {
  platform: string;
  message: string;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

export function parseCSV(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = splitLine(lines[0]!);
  const rows = lines.slice(1).filter((l) => l.trim()).map(splitLine);
  return { headers, rows };
}

// ─── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(fileName: string, headers: string[]): string {
  const name = fileName.toLowerCase();
  const hdrs = headers.map((h) => h.toLowerCase()).join(" ");

  if (name.includes("google_ads") || name.includes("googleads") || (hdrs.includes("campaign id") && hdrs.includes("cost"))) return "Google Ads";
  if (name.includes("meta") || name.includes("facebook") || hdrs.includes("amount spent") || hdrs.includes("reach")) return "Meta Ads";
  if (name.includes("tiktok") || (hdrs.includes("total cost") && hdrs.includes("video views"))) return "TikTok Ads";
  if (name.includes("linkedin") || hdrs.includes("sponsored") || hdrs.includes("engagement rate")) return "LinkedIn Ads";
  if (name.includes("twitter") || name.includes("x_ads") || hdrs.includes("billed charge")) return "X Ads";
  if (name.includes("snapchat") || hdrs.includes("swipes")) return "Snapchat Ads";
  if (name.includes("pinterest") || hdrs.includes("pin clicks")) return "Pinterest Ads";
  if (name.includes("ga4") || name.includes("analytics") || (hdrs.includes("sessions") && hdrs.includes("bounce rate"))) return "GA4";
  return "Unknown";
}

// ─── Column fingerprint (schema change detection) ─────────────────────────────

export function fingerprint(headers: string[]): string {
  // Simple deterministic hash: sorted headers joined - good enough for change detection
  return headers
    .map((h) => h.toLowerCase().trim())
    .sort()
    .join("|");
}

// ─── Summary row detection ────────────────────────────────────────────────────

const SUMMARY_PATTERNS = /^(total|grand total|totals|summary|all campaigns|report total|subtotal|all|aggregate)$/i;

export function isSummaryRow(row: string[], headers: string[]): boolean {
  // Check if first meaningful text cell matches summary pattern
  for (let i = 0; i < Math.min(headers.length, 5); i++) {
    const val = (row[i] ?? "").trim();
    if (val && SUMMARY_PATTERNS.test(val)) return true;
  }
  // Check if all cells with a date-like header are empty/total
  const dateIdx = headers.findIndex((h) => /date|day|week|month/i.test(h));
  if (dateIdx !== -1) {
    const dateVal = (row[dateIdx] ?? "").trim();
    if (SUMMARY_PATTERNS.test(dateVal)) return true;
    // Empty date with numeric data = likely a platform-injected total row
    if (!dateVal) {
      const numericCount = row.filter((v) => /^\d[\d,.]+$/.test(v.trim())).length;
      if (numericCount > 3) return true;
    }
  }
  return false;
}

// ─── Date normalization ───────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09", sept: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

export function normalizeDate(raw: string): string {
  if (!raw || raw === "-" || raw === "--") return "";
  const v = raw.trim();

  // Already ISO: 2024-05-01
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // ISO with time: 2024-05-01T00:00:00
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);

  // Compact: 20240501
  if (/^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }

  // Slash-separated: 05/01/2024 or 2024/05/01
  const slashMatch = v.match(/^(\d{1,4})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, a, b, c] = slashMatch;
    if (a!.length === 4) return `${a}-${b!.padStart(2, "0")}-${c!.padStart(2, "0")}`;
    // Assume MM/DD/YYYY (US)
    return `${c!.length === 2 ? `20${c}` : c}-${a!.padStart(2, "0")}-${b!.padStart(2, "0")}`;
  }

  // Dash-separated: 05-01-2024
  const dashMatch = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  // "May 1, 2024" or "May 1 2024" or "1 May 2024"
  const monthNameMatch = v.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i)
    ?? v.match(/^(\d{1,2})\s+([a-z]+),?\s+(\d{4})$/i);
  if (monthNameMatch) {
    const parts = monthNameMatch.slice(1);
    let month: string | undefined;
    let day: string | undefined;
    let year: string | undefined;
    if (/^[a-z]+$/i.test(parts[0]!)) {
      month = MONTH_NAMES[parts[0]!.toLowerCase()];
      day = parts[1];
      year = parts[2];
    } else {
      day = parts[0];
      month = MONTH_NAMES[parts[1]!.toLowerCase()];
      year = parts[2];
    }
    if (month && day && year) {
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  // Week ranges: "2024-04-29 - 2024-05-05" - take start date
  const rangeMatch = v.match(/^(\d{4}-\d{2}-\d{2})\s*[-to]+\s*\d{4}-\d{2}-\d{2}$/i);
  if (rangeMatch) return rangeMatch[1]!;

  return v; // return as-is if unrecognised
}

// ─── Currency / number parsing ────────────────────────────────────────────────

export function parseCurrency(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-" || raw.trim() === "--" || raw.trim() === "N/A" || raw.trim() === "n/a") return null;

  let v = raw.trim();

  // Strip currency symbols and codes
  v = v.replace(/^[$€£¥₹]\s*/, "").replace(/\s*(USD|EUR|GBP|CAD|AUD|JPY)$/i, "");

  // European format: 1.234,56 - needs at least one period group to distinguish from US "1,234"
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    // Standard US/UK: 1,234.56 - comma as thousands sep
    v = v.replace(/,/g, "").replace(/%/g, "");
  }

  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

export function parsePercent(raw: string): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-" || raw.trim() === "--") return null;
  const stripped = raw.trim().replace(/[,$]/g, "");
  if (stripped.endsWith("%")) {
    const n = parseFloat(stripped.replace(/%/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  const raw2 = parseCurrency(stripped);
  if (raw2 === null) return null;
  // Platforms encode CTR as 0.0123 or 1.23 - normalise to percentage points
  return raw2 > 1 ? raw2 : raw2 * 100;
}

// ─── LLM mapping ─────────────────────────────────────────────────────────────

export function buildMappingPrompt(platform: string, headers: string[]): string {
  return `You are a marketing data normalization assistant. Map the following CSV column headers from a ${platform} export to the canonical marketing schema.

Canonical columns: ${CANONICAL_COLUMNS.join(", ")}

Source headers: ${JSON.stringify(headers)}

Rules:
- Return ONLY a JSON object. No prose. No markdown fences.
- Keys are the source header names exactly as given.
- Values are the matching canonical column name, or null if no match.
- "Amount Spent", "Cost", "Total Spend", "Spend (USD)", "Total Cost", "Billed Charge (USD)" → "spend".
- "Reach" → null (different from impressions).
- "Ad Name", "Ad Title", "Creative Name", "Pin Title" → "ad".
- "Ad Set Name", "Ad Group", "Ad Group Name", "Ad Squad Name" → "adset".
- "Campaign Name" → "campaign".
- "CTR (All)", "Click-Through Rate (%)", "CTR", "Swipe-Up Rate (%)" → "ctr".
- "CPC (All)", "Cost Per Click", "CPC", "Average CPC", "eCPC" → "cpc".
- "Purchase ROAS", "ROAS", "Return on Ad Spend" → "roas".
- "Purchases", "Conversions", "Link Clicks" counted as conversions only if no better match.
- "Day", "Date Start", "Start Date" → "date".
- Multiple source headers mapping to the same canonical column: first match wins.

Example: {"Campaign Name": "campaign", "Amount Spent": "spend", "Reach": null}`;
}

export function parseMappingResponse(response: string, headers: string[]): Record<string, CanonicalColumn | null> {
  try {
    const cleaned = response.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as Record<string, string | null>;

    // Build a case-insensitive lookup so LLM casing drift doesn't silently drop mappings
    const normalizedParsed: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(parsed)) {
      normalizedParsed[k.toLowerCase().trim()] = v;
    }

    const result: Record<string, CanonicalColumn | null> = {};
    for (const header of headers) {
      // Exact match first, then case-insensitive fallback
      const val = parsed[header] ?? normalizedParsed[header.toLowerCase().trim()];
      result[header] = val && (CANONICAL_COLUMNS as readonly string[]).includes(val)
        ? (val as CanonicalColumn)
        : null;
    }
    return result;
  } catch {
    return Object.fromEntries(headers.map((h) => [h, null]));
  }
}

// ─── Apply mapping ────────────────────────────────────────────────────────────

export function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: Record<string, CanonicalColumn | null>,
  platform: string,
): CanonicalRow[] {
  const colIndex: Partial<Record<CanonicalColumn, number>> = {};
  for (const [src, canon] of Object.entries(mapping)) {
    if (canon && !(canon in colIndex)) {
      const idx = headers.indexOf(src);
      if (idx !== -1) colIndex[canon] = idx;
    }
  }

  function get(row: string[], col: CanonicalColumn): string {
    const idx = colIndex[col];
    return idx !== undefined ? (row[idx] ?? "") : "";
  }

  const filteredRows = rows.filter((row) => !isSummaryRow(row, headers));

  return filteredRows.map((row) => {
    const spend = parseCurrency(get(row, "spend"));
    const impressions = parseCurrency(get(row, "impressions"));
    const clicks = parseCurrency(get(row, "clicks"));
    const conversions = parseCurrency(get(row, "conversions"));
    const roas = parseCurrency(get(row, "roas"));

    // Parse CTR/CPC from source, then recalculate from raw numbers if missing
    let ctr = parsePercent(get(row, "ctr"));
    let cpc = parseCurrency(get(row, "cpc"));

    // Recalculate derived metrics from raw numbers for consistency
    if (ctr === null && clicks !== null && impressions !== null && impressions > 0) {
      ctr = (clicks / impressions) * 100;
    }
    if (cpc === null && spend !== null && clicks !== null && clicks > 0) {
      cpc = spend / clicks;
    }

    return {
      date: normalizeDate(get(row, "date")),
      platform: get(row, "platform") || platform,
      campaign: get(row, "campaign") || "",
      adset: get(row, "adset") || "",
      ad: get(row, "ad") || "",
      spend,
      impressions,
      clicks,
      cpc: cpc !== null ? Math.round(cpc * 100) / 100 : null,
      ctr: ctr !== null ? Math.round(ctr * 100) / 100 : null,
      conversions,
      roas,
    };
  });
}

// ─── Heuristic fallback ───────────────────────────────────────────────────────

export function heuristicMapping(headers: string[]): Record<string, CanonicalColumn | null> {
  const PATTERNS: Array<[RegExp, CanonicalColumn]> = [
    [/^(date|day|date start|start date|reporting starts)$/i, "date"],
    [/\bdate\b/i, "date"],
    [/campaign.?name/i, "campaign"],
    [/^campaign$/i, "campaign"],
    [/ad.?set.?name|ad.?group.?name|ad.?squad.?name/i, "adset"],
    [/ad.?name|creative.?name|pin.?title/i, "ad"],
    [/^spend$|amount.?spent|total.?(cost|spend)|^cost$|billed.?charge/i, "spend"],
    [/impressions/i, "impressions"],
    [/^clicks$|link.?clicks/i, "clicks"],
    [/^cpc|cost.?per.?click|average.?cpc|avg.?.?cpc|ecpc/i, "cpc"],
    [/^ctr|click.?through.?rate|swipe.?up.?rate/i, "ctr"],
    [/^conversions$|^purchases$/i, "conversions"],
    [/^roas|purchase.?roas|return.?on.?ad/i, "roas"],
  ];

  const result: Record<string, CanonicalColumn | null> = {};
  for (const header of headers) {
    let matched: CanonicalColumn | null = null;
    for (const [re, canon] of PATTERNS) {
      if (re.test(header)) { matched = canon; break; }
    }
    result[header] = matched;
  }
  return result;
}

// ─── CSV serialiser ───────────────────────────────────────────────────────────

export function rowsToCSV(rows: CanonicalRow[]): string {
  function escapeField(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Must quote if contains comma, double-quote, or newline; escape inner quotes by doubling
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  const headers = CANONICAL_COLUMNS.join(",");
  const body = rows
    .map((r) => CANONICAL_COLUMNS.map((c) => escapeField(r[c])).join(","))
    .join("\n");
  return `${headers}\n${body}`;
}
