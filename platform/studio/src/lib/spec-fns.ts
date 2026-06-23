import { createServerFn } from "@tanstack/react-start";
import type { ProductMessage } from "../db/schema.js";

// Per-product build blueprint, stored as MD files on disk so CLI agents can read
// & resume from them: .specs/product-<id>/SPEC.md
const SPEC_FILE = "SPEC.md";

async function specDir(productId: number): Promise<string> {
  const { resolve } = await import("path");
  return resolve(process.cwd(), ".specs", `product-${productId}`);
}

function starterSpec(product: { name: string; domain: string | null; designDirection: string | null }, opp: any | null): string {
  const ins = opp?.insightsJson ?? null;
  const feats: string[] = ins?.v1_features ?? [];
  const featTable = ins?.feature_table ?? [];
  const lines: string[] = [];
  lines.push(`# ${product.name} — Build Spec`);
  lines.push("");
  lines.push(`- **Domain:** ${product.domain ?? "(not set)"}`);
  if (product.designDirection) lines.push(`- **Design:** ${product.designDirection}`);
  if (opp?.painSummary) { lines.push(""); lines.push(`## Problem`); lines.push(opp.painSummary); }
  if (ins?.buyer_persona) { lines.push(""); lines.push(`## Target user`); lines.push(ins.buyer_persona); }
  lines.push("");
  lines.push(`## V1 Features`);
  if (featTable.length) {
    for (const f of featTable) lines.push(`- **${f.feature}** — ${f.problem ?? ""} (${f.feasibility ?? "?"})`);
  } else if (feats.length) {
    for (const f of feats) lines.push(`- ${f}`);
  } else {
    lines.push(`- (define the core features)`);
  }
  lines.push("");
  lines.push(`## Tech stack`);
  lines.push(`- TanStack Start, React, SQLite + Drizzle, Tailwind`);
  lines.push("");
  lines.push(`## Build roadmap`);
  lines.push(`1. Scaffold from base template (auth, billing, dashboard shell)`);
  lines.push(`2. Build the V1 features above`);
  lines.push(`3. Wire pricing / checkout`);
  lines.push(`4. Deploy`);
  lines.push("");
  return lines.join("\n");
}

async function readSpec(productId: number): Promise<string | null> {
  const { readFile } = await import("fs/promises");
  const { resolve } = await import("path");
  try {
    return await readFile(resolve(await specDir(productId), SPEC_FILE), "utf8");
  } catch {
    return null;
  }
}

async function writeSpec(productId: number, content: string): Promise<void> {
  const { mkdir, writeFile } = await import("fs/promises");
  const { resolve } = await import("path");
  const dir = await specDir(productId);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, SPEC_FILE), content, "utf8");
}

export const getProductSpec = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<{ spec: string }> => {
    let spec = await readSpec(data.productId);
    if (spec == null) {
      // Generate a starter spec from the product + linked opportunity, persist it.
      const { db, products, opportunities } = await import("../db/index.js");
      const { eq } = await import("drizzle-orm");
      const [product] = await db.select().from(products).where(eq(products.id, data.productId));
      let opp: any = null;
      if (product?.opportunityId) {
        const [o] = await db.select().from(opportunities).where(eq(opportunities.id, product.opportunityId));
        opp = o ?? null;
      }
      spec = starterSpec(product ?? { name: "Product", domain: null, designDirection: null }, opp);
      await writeSpec(data.productId, spec);
    }
    return { spec };
  });

export const saveProductSpec = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; spec: string }) => d)
  .handler(async ({ data }): Promise<void> => {
    await writeSpec(data.productId, data.spec);
  });

export const getProductMessages = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<ProductMessage[]> => {
    const { db, productMessages } = await import("../db/index.js");
    const { eq, asc } = await import("drizzle-orm");
    return db.select().from(productMessages).where(eq(productMessages.productId, data.productId)).orderBy(asc(productMessages.createdAt));
  });

/**
 * Send a chat message to the build agent. The agent can answer and/or rewrite
 * the spec. If it returns an updated spec (fenced ```spec block), we persist it.
 * Returns the assistant reply + the (possibly updated) spec.
 */
export const sendProductChat = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; message: string }) => d)
  .handler(async ({ data }): Promise<{ reply: string; spec: string }> => {
    const { db, productMessages } = await import("../db/index.js");
    const { eq, asc } = await import("drizzle-orm");
    const { dispatchAI } = await import("./ai.js");

    const now = new Date();
    await db.insert(productMessages).values({ productId: data.productId, role: "user", content: data.message, createdAt: now });

    const history = await db.select().from(productMessages).where(eq(productMessages.productId, data.productId)).orderBy(asc(productMessages.createdAt));
    const currentSpec = (await readSpec(data.productId)) ?? "";

    const convo = history.slice(-12).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const prompt = `You are a product build planner. You maintain a build spec (markdown) for a product and chat with the founder to refine it.

CURRENT SPEC:
\`\`\`
${currentSpec}
\`\`\`

CONVERSATION:
${convo}

Respond to the founder's latest message. Keep your chat reply concise.
If the message implies a change to the spec, output the COMPLETE updated spec wrapped EXACTLY in a fenced block labeled spec, like:
\`\`\`spec
<full updated markdown spec>
\`\`\`
Only include the spec block if something changed. Put your short chat reply BEFORE the block.`;

    let raw: string;
    try {
      raw = await dispatchAI("build", prompt, false);
    } catch (err: any) {
      raw = `(Agent error: ${err?.message ?? "failed"})`;
    }

    // Extract an updated spec block if present.
    let spec = currentSpec;
    let reply = raw;
    const m = raw.match(/```spec\s*([\s\S]*?)```/);
    if (m) {
      spec = m[1].trim();
      reply = raw.slice(0, m.index).trim() || "Updated the spec.";
      await writeSpec(data.productId, spec);
    }

    await db.insert(productMessages).values({ productId: data.productId, role: "assistant", content: reply, createdAt: new Date() });
    return { reply, spec };
  });
