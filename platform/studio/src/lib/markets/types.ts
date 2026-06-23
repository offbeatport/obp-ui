export type MarketSlug = "saas" | "finance";

export interface SubredditTarget {
  name: string;
  category: string;
  minScore?: number;
}

export interface G2Target {
  product: string;
  category: string;
  maxPages?: number;
}

export interface GithubTarget {
  owner: string;
  repo: string;
  category: string;
  label?: string;
}

export interface MarketProfile {
  slug: MarketSlug;
  name: string;
  description: string;
  categories: string[];
  subreddits: SubredditTarget[];
  g2Products: G2Target[];
  githubRepos: GithubTarget[];
  chromeExtensions: string[];
  sectors: string[];
  sectorLabels: Record<string, string>;
  clusterSectors: string;
  sourceQualityNote: string;
}
