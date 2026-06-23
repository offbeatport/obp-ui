// ── Verticals - built-in B2B vertical definitions for Opportunity Radar ────────

export interface VerticalDef {
  slug: string;
  name: string;
  tagline: string;
  icon: "Building2" | "BarChart2" | "Users" | "ShoppingCart" | "Server" | "TrendingUp" | "Briefcase" | "Scale" | "Home" | "Activity" | "Truck" | "GraduationCap" | "Wrench" | "Heart" | "DollarSign" | "LineChart" | "UtensilsCrossed" | "Factory" | "Shield" | "FolderOpen" | "FlaskConical" | "Laptop" | "Rocket" | "Palette" | "Zap" | "Video" | "Code2";
  mrrRange: string;
  /** Rough lower bound of MRR potential in $/mo - used for sorting */
  mrrFloor: number;
  /**
   * How much credibility/proof a buyer needs before purchasing.
   * 1 = self-serve trial, no trust needed
   * 5 = procurement cycle, compliance review, security audit required
   */
  trustLevel: 1 | 2 | 3 | 4 | 5;
  /**
   * How hard it is to displace existing tools.
   * 1 = no lock-in, easy to replace
   * 5 = core system (ERP/EHR), extremely painful to switch
   */
  switchingCost: 1 | 2 | 3 | 4 | 5;
  seedCommunities: string[];
  budgetSignals: string[];
}

export interface VerticalExpansion {
  jobTitles: string[];
  tools: string[];
  communities: string[];
  painVocabulary: string[];
  budgetSignals: string[];
}

export type CommunitySize = "micro" | "niche" | "medium" | "large" | "mega";

export function communitySize(subscribers: number): CommunitySize {
  if (subscribers < 1_000) return "micro";
  if (subscribers < 10_000) return "niche";
  if (subscribers < 100_000) return "medium";
  if (subscribers < 500_000) return "large";
  return "mega";
}

/**
 * 0-1: peaks for a solopreneur at 2k-30k subs + active posting cadence.
 *
 * engagementRatio = postsPerDay / (subscribers / 1000)
 * (posts per 1 000 members per day - derived from fetched post timestamps
 * because Reddit's live `active_user_count` field is not returned to
 * unauthenticated API callers).
 * Calibration: 0.2 posts/1k/day → full engagement score.
 */
export function solopreneurFit(subscribers: number, engagementRatio: number, painDensity: number): number {
  const s = subscribers;
  const sizeScore =
    s < 500 ? 0.05 :
      s < 1_000 ? 0.25 :
        s < 2_000 ? 0.60 :
          s < 5_000 ? 0.90 :
            s < 300_000 ? 1.00 :   // peak: 5k–300k - enough posts/day, reply still gets seen
              s < 1_000_000 ? 0.55 : 0.20;
  const engScore = Math.min(1, engagementRatio * 5);  // 0.2 posts/1k/day → 1.0
  // Pain density is the primary signal - weight it highest.
  return Math.min(1, painDensity * 0.45 + sizeScore * 0.35 + engScore * 0.20);
}

export interface ScoredCommunity {
  subreddit: string;
  // Pain analysis (from /new.json)
  painDensity: number;
  buyerDensity: number;
  sampleSize: number;
  topPatterns: string[];
  // Community metadata (from /about.json)
  subscribers: number;
  /** Posts per day - derived from post timestamps (Reddit hides live active-user count from public API) */
  activeUsers: number;
  /** Posts per 1k subscribers per day - used as engagement proxy */
  engagementRatio: number;
  submissionType: string;  // "any" | "link" | "self"
  size: CommunitySize;
  // Derived
  fit: number;  // solopreneur fit 0-1
  error?: string;
}

export const VERTICALS: VerticalDef[] = [
  {
    slug: "agency-ops",
    name: "Agency / Client Services",
    tagline: "Marketing, design, and dev agencies managing client workflows and reporting",
    icon: "Briefcase",
    mrrRange: "$200–2k/seat",
    mrrFloor: 200,
    trustLevel: 2,
    switchingCost: 2,
    seedCommunities: ["agency", "PPC", "SEO", "GoogleAds", "freelance", "consulting", "MarketingAgencies", "smallbusiness"],
    budgetSignals: ["we use", "paying for", "our stack", "client retainer"],
  },
  {
    slug: "saas-ops",
    name: "SaaS Operations",
    tagline: "Ops and RevOps teams at B2B SaaS companies managing data and tooling",
    icon: "Server",
    mrrRange: "$500–5k/seat",
    mrrFloor: 500,
    trustLevel: 2,
    switchingCost: 3,
    seedCommunities: ["sysadmin", "devops", "dataengineering", "analytics", "BusinessIntelligence", "msp", "PowerBI", "excel"],
    budgetSignals: ["tool for", "subscription", "enterprise", "contract"],
  },
  {
    slug: "finance-accounting",
    name: "Finance & Accounting",
    tagline: "Controllers, bookkeepers, and CFOs managing financial workflows",
    icon: "DollarSign",
    mrrRange: "$300–3k/seat",
    mrrFloor: 300,
    trustLevel: 4,
    switchingCost: 4,
    seedCommunities: ["accounting", "bookkeeping", "taxpros", "CFP", "FinancialAdvisors", "quickbooks", "xero", "tax"],
    budgetSignals: ["paying for", "our accounting software", "CPA charges"],
  },
  {
    slug: "hr-recruiting",
    name: "HR & Recruiting",
    tagline: "HR teams and recruiters managing hiring and people ops workflows",
    icon: "Users",
    mrrRange: "$200–2k/seat",
    mrrFloor: 200,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["recruiting", "humanresources", "AskHR", "recruitinghell", "hrtech", "talentacquisition", "payroll"],
    budgetSignals: ["ATS", "HRIS", "we use", "per hire"],
  },
  {
    slug: "ecommerce",
    name: "E-commerce / DTC",
    tagline: "DTC brands and e-commerce operators managing inventory, logistics, and marketing",
    icon: "ShoppingCart",
    mrrRange: "$200–3k/mo",
    mrrFloor: 200,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["shopify", "ecommerce", "fulfillment", "FulfillmentByAmazon", "dropship", "Entrepreneur", "amazonFBA", "WooCommerce"],
    budgetSignals: ["paying for", "our Shopify apps", "monthly"],
  },
  {
    slug: "it-msp",
    name: "IT / MSP / SysAdmin",
    tagline: "IT administrators and managed service providers running client infrastructure",
    icon: "Server",
    mrrRange: "$500–10k/mo",
    mrrFloor: 500,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["msp", "sysadmin", "netsec", "homelab", "AZURE", "aws", "cloudcomputing", "k8s"],
    budgetSignals: ["RMM", "PSA", "license", "per endpoint"],
  },
  {
    slug: "revops-salesops",
    name: "RevOps & Sales Ops",
    tagline: "Revenue operations teams managing CRM, reporting, and sales workflows",
    icon: "TrendingUp",
    mrrRange: "$500–5k/seat",
    mrrFloor: 500,
    trustLevel: 3,
    switchingCost: 4,
    seedCommunities: ["salesforce", "hubspot", "revops", "sales", "CRM", "msp", "marketingops"],
    budgetSignals: ["Salesforce license", "HubSpot", "our CRM", "seat"],
  },
  {
    slug: "marketing-ops",
    name: "Marketing Ops",
    tagline: "Marketing operations teams managing campaigns, data, and attribution",
    icon: "BarChart2",
    mrrRange: "$300–3k/mo",
    mrrFloor: 300,
    trustLevel: 2,
    switchingCost: 2,
    seedCommunities: ["marketingops", "PPC", "FacebookAds", "GoogleAds", "programmatic", "analytics", "SEO", "email"],
    budgetSignals: ["ad spend", "marketing stack", "attribution tool"],
  },
  {
    slug: "legal-compliance",
    name: "Legal & Compliance",
    tagline: "Legal teams and compliance officers managing contracts and regulatory workflows",
    icon: "Scale",
    mrrRange: "$500–10k/seat",
    mrrFloor: 500,
    trustLevel: 5,
    switchingCost: 4,
    seedCommunities: ["legaladvice", "law", "compliance", "contracts", "paralegal", "LegalTech", "privacy"],
    budgetSignals: ["legal software", "contract management", "per matter"],
  },
  {
    slug: "real-estate-ops",
    name: "Real Estate Ops",
    tagline: "Property managers and real estate investors managing portfolios and tenants",
    icon: "Home",
    mrrRange: "$100–2k/mo",
    mrrFloor: 100,
    trustLevel: 2,
    switchingCost: 2,
    seedCommunities: ["realestateinvesting", "PropertyManagement", "landlord", "CommercialRealEstate", "airbnb_hosts", "REITs"],
    budgetSignals: ["property management software", "Buildium", "AppFolio"],
  },
  {
    slug: "construction-field",
    name: "Construction & Field Ops",
    tagline: "General contractors and field service companies managing projects and crews",
    icon: "Wrench",
    mrrRange: "$200–3k/seat",
    mrrFloor: 200,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["Construction", "generalcontractor", "ConstructionManagement", "plumbers", "HVAC", "fieldservice", "Buildit"],
    budgetSignals: ["project management software", "Procore", "estimating software"],
  },
  {
    slug: "logistics-supply-chain",
    name: "Logistics & Supply Chain",
    tagline: "Supply chain managers and 3PLs managing inventory and shipping operations",
    icon: "Truck",
    mrrRange: "$500–10k/mo",
    mrrFloor: 500,
    trustLevel: 4,
    switchingCost: 4,
    seedCommunities: ["supplychain", "logistics", "3PL", "warehousing", "procurement", "trucking", "shipping"],
    budgetSignals: ["TMS", "WMS", "freight software", "inventory software"],
  },
  {
    slug: "healthcare-admin",
    name: "Healthcare Administration",
    tagline: "Practice managers and health admin staff managing patient workflows",
    icon: "Heart",
    mrrRange: "$300–5k/seat",
    mrrFloor: 300,
    trustLevel: 5,
    switchingCost: 5,
    seedCommunities: ["healthcareit", "medicine", "nursing", "physicaltherapy", "dentistry", "medical", "EHR"],
    budgetSignals: ["EHR", "practice management", "billing software"],
  },
  {
    slug: "education-ops",
    name: "Education & EdTech",
    tagline: "School administrators and educators managing student workflows and reporting",
    icon: "GraduationCap",
    mrrRange: "$100–2k/seat",
    mrrFloor: 100,
    trustLevel: 4,
    switchingCost: 4,
    seedCommunities: ["Teachers", "education", "K12sysadmin", "highereducation", "edtech", "Canvas_LMS", "moodle"],
    budgetSignals: ["LMS", "school software", "district license"],
  },
  {
    slug: "property-tech",
    name: "PropTech & Facilities",
    tagline: "Facilities managers and property tech operators managing buildings and assets",
    icon: "Building2",
    mrrRange: "$200–3k/mo",
    mrrFloor: 200,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["facilitymanagement", "buildingmanagement", "SmartBuildings", "HOA", "condolife", "PropertyManagement"],
    budgetSignals: ["CMMS", "facilities software", "asset management"],
  },
  {
    slug: "investment-ops",
    name: "Investment & Wealth Ops",
    tagline: "Portfolio managers, RIAs, and family offices managing investment workflows and client reporting",
    icon: "LineChart",
    mrrRange: "$500–10k/seat",
    mrrFloor: 500,
    trustLevel: 5,
    switchingCost: 5,
    seedCommunities: ["FinancialAdvisors", "CFP", "wealthmanagement", "portfoliomanagement", "CFA", "quant", "algotrading", "financialplanning", "fatFIRE", "investing"],
    budgetSignals: ["Bloomberg terminal", "our custodian", "performance reporting", "rebalancing software", "per AUM", "compliance software", "portfolio software"],
  },
  {
    slug: "restaurant-hospitality",
    name: "Restaurant & Hospitality",
    tagline: "Restaurant owners and hospitality operators managing staff, inventory, and kitchen workflows",
    icon: "UtensilsCrossed",
    mrrRange: "$200–2k/mo",
    mrrFloor: 200,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["restaurantowners", "KitchenConfidential", "bartenders", "chefstalk", "Serverlife", "FoodService", "restaurant", "hospitality"],
    budgetSignals: ["POS system", "paying for", "our scheduling software", "labor cost", "food cost"],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing & Industrial Ops",
    tagline: "Production managers and plant ops teams tracking quality, maintenance, and output",
    icon: "Factory",
    mrrRange: "$1k–20k/mo",
    mrrFloor: 1000,
    trustLevel: 4,
    switchingCost: 5,
    seedCommunities: ["manufacturing", "industrialengineering", "qualityassurance", "lean", "6sigma", "CNC", "AdvancedManufacturing", "MaintenanceEngineering"],
    budgetSignals: ["ERP", "MES", "CMMS", "per machine", "plant software", "Procore", "SAP"],
  },
  {
    slug: "insurance-ops",
    name: "Insurance Operations",
    tagline: "Insurance agents, MGAs, and adjusters managing policies, claims, and compliance workflows",
    icon: "Shield",
    mrrRange: "$500–10k/seat",
    mrrFloor: 500,
    trustLevel: 5,
    switchingCost: 4,
    seedCommunities: ["Insurance", "InsuranceAgent", "actuary", "LifeInsurance", "InsuranceProfessional", "fintech", "compliance"],
    budgetSignals: ["AMS", "agency management", "per policy", "E&O", "compliance software", "claims software"],
  },
  {
    slug: "professional-services",
    name: "Professional Services Ops",
    tagline: "Consulting, accounting, and law firms managing client engagements, utilization, and billing",
    icon: "FolderOpen",
    mrrRange: "$300–5k/seat",
    mrrFloor: 300,
    trustLevel: 3,
    switchingCost: 3,
    seedCommunities: ["consulting", "mba", "projectmanagement", "BigFour", "Accounting", "legaltech", "law", "freelance"],
    budgetSignals: ["per billable hour", "utilization", "PSA tool", "engagement management", "time tracking software"],
  },
  {
    slug: "biotech-lab",
    name: "Biotech & Lab Operations",
    tagline: "Lab managers and research ops teams tracking samples, experiments, and regulatory compliance",
    icon: "FlaskConical",
    mrrRange: "$1k–20k/seat",
    mrrFloor: 1000,
    trustLevel: 5,
    switchingCost: 5,
    seedCommunities: ["labrats", "biology", "biotech", "chemistry", "Biochemistry", "molecularbiology", "labautomation", "ClinicalResearch"],
    budgetSignals: ["LIMS", "lab software", "per sample", "ELN", "regulatory compliance", "GxP", "21 CFR"],
  },

  // ── Low-trust, individual-buyer verticals ─────────────────────────────────
  // These buyers pay with their own card, decide alone, and try tools instantly.
  // Target with niche, single-workflow tools - not platforms.

  {
    slug: "freelance-consulting",
    name: "Freelancers & Consultants",
    tagline: "Independent workers juggling client projects, proposals, invoicing, and time tracking alone",
    icon: "Laptop",
    mrrRange: "$10–50/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["freelance", "consulting", "digitalnomad", "freelanceWriters", "freelancers", "upwork", "Fiverr", "forhire", "copywriting"],
    budgetSignals: ["paying for", "my rate", "invoice tool", "client retainer", "per project", "hourly rate", "time tracker"],
  },
  {
    slug: "indie-hackers",
    name: "Indie Hackers & Solo Founders",
    tagline: "Solo builders shipping small SaaS products and side projects - doing marketing, support, and code alone",
    icon: "Rocket",
    mrrRange: "$10–100/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["indiehackers", "SaaS", "SideProject", "startups", "entrepreneur", "microsaas", "bootstrapped", "EntrepreneurRideAlong"],
    budgetSignals: ["my stack", "paying for", "tool I use", "MRR", "churn", "per month", "subscription cost"],
  },
  {
    slug: "product-design",
    name: "Product Designers & UX",
    tagline: "UI/UX designers handling client feedback, design handoffs, component libraries, and version chaos in Figma",
    icon: "Palette",
    mrrRange: "$10–50/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["figma", "UXDesign", "webdesign", "userexperience", "UI_Design", "graphic_design", "ProductDesign", "DesignPrinciples"],
    budgetSignals: ["Figma plan", "paying for", "plugin", "design tool", "per seat", "license", "Pro plan"],
  },
  {
    slug: "nocode-automation",
    name: "No-code & Automation Builders",
    tagline: "Operators automating repetitive workflows with Make, Zapier, n8n, and Airtable - hitting limits constantly",
    icon: "Zap",
    mrrRange: "$10–100/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["nocode", "zapier", "n8n", "makercom", "Airtable", "bubble", "webflow", "automation", "lowcode", "Notion"],
    budgetSignals: ["Zapier plan", "Make credits", "operations limit", "task limit", "per operation", "paying for", "automation cost"],
  },
  {
    slug: "content-creators",
    name: "Content Creators",
    tagline: "YouTubers, podcasters, and writers managing content production, scheduling, repurposing, and distribution alone",
    icon: "Video",
    mrrRange: "$10–50/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["youtube", "podcasting", "blogging", "NewTubers", "podcasters", "content_marketing", "juststart", "SEO", "newsletter"],
    budgetSignals: ["editing tool", "paying for", "my workflow", "per month", "tool I use", "scheduler", "transcript"],
  },
  {
    slug: "indie-dev",
    name: "Indie Developers",
    tagline: "Solo and small-team developers shipping products and handling deployment, monitoring, and ops alone",
    icon: "Code2",
    mrrRange: "$10–100/mo",
    mrrFloor: 10,
    trustLevel: 1,
    switchingCost: 1,
    seedCommunities: ["webdev", "ExperiencedDevs", "SideProject", "selfhosted", "devops", "svelte", "nextjs", "rails", "django", "laravel"],
    budgetSignals: ["paying for", "my stack", "hosting cost", "API cost", "per month", "Vercel bill", "Supabase plan"],
  },
];
