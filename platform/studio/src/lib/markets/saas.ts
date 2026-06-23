import type { MarketProfile } from "./types.js";

export const saasMarket: MarketProfile = {
  slug: "saas",
  name: "SaaS",
  description: "B2B SaaS pain signals across data engineering, AI/ML, fintech, solopreneur, freelancer, and future-of-work verticals",
  categories: ["data", "ai", "fintech", "solopreneur", "freelancer", "future-of-work", "career-pivot", "investment"],
  subreddits: [
    // ── Tier 1: Professional buyers with real budget ─────────────────────────
    { name: "sysadmin", category: "data", minScore: 5 },
    { name: "devops", category: "data", minScore: 5 },
    { name: "excel", category: "data", minScore: 3 },
    { name: "PowerBI", category: "data", minScore: 3 },
    { name: "dataengineering", category: "data", minScore: 3 },
    { name: "datascience", category: "data", minScore: 3 },
    { name: "mlops", category: "ai", minScore: 3 },
    { name: "MachineLearning", category: "ai", minScore: 5 },
    { name: "analytics", category: "data", minScore: 3 },
    { name: "BusinessIntelligence", category: "data", minScore: 3 },
    { name: "fintech", category: "fintech", minScore: 3 },
    { name: "accounting", category: "fintech", minScore: 3 },
    { name: "bookkeeping", category: "fintech", minScore: 2 },
    // ── Tier 2: Solopreneurs and indie builders ──────────────────────────────
    { name: "SaaS", category: "solopreneur", minScore: 3 },
    { name: "solopreneur", category: "solopreneur", minScore: 2 },
    { name: "Entrepreneur", category: "solopreneur", minScore: 5 },
    { name: "smallbusiness", category: "solopreneur", minScore: 3 },
    { name: "indiehackers", category: "solopreneur", minScore: 2 },
    // ── Freelancers ──────────────────────────────────────────────────────────
    { name: "freelance", category: "freelancer", minScore: 3 },
    { name: "consulting", category: "freelancer", minScore: 3 },
    { name: "digitalnomad", category: "freelancer", minScore: 2 },
    // ── Future of work ───────────────────────────────────────────────────────
    { name: "remotework", category: "future-of-work", minScore: 3 },
    { name: "WorkReform", category: "future-of-work", minScore: 5 },
    // ── Career pivot ─────────────────────────────────────────────────────────
    { name: "cscareerquestions", category: "career-pivot", minScore: 5 },
    { name: "layoffs", category: "career-pivot", minScore: 3 },
    // ── Investment / personal finance ────────────────────────────────────────
    { name: "investing", category: "investment", minScore: 5 },
    { name: "StockMarket", category: "investment", minScore: 5 },
    { name: "stocks", category: "investment", minScore: 5 },
    { name: "ValueInvesting", category: "investment", minScore: 3 },
    { name: "Dividends", category: "investment", minScore: 3 },
    { name: "DividendInvesting", category: "investment", minScore: 2 },
    { name: "ETFs", category: "investment", minScore: 3 },
    { name: "mutualfunds", category: "investment", minScore: 2 },
    { name: "bonds", category: "investment", minScore: 2 },
    { name: "options", category: "investment", minScore: 5 },
    { name: "thetagang", category: "investment", minScore: 5 },
    { name: "investing_discussion", category: "investment", minScore: 2 },
    { name: "personalfinance", category: "investment", minScore: 5 },
    { name: "financialindependence", category: "investment", minScore: 5 },
    { name: "fatFIRE", category: "investment", minScore: 3 },
    { name: "ChubbyFIRE", category: "investment", minScore: 2 },
    { name: "leanfire", category: "investment", minScore: 2 },
    { name: "HENRYfinance", category: "investment", minScore: 2 },
    { name: "Bogleheads", category: "investment", minScore: 5 },
    { name: "FinancialPlanning", category: "investment", minScore: 3 },
    { name: "wealthmanagement", category: "investment", minScore: 2 },
    { name: "portfoliomanagement", category: "investment", minScore: 2 },
    { name: "MoneyDiariesACTIVE", category: "investment", minScore: 3 },
    { name: "personalfinance_IRL", category: "investment", minScore: 2 },
    { name: "EstatePlanning", category: "investment", minScore: 2 },
    { name: "inheritance", category: "investment", minScore: 2 },
    { name: "tax", category: "fintech", minScore: 3 },
    { name: "taxpros", category: "fintech", minScore: 2 },
    { name: "CFP", category: "investment", minScore: 2 },
    { name: "FinancialAdvisors", category: "investment", minScore: 2 },
    { name: "RealEstate", category: "investment", minScore: 5 },
    { name: "realestateinvesting", category: "investment", minScore: 3 },
    { name: "landlord", category: "investment", minScore: 2 },
    { name: "CommercialRealEstate", category: "investment", minScore: 2 },
    { name: "airbnb_hosts", category: "investment", minScore: 2 },
    { name: "passiveincome", category: "investment", minScore: 3 },
    { name: "reits", category: "investment", minScore: 2 },
    { name: "PrivateEquity", category: "investment", minScore: 2 },
    { name: "venturecapital", category: "investment", minScore: 2 },
    { name: "AngelInvesting", category: "investment", minScore: 2 },
    { name: "startups", category: "investment", minScore: 3 },
    { name: "UKPersonalFinance", category: "investment", minScore: 3 },
    { name: "AusFinance", category: "investment", minScore: 3 },
    { name: "CanadianInvestor", category: "investment", minScore: 2 },
    { name: "personalfinanceindia", category: "investment", minScore: 2 },
    { name: "eupersonalfinance", category: "investment", minScore: 2 },
    { name: "singaporefi", category: "investment", minScore: 2 },
    // ── Fintech / accounting / trading ──────────────────────────────────────
    { name: "financialmodeling", category: "fintech", minScore: 2 },
    { name: "SecurityAnalysis", category: "fintech", minScore: 2 },
    { name: "quickbooks", category: "fintech", minScore: 2 },
    { name: "wallstreetbets", category: "fintech", minScore: 8 },
    { name: "Accounting", category: "fintech", minScore: 3 },
    { name: "smallbusinessfinance", category: "fintech", minScore: 2 },
    { name: "xero", category: "fintech", minScore: 1 },
    // ── Tool-specific subreddits - ALL paying users venting ──────────────────
    { name: "salesforce", category: "solopreneur", minScore: 1 },
    { name: "hubspot", category: "solopreneur", minScore: 1 },
    { name: "pipedrive", category: "solopreneur", minScore: 1 },
    { name: "zoho", category: "solopreneur", minScore: 1 },
    { name: "jira", category: "data", minScore: 1 },
    { name: "confluence", category: "data", minScore: 1 },
    { name: "mondaydotcom", category: "solopreneur", minScore: 1 },
    { name: "asana", category: "solopreneur", minScore: 1 },
    { name: "clickup", category: "solopreneur", minScore: 1 },
    { name: "notion", category: "solopreneur", minScore: 1 },
    { name: "airtable", category: "solopreneur", minScore: 1 },
    { name: "zapier", category: "solopreneur", minScore: 1 },
    { name: "n8n", category: "solopreneur", minScore: 1 },
    { name: "MicrosoftPowerApps", category: "data", minScore: 1 },
    { name: "tableau", category: "data", minScore: 2 },
    { name: "looker", category: "data", minScore: 1 },
    { name: "snowflake", category: "data", minScore: 1 },
    { name: "dbt", category: "data", minScore: 1 },
    { name: "slack", category: "future-of-work", minScore: 2 },
    { name: "MicrosoftTeams", category: "future-of-work", minScore: 2 },
    { name: "workday", category: "future-of-work", minScore: 1 },
    { name: "zendesk", category: "solopreneur", minScore: 1 },
    { name: "intercom", category: "solopreneur", minScore: 1 },
    { name: "shopify", category: "solopreneur", minScore: 2 },
    { name: "WooCommerce", category: "solopreneur", minScore: 1 },
  ],
  g2Products: [
    // Data / Engineering
    { product: "fivetran", category: "data" },
    { product: "airbyte", category: "data" },
    { product: "dbt", category: "data" },
    { product: "apache-airflow", category: "data" },
    { product: "talend-data-integration", category: "data" },
    { product: "informatica-cloud-data-integration", category: "data" },
    { product: "databricks", category: "data" },
    { product: "snowflake", category: "data" },
    { product: "alation", category: "data" },
    { product: "collibra", category: "data" },
    // AI / ML
    { product: "datarobot", category: "ai" },
    { product: "h2o-ai", category: "ai" },
    { product: "weights-and-biases", category: "ai" },
    { product: "comet-ml", category: "ai" },
    { product: "labelbox", category: "ai" },
    { product: "scale-ai", category: "ai" },
    // Fintech
    { product: "stripe", category: "fintech" },
    { product: "quickbooks-online", category: "fintech" },
    { product: "xero", category: "fintech" },
    { product: "brex", category: "fintech" },
    { product: "bill-com", category: "fintech" },
    { product: "ramp", category: "fintech" },
    { product: "expensify", category: "fintech" },
    // Solopreneur / SMB
    { product: "hubspot-crm", category: "solopreneur" },
    { product: "monday-com", category: "solopreneur" },
    { product: "notion", category: "solopreneur" },
    { product: "airtable", category: "solopreneur" },
    { product: "mailchimp", category: "solopreneur" },
    { product: "activecampaign", category: "solopreneur" },
    { product: "zapier", category: "solopreneur" },
    // Freelancer
    { product: "toggl-track", category: "freelancer" },
    { product: "harvest", category: "freelancer" },
    { product: "freshbooks", category: "freelancer" },
    { product: "and-co", category: "freelancer" },
    { product: "bonsai", category: "freelancer" },
    // Future of work / remote
    { product: "slack", category: "future-of-work" },
    { product: "microsoft-teams", category: "future-of-work" },
    { product: "zoom", category: "future-of-work" },
    { product: "asana", category: "future-of-work" },
    { product: "linear", category: "future-of-work" },
    { product: "gitlab", category: "future-of-work" },
    // Career / learning
    { product: "linkedin-learning", category: "career-pivot" },
    { product: "coursera-for-business", category: "career-pivot" },
    { product: "greenhouse", category: "career-pivot" },
    { product: "lever", category: "career-pivot" },
    // Investment / portfolio
    { product: "addepar", category: "investment" },
    { product: "orion-advisor-tech", category: "investment" },
    { product: "black-diamond-wealth-platform", category: "investment" },
    { product: "quicken", category: "investment" },
  ],
  githubRepos: [
    // CRM / Marketing
    { owner: "HubSpot", repo: "hubspot-api-nodejs", category: "solopreneur" },
    { owner: "HubSpot", repo: "hubspot-api-python", category: "solopreneur" },
    { owner: "zapier-platform", repo: "cli", category: "solopreneur" },
    { owner: "zapier-platform", repo: "core", category: "solopreneur" },
    // Project management / productivity
    { owner: "atlassian", repo: "jira-python", category: "data" },
    { owner: "notion-so", repo: "notion-sdk-js", category: "solopreneur" },
    { owner: "monday-com", repo: "monday-sdk-js", category: "solopreneur" },
    { owner: "Airtable", repo: "airtable.js", category: "solopreneur" },
    // Fintech / payments
    { owner: "stripe", repo: "stripe-node", category: "fintech" },
    { owner: "stripe", repo: "stripe-python", category: "fintech" },
    { owner: "plaid", repo: "plaid-node", category: "fintech" },
    // Data / analytics
    { owner: "looker-open-source", repo: "sdk-codegen", category: "data" },
    { owner: "tableau", repo: "tableau-ui", category: "data" },
    { owner: "snowflakedb", repo: "snowflake-connector-python", category: "data" },
    { owner: "databricks", repo: "databricks-sdk-py", category: "data" },
    // AI infra
    { owner: "wandb", repo: "wandb", category: "ai" },
    { owner: "BerriAI", repo: "litellm", category: "ai" },
    // Communication / collaboration
    { owner: "slackapi", repo: "bolt-python", category: "future-of-work" },
    { owner: "slackapi", repo: "node-slack-sdk", category: "future-of-work" },
    { owner: "pipedream-connect", repo: "pipedream", category: "solopreneur" },
  ],
  chromeExtensions: [
    "gmbmikajjgmnabiglmofipeabaddhgne", // HubSpot Sales
    "ihibppbljkibcnmmbiapcbfmjgehocko", // Salesforce Lightning
    "liecbddmkiiihnedobmlmillhodjkdmb", // Loom
    "cbhilkcodigmkfcchpbbbomhkafhomea", // Calendly
    "kgjfgplpablkjnlkjmjdecgdpfankdle", // Zoom
    "fgahkfoeogbbbghekgppldmknljiiofe", // Monday.com
    "hifphlmpohbbbancfnjmpkalmkefpnen", // DocuSign
    "kbfnbcaeplbcioakkpcpgfkobkghlhen", // Grammarly
    "iokeahhehimjnekafflcengimdiopoe",  // Pipedrive
    "ndjpnladnnoajhedjgocoiinkjdamade", // Zapier
  ],
  sectors: [
    "all", "data", "ai", "fintech", "investment", "solopreneur",
    "human-proof-of-work", "async-work", "freelancer-finance", "career-pivot", "future-of-work",
    "legal", "creator-economy",
  ],
  sectorLabels: {
    all: "All sectors",
    data: "Data",
    ai: "AI",
    fintech: "Fintech",
    investment: "Investment",
    solopreneur: "Solopreneur",
    "human-proof-of-work": "Human PoW",
    "async-work": "Async Work",
    "freelancer-finance": "Freelancer Finance",
    "career-pivot": "Career Pivot",
    "future-of-work": "Future of Work",
    "legal": "Legal",
    "creator-economy": "Creator Economy",
  },
  clusterSectors: "investment | human-proof-of-work | async-work | freelancer-finance | career-pivot | future-of-work | fintech | solopreneur | trading | high-revenue-potential | data | ai | legal | creator-economy",
  sourceQualityNote: `
SOURCE QUALITY TIERS (use when scoring willingness_to_pay):
- TIER 1 - Strongest WTP evidence (someone already spending money or time):
  • jobs: company paying a human salary to do X manually = they'd pay for software
  • g2 / trustpilot / capterra / reviews: paying customer explaining why they cancelled or switched
  • github: highly-reacted feature request on a paid tool = proven demand gap
- TIER 2 - Moderate evidence (articulated pain from qualified buyers):
  • reddit: complaint in a professional subreddit (r/sysadmin, r/devops, r/datascience) with upvotes
  • stackoverflow: developer asking how to do X manually because no library exists
  • hn: Ask HN post or comment from a practitioner
  • ih: indie hacker community - solopreneurs with real products and budgets
- TIER 3 - Weak evidence (unvalidated complaint):
  • twitter / bluesky / mastodon: passing rant, may not reflect real buying intent
  • substack / devto / ph / lobsters: polished writing or showcase, rarely raw pain

When a cluster contains Tier 1 signals, the willingness_to_pay floor is 6. When it's all Tier 3, cap WTP at 4 regardless of how strong the language sounds.
`,
};
