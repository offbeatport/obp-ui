import { sendEmail } from "@offbeatport/ops/email";

export async function sendWeeklyDigests(): Promise<void> {
  const { db } = await import("../db/client");
  const { brandMonitors, rankings, categories, domainSnapshots, runs } =
    await import("../db/schema");
  const { eq, desc, and, lt } = await import("drizzle-orm");

  // 1. Fetch all active brand monitors
  const activeMonitors = await db
    .select()
    .from(brandMonitors)
    .where(eq(brandMonitors.status, "active"));

  if (activeMonitors.length === 0) return;

  // 2. Group watchers by domain
  const domainToEmails = new Map<string, string[]>();
  for (const monitor of activeMonitors) {
    const existing = domainToEmails.get(monitor.domain) ?? [];
    if (!existing.includes(monitor.email)) {
      existing.push(monitor.email);
    }
    domainToEmails.set(monitor.domain, existing);
  }

  // 3. Find the two most recent completed run IDs (for trend comparison)
  const recentRuns = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.status, "done"))
    .orderBy(desc(runs.createdAt))
    .limit(2);

  const latestRunId = recentRuns[0]?.id ?? null;
  const previousRunId = recentRuns[1]?.id ?? null;

  // 4. Process each domain
  for (const [domain, watchers] of domainToEmails) {
    try {
      // Current rankings for this domain (joined with categories)
      const currentRankings = await db
        .select({
          categoryId: rankings.categoryId,
          categoryName: categories.name,
          mentionCount: rankings.mentionCount,
        })
        .from(rankings)
        .innerJoin(categories, eq(rankings.categoryId, categories.id))
        .where(eq(rankings.domain, domain))
        .orderBy(desc(rankings.mentionCount));

      if (currentRankings.length === 0) continue;

      // Previous run snapshots for trend comparison
      const prevSnapshots = previousRunId
        ? await db
          .select({
            categoryId: domainSnapshots.categoryId,
            mentionCount: domainSnapshots.mentionCount,
          })
          .from(domainSnapshots)
          .where(
            and(
              eq(domainSnapshots.runId, previousRunId),
              eq(domainSnapshots.domain, domain),
            ),
          )
        : [];

      const prevByCategory = new Map(
        prevSnapshots.map((s) => [s.categoryId, s.mentionCount]),
      );

      // Compute rank position for each category the domain appears in
      type RankedCategory = {
        categoryId: string;
        categoryName: string;
        mentionCount: number;
        rank: number;
        prevMentionCount: number | null;
      };

      const rankedCategories: RankedCategory[] = [];

      for (const row of currentRankings) {
        // Count how many distinct domains have a higher mentionCount in the same category
        const higher = await db
          .select({ mentionCount: rankings.mentionCount })
          .from(rankings)
          .where(eq(rankings.categoryId, row.categoryId));

        const rank =
          higher.filter((r) => r.mentionCount > row.mentionCount).length + 1;

        rankedCategories.push({
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          mentionCount: row.mentionCount,
          rank,
          prevMentionCount: prevByCategory.get(row.categoryId) ?? null,
        });
      }

      // 5. Build and send one email per watcher
      const html = buildDigestHtml(domain, rankedCategories);
      const text = buildDigestText(domain, rankedCategories);

      for (const email of watchers) {
        await sendEmail({
          from: "LiveAIPulse <noreply@liveaipulse.com>",
          to: email,
          subject: `Weekly update: ${domain} on LiveAIPulse`,
          html,
          text,
          replyTo: "noreply@liveaipulse.com",
        });
      }
    } catch (err) {
      console.error(`[digest] Failed to send digest for domain ${domain}:`, err);
    }
  }
}

type RankedCategory = {
  categoryId: string;
  categoryName: string;
  mentionCount: number;
  rank: number;
  prevMentionCount: number | null;
};

function trendLabel(current: number, prev: number | null): string {
  if (prev === null) return "";
  const delta = current - prev;
  if (delta > 0) return ` (+${delta} vs last week)`;
  if (delta < 0) return ` (${delta} vs last week)`;
  return " (no change vs last week)";
}

function buildDigestHtml(domain: string, categories: RankedCategory[]): string {
  const rows = categories
    .map(
      (c) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">${escapeHtml(c.categoryName)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;color:#2563eb;font-size:14px;">#${c.rank}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:14px;">${c.mentionCount}${trendLabel(c.mentionCount, c.prevMentionCount)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e40af;padding:32px 40px;">
            <p style="margin:0 0 4px;color:#93c5fd;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Weekly AI Visibility Report</p>
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">${escapeHtml(domain)}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Here's how <strong style="color:#111827;">${escapeHtml(domain)}</strong> performed in AI-generated responses across all tracked categories this week.</p>

            <!-- Rankings table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Category</th>
                  <th style="padding:10px 16px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Rank</th>
                  <th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Score</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <!-- CTA -->
            <div style="margin-top:32px;text-align:center;">
              <a href="https://liveaipulse.com/store/${encodeURIComponent(domain)}"
                 style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:6px;">
                How to improve your visibility &rarr;
              </a>
            </div>

            <!-- ColdVerdict CTA -->
            <div style="margin-top:24px;padding:20px 24px;border:1px solid #e5e7eb;border-left:3px solid #0057ff;background:#f8faff;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#111827;">Not sure which strategy to prioritize?</p>
              <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.5;">Take your ranking data to ColdVerdict. Multiple AIs will debate which move gives you the highest ROI for your category.</p>
              <a href="https://coldverdict.com?q=${encodeURIComponent(`My Shopify store ${domain} appears in AI shopping recommendations tracked by LiveAIPulse. I want to improve my AI visibility. What is the single highest ROI action I should take first: getting editorial coverage on authoritative review sites, building organic Reddit community presence, or improving my product page content to match how shoppers phrase questions to AI?`)}"
                 style="display:inline-block;font-size:13px;font-weight:600;color:#0057ff;text-decoration:none;">
                Get a verdict from multiple AIs &rarr;
              </a>
              <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">Powered by ColdVerdict &middot; coldverdict.com</p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #e5e7eb;background:#f9fafb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              You're receiving this because you monitor <strong>${escapeHtml(domain)}</strong> on LiveAIPulse.
              To unsubscribe reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildDigestText(domain: string, categories: RankedCategory[]): string {
  const lines = categories.map(
    (c) =>
      `  ${c.categoryName}: Rank #${c.rank}, Score ${c.mentionCount}${trendLabel(c.mentionCount, c.prevMentionCount)}`,
  );

  return [
    `Weekly AI Visibility Report - ${domain}`,
    "=".repeat(50),
    "",
    `Here's how ${domain} performed in AI-generated responses this week:`,
    "",
    ...lines,
    "",
    `How to improve your visibility: https://liveaipulse.com/store/${domain}`,
    "",
    "Not sure which strategy to prioritize?",
    `Get a verdict from multiple AIs at ColdVerdict: https://coldverdict.com`,
    "",
    "---",
    `You're receiving this because you monitor ${domain} on LiveAIPulse. To unsubscribe reply to this email.`,
  ].join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
