import { createServerFn } from "@tanstack/react-start";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPublicIp(): Promise<string> {
  const r = await fetch("https://api.ipify.org?format=json");
  const d = await r.json() as { ip: string };
  return d.ip;
}

async function getProfile() {
  const { db, founderProfile } = await import("../db/index.js");
  const [p] = await db.select().from(founderProfile).limit(1);
  return p ?? null;
}

function buildNamecheapUrl(command: string, params: Record<string, string>, apiUser: string, apiKey: string, clientIp: string): string {
  const base = "https://api.namecheap.com/xml.response";
  const p = new URLSearchParams({ ApiUser: apiUser, ApiKey: apiKey, UserName: apiUser, Command: command, ClientIp: clientIp, ...params });
  return `${base}?${p}`;
}

function parseXmlAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function parseXmlText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseXmlSuccess(xml: string): boolean {
  return xml.includes('Status="OK"') || xml.includes("CommandResponse");
}

// ── Test Namecheap connection ─────────────────────────────────────────────────

export const testNamecheapConnection = createServerFn({ method: "GET" })
  .inputValidator((d: { apiUser: string; apiKey: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const ip = await getPublicIp();
      const url = buildNamecheapUrl("namecheap.users.getBalances", {}, data.apiUser, data.apiKey, ip);
      const res = await fetch(url);
      const xml = await res.text();
      if (xml.includes("ErrCount>0") || xml.includes('Status="ERROR"')) {
        const errText = parseXmlText(xml, "Error") ?? parseXmlText(xml, "Errors");
        return { ok: false, error: errText ?? "Authentication failed - check API user and key." };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Request failed" };
    }
  });

// ── Test Cloudflare connection ────────────────────────────────────────────────

export const testCloudflareConnection = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; status?: string; error?: string }> => {
    const url = "https://api.cloudflare.com/client/v4/user/tokens/verify";
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
      });
      const raw = await res.text();
      console.log(`[CF verify] status=${res.status} body=${raw.slice(0, 500)}`);
      let json: any;
      try { json = JSON.parse(raw); } catch { return { ok: false, error: `HTTP ${res.status} - non-JSON response: ${raw.slice(0, 200)}` }; }
      if (json.success) {
        return { ok: true, status: json.result?.status ?? "active" };
      }
      return { ok: false, error: `HTTP ${res.status}: ${json.errors?.[0]?.message ?? raw.slice(0, 200)}` };
    } catch (e: any) {
      console.error(`[CF verify] fetch failed:`, e);
      return { ok: false, error: `Fetch to ${url} failed: ${e?.message ?? "unknown"}` };
    }
  });

// ── AI domain name generation ─────────────────────────────────────────────────

export const generateDomainNames = createServerFn({ method: "POST" })
  .inputValidator((d: { opportunityTitle: string; painSummary: string; buyerPersona?: string; exclude?: string[] }) => d)
  .handler(async ({ data }): Promise<{ names: string[]; error?: string }> => {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
      });
      const excludeSection = data.exclude && data.exclude.length > 0
        ? `\nDo NOT suggest any of these already-seen names: ${data.exclude.join(", ")}\n`
        : "";
      const res = await client.chat.completions.create({
        model: "google/gemini-3.1-flash-lite-preview",
        max_tokens: 800,
        temperature: 1.0,
        messages: [{
          role: "user",
          content: `Generate 100 short, catchy .com domain name candidates for a SaaS product:

Product: ${data.opportunityTitle}
Problem: ${data.painSummary}
Target user: ${data.buyerPersona ?? "small businesses and solopreneurs"}
${excludeSection}
Rules:
- Single word or two short words combined (no hyphens, no underscores)
- Memorable, easy to spell, professional
- NOT generic (avoid "app", "io", "hq", "hub" unless very memorable)
- Max 14 characters
- Mix of: compound words, portmanteaus, metaphors, made-up words
- Return ONLY the domain names without .com, one per line, no numbering, no explanation`,
        }],
      });
      const text = res.choices[0].message.content ?? "";
      const excludeSet = new Set(data.exclude ?? []);
      const names = text
        .split("\n")
        .map((l) => l.trim().toLowerCase().replace(/\.com$/i, "").replace(/[^a-z0-9]/g, ""))
        .filter((l) => l.length >= 4 && l.length <= 14 && !excludeSet.has(l))
        .slice(0, 100);
      return { names };
    } catch (e: any) {
      return { names: [], error: e?.message ?? "Generation failed" };
    }
  });

// ── Batch domain availability check (Namecheap) ───────────────────────────────

export const batchCheckDomains = createServerFn({ method: "POST" })
  .inputValidator((d: { names: string[] }) => d)
  .handler(async ({ data }): Promise<{ results: { name: string; available: boolean; price: number | null }[]; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.namecheapUser || !profile?.namecheapKey) {
      return { results: [], error: "Namecheap credentials not configured in Settings → Domain Registrar." };
    }
    try {
      const ip = await getPublicIp();
      const results: { name: string; available: boolean; price: number | null }[] = [];

      // Namecheap allows up to 50 domains per check call
      const chunks: string[][] = [];
      for (let i = 0; i < data.names.length; i += 50) {
        chunks.push(data.names.slice(i, i + 50));
      }

      for (const chunk of chunks) {
        const domainList = chunk.map((n) => `${n}.com`).join(",");
        const url = buildNamecheapUrl("namecheap.domains.check", { DomainList: domainList }, profile.namecheapUser!, profile.namecheapKey!, ip);
        const res = await fetch(url);
        const xml = await res.text();

        // Parse all DomainCheckResult entries from the XML
        const re = /<DomainCheckResult[^>]*Domain="([^"]+)"[^>]*Available="([^"]+)"[^>]*IsPremiumName="([^"]*)"[^>]*PremiumRegistrationPrice="([^"]*)"/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml)) !== null) {
          const rawName = m[1].replace(/\.com$/i, "");
          const available = m[2].toLowerCase() === "true";
          const isPremium = m[3].toLowerCase() === "true";
          const priceRaw = parseFloat(m[4]) || 0;
          // Filter: skip premium/expensive (>$20/yr)
          if (isPremium || priceRaw > 20) continue;
          results.push({ name: rawName, available, price: priceRaw > 0 ? priceRaw : null });
        }
      }

      return { results };
    } catch (e: any) {
      return { results: [], error: e?.message ?? "Batch check failed" };
    }
  });

// ── Domain check (Namecheap) ─────────────────────────────────────────────────

export const checkDomainAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { domain: string }) => d)
  .handler(async ({ data }): Promise<{ available: boolean; price: number | null; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.namecheapUser || !profile?.namecheapKey) {
      return { available: false, price: null, error: "Namecheap credentials not configured in Settings → Domain Registrar." };
    }
    try {
      const ip = await getPublicIp();
      const url = buildNamecheapUrl("namecheap.domains.check", { DomainList: data.domain }, profile.namecheapUser, profile.namecheapKey, ip);
      const res = await fetch(url);
      const xml = await res.text();
      const available = parseXmlAttr(xml, "DomainCheckResult", "Available") === "true";
      const priceText = parseXmlAttr(xml, "DomainCheckResult", "PremiumRegistrationPrice");
      const price = priceText ? parseFloat(priceText) : null;
      if (xml.includes("ErrCount>0")) {
        const errText = parseXmlText(xml, "Error");
        return { available: false, price: null, error: errText ?? "Namecheap API error" };
      }
      return { available, price };
    } catch (e: any) {
      return { available: false, price: null, error: e.message };
    }
  });

// ── Set Namecheap NS to Cloudflare servers ───────────────────────────────────

export const setNamecheapNS = createServerFn({ method: "POST" })
  .inputValidator((d: { domain: string; nsServers: string[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.namecheapUser || !profile?.namecheapKey) {
      return { ok: false, error: "Namecheap credentials not configured." };
    }
    try {
      const ip = await getPublicIp();
      const parts = data.domain.split(".");
      const tld = parts.slice(-1)[0];
      const sld = parts.slice(0, -1).join(".");
      const url = buildNamecheapUrl("namecheap.domains.dns.setCustom", {
        SLD: sld, TLD: tld,
        Nameservers: data.nsServers.join(","),
      }, profile.namecheapUser, profile.namecheapKey, ip);
      const res = await fetch(url);
      const xml = await res.text();
      if (xml.includes("ErrCount>0")) {
        const errText = parseXmlText(xml, "Error");
        return { ok: false, error: errText ?? "Namecheap API error" };
      }
      return { ok: parseXmlSuccess(xml) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

// ── Cloudflare: add zone ──────────────────────────────────────────────────────

export const addCloudflareZone = createServerFn({ method: "POST" })
  .inputValidator((d: { domain: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; zoneId?: string; nsServers?: string[]; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.cloudflareToken || !profile?.cloudflareAccountId) {
      return { ok: false, error: "Cloudflare credentials not configured in Settings → DNS." };
    }
    const headers = { Authorization: `Bearer ${profile.cloudflareToken}`, "Content-Type": "application/json" };
    try {
      // Check if zone already exists
      const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(data.domain)}`, { headers });
      const listData = await listRes.json() as any;
      if (listData.success && listData.result?.length > 0) {
        const zone = listData.result[0];
        return { ok: true, zoneId: zone.id, nsServers: zone.name_servers };
      }
      // Create new zone
      const createRes = await fetch("https://api.cloudflare.com/client/v4/zones", {
        method: "POST", headers,
        body: JSON.stringify({ name: data.domain, account: { id: profile.cloudflareAccountId }, jump_start: false }),
      });
      const createData = await createRes.json() as any;
      if (!createData.success) {
        const msg = createData.errors?.[0]?.message ?? "Zone creation failed";
        return { ok: false, error: msg };
      }
      return { ok: true, zoneId: createData.result.id, nsServers: createData.result.name_servers };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

// ── Cloudflare: set SSL mode ──────────────────────────────────────────────────

export const setCloudflareSSL = createServerFn({ method: "POST" })
  .inputValidator((d: { zoneId: string; mode: "full_strict" | "full" | "flexible" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.cloudflareToken) return { ok: false, error: "Cloudflare token not configured." };
    const headers = { Authorization: `Bearer ${profile.cloudflareToken}`, "Content-Type": "application/json" };
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${data.zoneId}/settings/ssl`, {
        method: "PATCH", headers,
        body: JSON.stringify({ value: data.mode }),
      });
      const d2 = await res.json() as any;
      return { ok: d2.success, error: d2.errors?.[0]?.message };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

// ── Cloudflare: create DNS A record ──────────────────────────────────────────

export const createCloudflareARecord = createServerFn({ method: "POST" })
  .inputValidator((d: { zoneId: string; domain: string; ip: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const profile = await getProfile();
    if (!profile?.cloudflareToken) return { ok: false, error: "Cloudflare token not configured." };
    const headers = { Authorization: `Bearer ${profile.cloudflareToken}`, "Content-Type": "application/json" };
    try {
      const records = [
        { type: "A", name: "@", content: data.ip, ttl: 1, proxied: true },
        { type: "A", name: "www", content: data.ip, ttl: 1, proxied: true },
      ];
      for (const record of records) {
        // Check if record already exists
        const listRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${data.zoneId}/dns_records?type=A&name=${record.name === "@" ? data.domain : `www.${data.domain}`}`,
          { headers }
        );
        const listData = await listRes.json() as any;
        if (listData.success && listData.result?.length > 0) {
          // Update existing
          const existing = listData.result[0];
          await fetch(`https://api.cloudflare.com/client/v4/zones/${data.zoneId}/dns_records/${existing.id}`, {
            method: "PATCH", headers,
            body: JSON.stringify({ content: data.ip, proxied: true }),
          });
        } else {
          // Create new
          const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${data.zoneId}/dns_records`, {
            method: "POST", headers, body: JSON.stringify(record),
          });
          const rd = await res.json() as any;
          if (!rd.success) return { ok: false, error: rd.errors?.[0]?.message ?? "DNS record creation failed" };
        }
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

// ── Save wizard progress to project ──────────────────────────────────────────

export const saveWizardProgress = createServerFn({ method: "POST" })
  .inputValidator((d: {
    projectId: number;
    name?: string;
    domain?: string;
    cloudflareZoneId?: string;
    vpsIp?: string;
    designDirection?: string;
    repoUrl?: string;
    coolifyWebhookUrl?: string;
  }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.domain !== undefined) patch.domain = data.domain;
    if (data.cloudflareZoneId !== undefined) patch.cloudflareZoneId = data.cloudflareZoneId;
    if (data.vpsIp !== undefined) patch.vpsIp = data.vpsIp;
    if (data.designDirection !== undefined) patch.designDirection = data.designDirection;
    if (data.repoUrl !== undefined) patch.repoUrl = data.repoUrl;
    if (data.coolifyWebhookUrl !== undefined) patch.coolifyAppId = data.coolifyWebhookUrl;
    await db.update(projects).set(patch).where(eq(projects.id, data.projectId));
  });
