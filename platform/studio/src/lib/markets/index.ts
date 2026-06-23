import { saasMarket } from "./saas.js";
import { financeMarket } from "./finance.js";
import type { MarketProfile, MarketSlug } from "./types.js";

export const MARKETS: Record<MarketSlug, MarketProfile> = {
  saas: saasMarket,
  finance: financeMarket,
};

export function getMarket(slug?: string | null): MarketProfile {
  return MARKETS[(slug as MarketSlug) ?? "saas"] ?? MARKETS.saas;
}

export type { MarketProfile, MarketSlug };
