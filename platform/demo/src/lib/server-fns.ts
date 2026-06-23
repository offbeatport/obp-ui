import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  checkTieredRateLimit,
  resolveOwnerKey,
  type RateLimitResult,
  type Tier,
} from "@offbeatport/microsaas-core/rate-limit";
import { generateText, getOpenRouter, DEFAULT_MODEL } from "@offbeatport/microsaas-core/ai";
import { sqlite } from "../db/client";
import { auth } from "./auth";

export interface GenerateResult {
  taglines: string[];
  remaining: number;
  limit: number;
  tier: Tier;
}

export const generateTaglines = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { productName: string; description: string }) => d,
  )
  .handler(async ({ data }): Promise<GenerateResult> => {
    if (!data.productName.trim()) throw new Error("Product name is required.");
    if (!data.description.trim()) throw new Error("Description is required.");

    const req = getRequest();

    // Determine tier
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      userId = session?.user?.id ?? null;
    } catch {
      // no session
    }
    const tier: Tier = userId ? "free" : "anon";
    const ownerKey = userId
      ? `u:${userId}`
      : resolveOwnerKey({ request: req });

    const rl: RateLimitResult = checkTieredRateLimit({ sqlite, ownerKey, tier });
    if (!rl.allowed) {
      throw new Error(
        `Daily limit reached (${rl.limit}/day). Resets at midnight UTC.`,
      );
    }

    const openrouter = getOpenRouter();
    const { text } = await generateText({
      model: openrouter(DEFAULT_MODEL),
      prompt: `Generate exactly 5 compelling, memorable taglines for the following product.

Product name: ${data.productName}
Description: ${data.description}

Requirements:
- Each tagline must be under 10 words
- Capture the single biggest benefit
- Be distinct from each other - vary the angle (outcome, speed, simplicity, social proof, transformation)
- No quotes, no numbering, no bullets - one tagline per line
- No preamble or explanation

Output exactly 5 lines.`,
    });

    const taglines = text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (taglines.length === 0) throw new Error("Model returned no taglines. Try again.");

    return {
      taglines,
      remaining: rl.remaining,
      limit: rl.limit,
      tier,
    };
  });
