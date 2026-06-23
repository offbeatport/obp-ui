import type { MarketProfile } from "./types.js";

export const financeMarket: MarketProfile = {
  slug: "finance",
  name: "Finance",
  description: "Institutional finance pain signals across portfolio management, risk analytics, performance attribution, trading infrastructure, wealth management, compliance, data infrastructure, and fund operations",
  categories: ["portfolio-mgmt", "risk-analytics", "perf-attribution", "trading-infra", "wealth-mgmt", "compliance", "data-infra", "fund-ops"],
  subreddits: [
    // ── Quant / professional finance - highest buyer quality ────────────────
    { name: "algotrading", category: "trading-infra", minScore: 3 },
    { name: "quant", category: "risk-analytics", minScore: 3 },
    { name: "quantfinance", category: "risk-analytics", minScore: 2 },
    { name: "CFA", category: "perf-attribution", minScore: 2 },
    { name: "financialmodeling", category: "perf-attribution", minScore: 2 },
    { name: "SecurityAnalysis", category: "portfolio-mgmt", minScore: 3 },
    { name: "ValueInvesting", category: "portfolio-mgmt", minScore: 3 },
    { name: "portfoliomanagement", category: "portfolio-mgmt", minScore: 2 },
    // ── High-net-worth / institutional ────────────────────────────────────────
    { name: "fatFIRE", category: "wealth-mgmt", minScore: 5 },
    { name: "HENRYfinance", category: "wealth-mgmt", minScore: 3 },
    { name: "ChubbyFIRE", category: "wealth-mgmt", minScore: 3 },
    { name: "PrivateEquity", category: "fund-ops", minScore: 3 },
    { name: "venturecapital", category: "fund-ops", minScore: 3 },
    { name: "hedgefund", category: "trading-infra", minScore: 2 },
    // ── Options / derivatives traders ─────────────────────────────────────────
    { name: "options", category: "trading-infra", minScore: 5 },
    { name: "thetagang", category: "trading-infra", minScore: 5 },
    { name: "Daytrading", category: "trading-infra", minScore: 3 },
    { name: "investing", category: "portfolio-mgmt", minScore: 8 },
    { name: "stocks", category: "portfolio-mgmt", minScore: 5 },
    { name: "ETFs", category: "portfolio-mgmt", minScore: 3 },
    { name: "Dividends", category: "portfolio-mgmt", minScore: 3 },
    { name: "Bogleheads", category: "portfolio-mgmt", minScore: 5 },
    // ── Financial planning / advisors ─────────────────────────────────────────
    { name: "personalfinance", category: "wealth-mgmt", minScore: 8 },
    { name: "financialindependence", category: "wealth-mgmt", minScore: 5 },
    { name: "FinancialAdvisors", category: "wealth-mgmt", minScore: 2 },
    { name: "CFP", category: "wealth-mgmt", minScore: 2 },
    { name: "FinancialPlanning", category: "wealth-mgmt", minScore: 3 },
    { name: "wealthmanagement", category: "wealth-mgmt", minScore: 2 },
    // ── Accounting / tax / fund ops ───────────────────────────────────────────
    { name: "accounting", category: "compliance", minScore: 3 },
    { name: "Accounting", category: "compliance", minScore: 3 },
    { name: "taxpros", category: "compliance", minScore: 2 },
    { name: "tax", category: "compliance", minScore: 3 },
    { name: "bookkeeping", category: "fund-ops", minScore: 2 },
    { name: "smallbusinessfinance", category: "fund-ops", minScore: 2 },
    // ── Data / analytics tools used in finance ────────────────────────────────
    { name: "dataengineering", category: "data-infra", minScore: 3 },
    { name: "datascience", category: "data-infra", minScore: 3 },
    { name: "BusinessIntelligence", category: "data-infra", minScore: 3 },
    { name: "PowerBI", category: "data-infra", minScore: 3 },
    { name: "excel", category: "perf-attribution", minScore: 3 },
    { name: "snowflake", category: "data-infra", minScore: 2 },
    { name: "dbt", category: "data-infra", minScore: 2 },
    // ── Finance tool-specific subreddits ─────────────────────────────────────
    { name: "quickbooks", category: "fund-ops", minScore: 1 },
    { name: "xero", category: "fund-ops", minScore: 1 },
    { name: "tableau", category: "data-infra", minScore: 2 },
    // ── Real estate investing ─────────────────────────────────────────────────
    { name: "realestateinvesting", category: "portfolio-mgmt", minScore: 3 },
    { name: "RealEstate", category: "portfolio-mgmt", minScore: 5 },
    { name: "CommercialRealEstate", category: "portfolio-mgmt", minScore: 2 },
    { name: "landlord", category: "portfolio-mgmt", minScore: 2 },
    // ── Crypto / DeFi ─────────────────────────────────────────────────────────
    { name: "CryptoCurrency", category: "trading-infra", minScore: 8 },
    { name: "defi", category: "trading-infra", minScore: 3 },
    { name: "CryptoTechnology", category: "data-infra", minScore: 3 },
  ],
  g2Products: [
    // Portfolio management & analytics
    { product: "addepar", category: "portfolio-mgmt" },
    { product: "orion-advisor-tech", category: "portfolio-mgmt" },
    { product: "black-diamond-wealth-platform", category: "portfolio-mgmt" },
    { product: "advent-portfolio-exchange", category: "portfolio-mgmt" },
    { product: "factset", category: "portfolio-mgmt" },
    { product: "bloomberg-terminal", category: "portfolio-mgmt" },
    { product: "refinitiv-workspace", category: "portfolio-mgmt" },
    { product: "morningstar-direct", category: "portfolio-mgmt" },
    // Risk analytics
    { product: "axioma-risk", category: "risk-analytics" },
    { product: "riskwatch", category: "risk-analytics" },
    { product: "msci-barra", category: "risk-analytics" },
    // Performance attribution
    { product: "statpro-revolution", category: "perf-attribution" },
    { product: "factset-performance", category: "perf-attribution" },
    { product: "composite-manager", category: "perf-attribution" },
    // Trading infrastructure
    { product: "charles-river-development", category: "trading-infra" },
    { product: "fidessa", category: "trading-infra" },
    { product: "flextrade", category: "trading-infra" },
    { product: "iress", category: "trading-infra" },
    // Wealth management
    { product: "emoney-advisor", category: "wealth-mgmt" },
    { product: "moneyguide-pro", category: "wealth-mgmt" },
    { product: "riskalyze", category: "wealth-mgmt" },
    { product: "redtail-crm", category: "wealth-mgmt" },
    // Compliance & reporting
    { product: "complexica", category: "compliance" },
    { product: "archer-grc", category: "compliance" },
    { product: "ssnc-advent", category: "compliance" },
    // Data infrastructure for finance
    { product: "snowflake", category: "data-infra" },
    { product: "databricks", category: "data-infra" },
    { product: "dbt", category: "data-infra" },
    { product: "apache-airflow", category: "data-infra" },
    { product: "dagster", category: "data-infra" },
    { product: "fivetran", category: "data-infra" },
    { product: "informatica-cloud-data-integration", category: "data-infra" },
    { product: "collibra", category: "data-infra" },
    { product: "alation", category: "data-infra" },
    // Fund operations
    { product: "advent-geneva", category: "fund-ops" },
    { product: "investran", category: "fund-ops" },
    { product: "efront-investment-management", category: "fund-ops" },
    { product: "allvue-systems", category: "fund-ops" },
    { product: "yardi-investment-management", category: "fund-ops" },
    { product: "simcorp-dimension", category: "fund-ops" },
  ],
  githubRepos: [
    // Bloomberg / data vendor alternatives
    { owner: "openbb-finance", repo: "OpenBBTerminal", category: "data-infra" },
    { owner: "ranaroussi", repo: "yfinance", category: "data-infra" },
    // Portfolio / risk
    { owner: "dcajasn", repo: "Riskfolio-Lib", category: "portfolio-mgmt" },
    { owner: "robertmartin8", repo: "PyPortfolioOpt", category: "portfolio-mgmt" },
    { owner: "quantopian", repo: "pyfolio", category: "risk-analytics" },
    // Backtesting platforms
    { owner: "QuantConnect", repo: "Lean", category: "trading-infra" },
    { owner: "mementum", repo: "backtrader", category: "trading-infra" },
    { owner: "polakowo", repo: "vectorbt", category: "trading-infra" },
    // Data infrastructure
    { owner: "snowflakedb", repo: "snowflake-connector-python", category: "data-infra" },
    { owner: "databricks", repo: "databricks-sdk-py", category: "data-infra" },
    { owner: "dbt-labs", repo: "dbt-core", category: "data-infra" },
    { owner: "dagster-io", repo: "dagster", category: "data-infra" },
    // Fintech APIs
    { owner: "plaid", repo: "plaid-node", category: "fund-ops" },
    { owner: "stripe", repo: "stripe-python", category: "fund-ops" },
    // QuantLib
    { owner: "lballabio", repo: "QuantLib-Python", category: "risk-analytics" },
    // ML for finance
    { owner: "hudson-and-thames", repo: "mlfinlab", category: "data-infra" },
    { owner: "stefan-jansen", repo: "machine-learning-for-trading", category: "data-infra" },
  ],
  chromeExtensions: [
    "gmbmikajjgmnabiglmofipeabaddhgne", // HubSpot Sales (fund-ops mapping)
    "ihibppbljkibcnmmbiapcbfmjgehocko", // Salesforce Lightning (fund-ops)
    "liecbddmkiiihnedobmlmillhodjkdmb", // Loom (fund-ops)
    "cbhilkcodigmkfcchpbbbomhkafhomea", // Calendly (fund-ops)
    "kgjfgplpablkjnlkjmjdecgdpfankdle", // Zoom (trading-infra)
    "fgahkfoeogbbbghekgppldmknljiiofe", // Monday.com (fund-ops)
    "hifphlmpohbbbancfnjmpkalmkefpnen", // DocuSign (fund-ops)
    "kbfnbcaeplbcioakkpcpgfkobkghlhen", // Grammarly (fund-ops)
    "iokeahhehimjnekafflcengimdiopoe",  // Pipedrive (fund-ops)
    "ndjpnladnnoajhedjgocoiinkjdamade", // Zapier (fund-ops)
  ],
  sectors: [
    "all", "portfolio-management", "risk-analytics", "performance-attribution",
    "trading-infrastructure", "wealth-management", "compliance", "data-infrastructure",
    "fund-operations", "fintech", "investment-data",
  ],
  sectorLabels: {
    all: "All sectors",
    "portfolio-management": "Portfolio Mgmt",
    "risk-analytics": "Risk Analytics",
    "performance-attribution": "Perf Attribution",
    "trading-infrastructure": "Trading Infra",
    "wealth-management": "Wealth Mgmt",
    "compliance": "Compliance",
    "data-infrastructure": "Data Infra",
    "fund-operations": "Fund Ops",
    "fintech": "Fintech",
    "investment-data": "Investment Data",
  },
  clusterSectors: "portfolio-management | risk-analytics | performance-attribution | trading-infrastructure | wealth-management | compliance | data-infrastructure | fund-operations | fintech | investment-data",
  sourceQualityNote: `
SOURCE QUALITY TIERS (use when scoring willingness_to_pay):
- TIER 1 - Strongest WTP evidence (someone already spending money or time):
  • jobs: company paying a human salary to do X manually = they'd pay for software
  • g2 / trustpilot / capterra / reviews: paying customer explaining why they cancelled or switched
  • github: highly-reacted feature request on a paid tool = proven demand gap
- TIER 2 - Moderate evidence (articulated pain from qualified buyers):
  • reddit: complaint in a professional subreddit (r/algotrading, r/quant, r/CFA) with upvotes
  • stackoverflow: developer asking how to do X manually because no library exists
  • hn: Ask HN post or comment from a practitioner
  • ih: indie hacker community - solopreneurs with real products and budgets
- TIER 3 - Weak evidence (unvalidated complaint):
  • twitter / bluesky / mastodon: passing rant, may not reflect real buying intent
  • substack / devto / ph / lobsters: polished writing or showcase, rarely raw pain

When a cluster contains Tier 1 signals, the willingness_to_pay floor is 6. When it's all Tier 3, cap WTP at 4 regardless of how strong the language sounds.
`,
};
