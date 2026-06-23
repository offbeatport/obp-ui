// ── Reddit Pain Signal Classifier ────────────────────────────────────────────
//
// Pipeline:
//   1. Hard-reject subreddit check  → score 0
//   2. Hard-reject content check    → score 0
//   3. Business-context gate        → must pass to proceed
//   4. Subreddit prior multiplier   → scales final score
//   5. Scoring: workflow + recurring + specificity signals
//
// The signal is NOT "manual" or "spreadsheet" in isolation.
// The signal is: recurring business workflow currently managed manually.

// ── 1. Subreddit tiers ────────────────────────────────────────────────────────

/**
 * Subreddits where posts are never B2B pain signals regardless of content.
 * Gaming, relationships, health, fiction, politics, hobbies.
 */
export const NOISE_SUBS = new Set([
  // Gaming
  'gaming', 'pcgaming', 'apexlegends', 'Minecraft', 'GlobalOffensive', 'leagueoflegends',
  'Dota2', 'FortNiteBR', 'CODWarzone', 'StarRailStation', 'GenshinImpact', 'yugioh',
  'MagicArena', 'SmashBrosUltimate', 'totalwar', 'Sekiro', 'PathOfExile2', 'DeadlockTheGame',
  'worldofpvp', 'ffxiv', 'ffxivdiscussion', 'runescape', '2007scape', 'Warthunder',
  'AssassinsCreedShadows', 'fut', 'btd6', 'soloboardgaming', 'pathoftitans', 'heroes',
  'blocktales', 'nmrih', 'WutheringWaves', 'afkarena', 'rivals', 'HalfManTV',
  'Grimdank', 'NatureofPredators', 'HFY', 'nosleep', 'horrorstories',
  // Relationships / personal advice
  'relationship_advice', 'relationships', 'dating_advice', 'Marriage', 'AITA', 'AmItheAsshole',
  'AmIOverreacting', 'BestofRedditorUpdates', 'confessions', 'offmychest', 'OffMyChestPH',
  'BreakUps', 'UnsentLetters', 'UnsentLettersRaw', 'TrueScaryStories',
  // Personal health / medical
  'diabetes_t1', 'AskDocs', 'mentalhealth', 'depression', 'Anxiety', 'Anxietyhelp',
  'raisedbynarcissists', 'CPTSD', 'CPTSD_NSCommunity', 'TryingForABaby', 'sleeptrain',
  'lexapro', 'AskVet', 'weightgain', 'PeriodontalDisease', 'pppdizziness',
  // Fiction / creative writing
  'WritingPrompts', 'worldbuilding', 'HFY', 'nosleep', 'scarystories', 'Odd_directions',
  'TalesFromTheCreeps', 'JacksonWrites', 'RinaKentBooks', 'BookZen', 'EternalStoryBook',
  // Politics / news
  'politics', 'worldnews', 'news', 'conspiracy', 'ProgressiveHQ', 'LabourUK',
  // Hobby / consumer
  'knitting', 'quilting', 'quilting', 'CrossStitch', 'boardgames', 'miniatures',
  'analog', 'photography', 'telescopes', 'CatDistributionSystem', 'dogs', 'Aquariums',
  // Cars (personal use - not fleet/logistics)
  'whatcarshouldIbuy', 'CarTalkUK', 'AskMechanics', 'hondacivic', 'camaro',
  'FocusRS', 'CorollaHatchback', 'MitsubishiEvolution', 'AskMechanics', 'crz',
  // Entertainment / TV shows
  'movies', 'television', 'CDrama', 'BORUpdates', 'survivor', 'baseball', 'nba',
  'SquaredCircle', 'Overwatch', 'TheBoys', 'FinalFantasy', 'totalwarhammer',
  'ThePittTVShow', 'GreysAnatomy', 'HouseOfDragon', 'StrangerThings', 'BreakingBad',
  'television', 'NetflixSeries', 'DisneyPlus', 'HBOMax', 'peacock',
  // Tabletop / VTT gaming
  'FoundryVTT', 'DnD', 'DnDNext', 'pathfinder_rpg', 'rpg', 'DMAcademy',
  'mattcolville', 'worldbuilding', 'ttrpg', 'PokemonTCG', 'MtGLore',
  // Consumer gear / fitness / health products
  'kobo', 'kindle', 'remarkableTablet', 'eink',
  'running', 'Fitness', 'loseit', 'bodyweightfitness', 'xxfitness',
  'indianrunners', 'runninglifestyle', 'triathlon', 'cycling',
  'IndianHaircare', 'SkincareAddiction', 'AsianBeauty', 'Haircare',
  'ropeaccess', 'climbing', 'Mountaineering', 'hiking',
  'GLP1Sourcing', 'Ozempic', 'weightlosstalk', 'intermittentfasting',
  'bevelhealth', 'AppleWatch', 'Garmin', 'Whoop',
  // Personal / family / lifestyle
  'EstrangedAdultKids', 'raisedbynarcissists', 'JUSTNOMIL', 'AmItheAsshole',
  'personalfinance', 'povertyfinance', 'Frugal', 'financialindependence',
  // Job search / career (personal, not B2B ops)
  'jobsearch', 'jobs', 'careerguidance', 'resumes', 'cscareerquestions',
  'ITCareerQuestions', 'ExperiencedDevs', 'recruitinghell', 'careertechnical',
  // Trading / investing (consumer finance, not ops)
  'interactivebrokers', 'stocks', 'investing', 'wallstreetbets', 'Daytrading',
  'options', 'StockMarket', 'ValueInvesting', 'personalfinance',
  // Healthcare workers / clinical (personal professional, not B2B SaaS)
  'scrubtech', 'nursing', 'medicine', 'physicianassistant', 'medicalschool',
  // AI coding IDE communities (tool users, not B2B pain signals)
  'windsurf', 'cursor', 'CursorAI', 'github_copilot',
  // Referral / deal / promo subs
  'Referral', 'referralcodes', 'deals', 'coupons', 'freebies', 'TestMyApp',
  // Misc consumer
  'komoot', 'AllTrails', 'wanderlust', 'solotravel', 'digitalnomad',
  // Emotional support
  'GriefSupport', 'SuicideWatch', 'lonely', 'TalkingToNHIandSpirit',
]);

/**
 * Subreddits where B2B pain is expected. Score multiplier applied to final score.
 * Higher = stronger prior that posts here are business pain signals.
 */
export const BUSINESS_SUB_PRIOR: Record<string, number> = {
  // Pure B2B ops - strong signal
  'agency': 2.0, 'MarketingAgencies': 2.0, 'PPC': 2.0, 'GoogleAds': 2.0,
  'SEO': 1.8, 'DigitalMarketing': 1.8, 'advertising': 1.8, 'copywriting': 1.6,
  'freelance': 2.0, 'freelanceWriters': 1.8, 'forhire': 1.8, 'consulting': 2.0,
  'smallbusiness': 1.8, 'entrepreneur': 1.5, 'Entrepreneurs': 1.5,
  'msp': 2.0, 'sysadmin': 2.0, 'devops': 1.8, 'dataengineering': 1.8,
  'analytics': 1.8, 'BusinessIntelligence': 2.0, 'PowerBI': 1.8,
  'excel': 1.8, 'zapier': 2.0, 'n8n': 2.0, 'nocode': 2.0,
  'Airtable': 1.8, 'automation': 1.8, 'makercom': 2.0, 'webflow': 1.6,
  'accounting': 1.8, 'bookkeeping': 2.0, 'taxpros': 1.8, 'quickbooks': 1.8,
  'ecommerce': 1.8, 'shopify': 1.8, 'amazonFBA': 1.8, 'dropshipping': 1.8,
  'FulfillmentByAmazon': 1.8, 'WooCommerce': 1.8, 'shopifydev': 1.8,
  'CRMSoftware': 2.0, 'salesforce': 1.8, 'hubspot': 1.8,
  'projectmanagement': 1.8, 'productivity': 1.4,
  'freightforwarding': 2.0, 'logistics': 1.8, 'supplychain': 1.8,
  'manufacturing': 1.8, 'grc': 2.0, 'legaltech': 2.0,
  'FieldSalesHelp': 2.0, 'SysAdminBlogs': 2.0,
  // Professional tools - moderate signal
  'Notion': 1.4, 'webdev': 1.3, 'SideProject': 1.3,
  'indiehackers': 1.3, 'SaaS': 1.3, 'startups': 1.3,
  'UnaAI': 1.6, 'GrowthToolkit': 1.6, 'AnalyticsAutomation': 1.6,
  // Creator economy - ops & revenue side
  'podcasting': 1.8, 'newsletters': 1.8, 'blogging': 1.6,
  'CreatorsAdvice': 2.0, 'ContentCreators': 1.8,
  'NewTubers': 1.6, 'youtubers': 1.6, 'SmallYTChannel': 1.6,
  'Twitch': 1.3, 'TwitchCreators': 1.8,
  'SubredditTV': 1.4, 'Substack': 1.8,
  'OnlineSellers': 1.8, 'artbusiness': 1.8, 'Etsy': 1.6,
  // Gig economy
  'AirbnbHosts': 2.0, 'airbnb': 1.8, 'vrbo': 1.8,
  'UberDrivers': 1.6, 'doordash_drivers': 1.4, 'InstacartShoppers': 1.4,
  'TaskRabbit': 1.8, 'reselling': 1.8, 'Flipping': 1.6,
  'Depop': 1.4, 'poshmark': 1.4, 'Mercari': 1.4,
  // Solo service businesses
  'PersonalTrainerTips': 2.0, 'personaltraining': 1.8,
  'housecleaning': 1.8, 'handyman': 1.8, 'landscaping': 1.6,
  'tutors': 1.8, 'MassageTherapists': 1.8, 'Esthetics': 1.8,
  'petgrooming': 1.8, 'dogwalking': 1.8, 'petsitting': 1.8,
  'photographybusiness': 2.0, 'WeddingPhotography': 1.8,
};

// ── 2. Pain search patterns ───────────────────────────────────────────────────

export const PAIN_PATTERNS = [
  '"been doing this manually"',
  '"doing it manually"',
  '"still doing this by hand"',
  '"tired of manually"',
  '"is there a better way to"',
  '"does anything exist that"',
  '"anyone know a good way to"',
  '"has to be a better way"',
  '"any alternatives to"',
  '"wish there was a tool"',
  '"no good solution"',
  '"can\'t believe there\'s no"',
  '"I\'m surprised there isn\'t"',
  '"just use a spreadsheet"',
  '"using a spreadsheet for"',
  '"built my own spreadsheet"',
  '"stuck using"',
  '"how do you all handle"',
  '"what do you use for"',
  '"every time I have to"',
  '"is so tedious"',
  '"takes forever to"',
  '"I keep having to"',
];

// ── Consumer scorer ───────────────────────────────────────────────────────────
//
// B2C mode: skips the business-context gate entirely.
// Used when scanning consumer-focused dimensions.

const CONSUMER_CONTEXT: RegExp[] = [
  // Personal desire / seeking
  /\b(is there an? (app|tool|way|service)|looking for (an? )?(app|tool|solution)|any (app|tool|way) to)\b/i,
  /\b(wish (there was|I could|someone would)|why (isn'?t there|doesn'?t|can'?t I))\b/i,
  /\b(I can'?t (find|figure out|seem to)|I (struggle|always|keep) (with|forgetting|losing|missing))\b/i,
  // Life context
  /\b(as a (parent|student|freelancer|remote worker|homeowner)|my (health|diet|budget|spending|routine|schedule))\b/i,
  /\b(daily (life|routine|habit)|personal (finance|budget|health|goals|project))\b/i,
  // Frustration
  /\b(so frustrating|drives me (crazy|nuts|insane)|I hate (that|when|how)|annoying when)\b/i,
  /\b(tired of|sick of|fed up with|can'?t stand)\b/i,
];

const CONSUMER_FRUSTRATION: RegExp[] = [
  /\b(forget(s|ting)?|keep forgetting|always forget)\b/i,
  /\b(lost track|losing track|can'?t keep track)\b/i,
  /\b(no (good |)?app|nothing out there|nothing that works)\b/i,
  /\b(tried (everything|every app)|nothing works for me)\b/i,
  /\b(overwhelm(ed|ing)|drowning in|too many)\b/i,
  /\b(waste(s|d)? (so much|a lot of) time)\b/i,
  /\b(manual(ly)?|by hand|one by one)\b/i,
];

const CONSUMER_SOLUTION_SEEKING: RegExp[] = [
  /\b(is there (a |an )(way|tool|app|service)|does (anyone|any app)|anyone (know|use|tried))\b/i,
  /\b(recommendation|recommend|suggest|any (suggestions|ideas|thoughts))\b/i,
  /\b(looking for (something|an app|a tool|a way)|want(s|ing)? (something|an app) (that|to|which))\b/i,
  /\b(how do you (handle|deal with|manage|track|keep))\b/i,
  /\b(what do you (use|do) (for|when|to))\b/i,
];

export function scoreConsumerSignal(title: string, body: string, subreddit: string): number {
  const text = title + ' ' + body;

  // Hard rejects still apply
  if (NOISE_SUBS.has(subreddit)) return 0;
  if (REJECT_CONTENT.some(re => re.test(text))) return 0;
  if (PROMO_PATTERNS.some(re => re.test(text))) return 0;

  // Must have at least one consumer-context signal
  if (!CONSUMER_CONTEXT.some(re => re.test(text))) return 0;

  let score = 3;

  // Frustration signals (+1 each, up to +3)
  score += Math.min(3, CONSUMER_FRUSTRATION.filter(re => re.test(text)).length);

  // Solution-seeking (+2)
  if (CONSUMER_SOLUTION_SEEKING.some(re => re.test(text))) score += 2;

  // Recurring / habitual (+2)
  if (RECURRING.some(re => re.test(text))) score += 2;

  return Math.max(0, Math.min(10, Math.round(score)));
}

// ── Pain dimensions - targeted pattern sets by problem type ──────────────────
//
// Use these to go deeper on a specific class of pain instead of broad scanning.
// Each dimension's patterns are optimized for Reddit search (exact phrase = quoted).
// isConsumer: true → bypasses the B2B business-context gate, uses consumer scorer.

export const PAIN_DIMENSIONS: Record<string, { label: string; description: string; patterns: string[]; isConsumer?: boolean }> = {
  default: {
    label: "All dimensions",
    description: "Broad manual-work & solution-seeking patterns",
    patterns: PAIN_PATTERNS,
  },
  financial: {
    label: "Financial pain",
    description: "Invoice tracking, reconciliation, payroll, cash flow",
    patterns: [
      '"reconcile manually"',
      '"manually reconcile"',
      '"invoice tracking"',
      '"chasing invoices"',
      '"payroll manually"',
      '"manually track payments"',
      '"cash flow spreadsheet"',
      '"expense report manually"',
      '"accounts receivable"',
      '"billing manually"',
      '"manually invoice"',
      '"track expenses manually"',
    ],
  },
  scale_breaking: {
    label: "Scale-breaking",
    description: "Works for 10 clients, breaks at 100 - outgrown tools",
    patterns: [
      '"doesn\'t scale"',
      '"outgrown"',
      '"too many clients to"',
      '"can\'t keep up"',
      '"adding more clients"',
      '"works for small"',
      '"not built for"',
      '"falls apart"',
      '"breaks down when"',
      '"growing pains"',
      '"volume is getting too high"',
    ],
  },
  integration: {
    label: "Integration gaps",
    description: "Copy-paste between tools, missing sync, data silos",
    patterns: [
      '"copy paste between"',
      '"manually export"',
      '"manually import"',
      '"no integration"',
      '"doesn\'t sync"',
      '"manually transfer"',
      '"data in two places"',
      '"manually update"',
      '"have to export csv"',
      '"no native integration"',
      '"manually move data"',
    ],
  },
  reporting: {
    label: "Reporting pain",
    description: "Compiling reports, pulling from multiple sources, month-end",
    patterns: [
      '"compile report"',
      '"compiling reports"',
      '"pulling data from"',
      '"end of month"',
      '"report takes"',
      '"manually build"',
      '"aggregate data"',
      '"weekly report"',
      '"monthly report"',
      '"reporting manually"',
      '"put together a report"',
    ],
  },
  implicit: {
    label: "Implicit pain",
    description: "Process questions - people describing their workflow",
    patterns: [
      '"what\'s your process for"',
      '"how do you handle"',
      '"workflow for"',
      '"best way to track"',
      '"how do you manage"',
      '"looking for a system"',
      '"what tools do you use for"',
      '"how are you handling"',
      '"process for managing"',
      '"how do you keep track"',
      '"anyone have a good system"',
    ],
  },

  // ── Deeper / subtle layers ──────────────────────────────────────────────────

  workarounds: {
    label: "Workarounds",
    description: "DIY hacks, cobbled solutions, self-built systems - highest buy signal",
    patterns: [
      '"hacked together"',
      '"duct tape"',
      '"works but"',
      '"good enough for now"',
      '"my system for"',
      '"template I built"',
      '"macro I wrote"',
      '"script I wrote"',
      '"built a spreadsheet"',
      '"kludge"',
      '"bandaid solution"',
      '"cobbled together"',
      '"patchwork"',
      '"workaround I use"',
    ],
  },

  time_cost: {
    label: "Time cost",
    description: "Quantified time waste - hours per week, all day, every time",
    patterns: [
      '"hours a week"',
      '"hours every week"',
      '"takes all day"',
      '"all day just to"',
      '"spend half my time"',
      '"most of my time"',
      '"hours just to"',
      '"2 hours"',
      '"3 hours"',
      '"half a day"',
      '"entire day"',
      '"half my day"',
    ],
  },

  discovery: {
    label: "Discovery intent",
    description: "Actively looking to automate or find a tool - hot buying intent",
    patterns: [
      '"looking to automate"',
      '"automate this"',
      '"automating my"',
      '"want to automate"',
      '"tool that can"',
      '"software that"',
      '"app that"',
      '"is there an app"',
      '"is there a tool"',
      '"is there software"',
      '"looking for software"',
      '"looking for a tool"',
      '"looking for an app"',
    ],
  },

  // ── B2C / consumer dimensions ───────────────────────────────────────────────

  b2c_personal_finance: {
    label: "B2C · Personal finance",
    description: "Budgeting, subscriptions, spending tracking, savings goals",
    isConsumer: true,
    patterns: [
      '"track my spending"',
      '"budget spreadsheet"',
      '"forgot to cancel"',
      '"subscriptions I forgot"',
      '"keep track of my bills"',
      '"save money on"',
      '"overspending on"',
      '"can\'t stick to my budget"',
      '"where does my money go"',
      '"is there an app for budgeting"',
      '"best budgeting app"',
      '"financial goals"',
    ],
  },

  // ── Creator economy ─────────────────────────────────────────────────────────

  creator_ops: {
    label: "Creator · Ops & revenue",
    description: "Brand deals, sponsorship tracking, invoicing, content ops, income streams",
    patterns: [
      '"track my brand deals"',
      '"sponsorship tracking"',
      '"deliverables tracker"',
      '"content calendar"',
      '"editorial calendar"',
      '"media kit"',
      '"brand deal"',
      '"sponsorship invoice"',
      '"creator invoice"',
      '"repurpose content"',
      '"content batching"',
      '"posting schedule"',
      '"track my income"',
      '"multiple income streams"',
      '"affiliate income"',
      '"creator taxes"',
      '"Patreon income"',
    ],
  },

  // ── Prosumer / mid-market ────────────────────────────────────────────────────

  gig_economy: {
    label: "Gig · Multi-platform income",
    description: "Airbnb hosts, resellers, gig workers - tracking income & ops across platforms",
    isConsumer: true,
    patterns: [
      '"manage my listings"',
      '"track my earnings"',
      '"multiple platforms"',
      '"Airbnb calendar"',
      '"guest messaging"',
      '"price my"',
      '"multiple booking"',
      '"track my expenses"',
      '"quarterly taxes"',
      '"self-employment tax"',
      '"reselling inventory"',
      '"keep track of my sales"',
      '"bookings manually"',
      '"manage multiple properties"',
      '"platform fees"',
    ],
  },

  solo_service: {
    label: "Solo service biz",
    description: "Personal trainers, cleaners, tutors, dog walkers - client ops for one-person businesses",
    patterns: [
      '"client scheduling"',
      '"no-show"',
      '"appointment reminders"',
      '"invoice my clients"',
      '"track my clients"',
      '"client intake"',
      '"client notes"',
      '"booking system"',
      '"collect payment"',
      '"keep track of my clients"',
      '"training program"',
      '"client management"',
      '"session notes"',
      '"cancellation policy"',
      '"recurring clients"',
    ],
  },
};

// ── 3. Hard-reject content patterns ──────────────────────────────────────────

// Any of these in the text = definitely not a B2B opportunity → score 0
const REJECT_CONTENT: RegExp[] = [
  // Cars
  /\bmanual transmission\b/i, /\bmanual gearbox\b/i, /\bstick shift\b/i,
  /\b(6|5|7|8)-speed manual\b/i,
  /\b(drive|driving|drove)\b.{0,40}\bmanual\b/i,
  /\bmanual\b.{0,20}\b(clutch|gear|gearbox|shift)\b/i,
  // Relationships
  /\b(my (boyfriend|girlfriend|husband|wife|ex|fiancee?|partner|spouse))\b/i,
  /\b(we broke up|breaking up|he left|she left|cheating|affair|divorce)\b/i,
  /\b(relationship advice|dating (advice|app)|tinder|hinge|bumble)\b/i,
  // Gaming (content signals, for when subreddit isn't in NOISE_SUBS)
  /\b(pvp|pve|dungeon|raid|respawn|respawning|skill tree|loot|loadout|in-game|in game|game mode|boss fight|quest (line|marker)|mana|stamina bar|health bar)\b/i,
  /\b(my character|my hero|my build|my deck|my team\s+in\s+the\s+game)\b/i,
  // Personal health
  /\b(my (doctor|therapist|medication|diagnosis|symptoms|blood sugar|insulin|prescription))\b/i,
  /\b(mental health|depression|anxiety disorder|panic attack|chronic (pain|illness))\b/i,
  // Fiction/creative writing
  /\b(the protagonist|the main character|the villain|the hero|chapter \d|book series|fanfic|lore)\b/i,
  // Politics/news
  /\b(the (president|prime minister|government|congress|senate|election|voters|democrat|republican))\b/i,
  // Emotional support
  /\b(i (feel|felt) (so )?(alone|hopeless|worthless|suicidal|depressed|broken))\b/i,
];

// ── 4. Business-context gate ──────────────────────────────────────────────────

// At least ONE of these must be present to pass the gate (unless subreddit prior ≥ 1.8)
const BUSINESS_CONTEXT: RegExp[] = [
  // People/org
  /\b(client|clients|customers?|vendor|stakeholder|colleague|coworker|employee|staff|contractor|team)\b/i,
  // Tools/software
  /\b(CRM|ERP|spreadsheet|dashboard|API|webhook|integration|workflow|automation|Zapier|Airtable|Notion|Salesforce|HubSpot|QuickBooks|Xero|Slack|Jira|Asana|Trello|monday\.com|ClickUp|Pipedrive)\b/i,
  // Business process
  /\b(invoice|billing|payroll|payment|revenue|budget|expense|report|reporting|compliance|audit|contract|proposal|quote|onboarding|reconcili|SLA|KPI|ROI|P&L)\b/i,
  // Work context
  /\b(at work|for work|our company|my company|my business|our team|my team|our process|business process|ops|operations|back[- ]office|front[- ]office)\b/i,
  // Recurring business cadence
  /\b(end of (month|week|quarter)|monthly report|weekly report|quarterly review|payroll run|billing cycle|fiscal)\b/i,
  // Scale signals
  /\b(\d+\s*(clients?|customers?|users?|employees?|vendors?)|per (client|customer|seat|user)|hundreds? of (clients|records|entries))\b/i,
  // Import/export/data ops
  /\b(export|import|csv|sync|migrate|database|data (entry|cleaning|pipeline|feed)|ETL)\b/i,
  // Admins/ops roles
  /\b(admin|administrator|ops (team|manager|lead)|office manager|project manager|account manager|RevOps|FinOps|DevOps)\b/i,
];

// ── 5. Recurring-process signals ─────────────────────────────────────────────

const RECURRING: RegExp[] = [
  /every\s+(day|week|month|monday|friday|quarter|morning|morning)\b/i,
  /\b(weekly|monthly|daily|quarterly|each\s+(week|month|day))\b/i,
  /\d+\s+hours?\s+(every|per|a)\s+(week|month|day)\b/i,
  /\b(keeps?\s+(happening|coming\s+up)|again\s+and\s+again|over\s+and\s+over)\b/i,
  /\b(recurring|repetitive|repeat(ed|edly)?|routine (task|process|workflow))\b/i,
  /\bevery\s+time\s+(I|we|they)\s+(have|need|do)\b/i,
  /\b(been (doing|dealing with) this for (weeks?|months?|years?))\b/i,
];

// ── 6. Specificity / high-value signals ──────────────────────────────────────

// These boost score when present - they indicate a concrete, valuable problem
const HIGH_VALUE: RegExp[] = [
  /\b(invoice|billing|payroll|compliance|audit|contract|SLA)\b/i,  // Revenue/legal impact
  /\b(spreadsheet|excel|google sheets|airtable|csv|export)\b/i,     // Manual data tool signal
  /\b(takes?\s+(hours?|all day|forever)|hours?\s+(of\s+)?wasted?)\b/i, // Time pain
  /\b(no (good |)?tool|no (good |)?solution|nothing (works?|exists?)|gap in)\b/i, // Gap signal
  /\b(paying for|per seat|per user|per month|subscription|license)\b/i, // Willingness to pay
  /\b(built (my own|an internal|a custom)|hacked together|workaround|duct tape)\b/i, // DIY signal
  /\b(team|multiple people|our whole team|everyone on the team)\b/i, // Scale signal
];

// ── 7. Promotional post detector (still penalize) ────────────────────────────

const PROMO_PATTERNS: RegExp[] = [
  /\b(check (this|it) out|product hunt|beta (users?|testers?)|early access|waitlist)\b/i,
  // Explicit pricing validation posts - must be first-person asking for WTP
  /\b(would you pay|would anyone pay|what.s the most you.?d pay|how much would you pay for this)\b/i,
  /\b(looking for (beta|feedback|users)|i('m| am) building)\b/i,
  // "I'm thinking/planning of building" - first-person builder signal only
  /\bi'?m (thinking of building|planning to build|considering building|about to build)\b/i,
  // "I built a tool/app" - tight match, only first-person with "I"
  /\bi (built|made|created|launched|released|shipped) (a |an |my |free |small |simple |custom |new )?(tool|app|bot|script|extension|plugin)\b/i,
  // "Built a tool..." titles (no leading "I") - still builder/promo posts
  /^built (a |an |my |something|this)/i,
  // Free trial / launch announcements
  /\b(free \d+-day (premium |pro )?trial|now in (testing|beta)|limited (beta|access)|sign up (bonus|reward))\b/i,
  // Referral / bonus posts
  /\b(referral (code|link|bonus)|sign.?up bonus|\$\d+ (bonus|reward|cashback) (for |when )?sign)\b/i,
  // "looking for X to test" - recruiting testers
  /\blooking for.{0,60}(to test|testers?|early users?)\b/i,
  // "DM me" to try/test
  /\b(dm me|message me|reach out).{0,40}(test|try|access|feedback)\b/i,
];

// ── Main scoring function ─────────────────────────────────────────────────────

export function scorePainSignal(
  title: string,
  body: string,
  subreddit: string,
  _pattern: string,
): number {
  const text = title + ' ' + body;

  // Stage 1: Subreddit hard reject
  if (NOISE_SUBS.has(subreddit)) return 0;
  // User-specific subreddits (r/u_username) are always self-promotional
  if (/^u_/i.test(subreddit)) return 0;

  // Stage 2: Content hard reject
  if (REJECT_CONTENT.some(re => re.test(text))) return 0;
  // Intro / welcome posts are never signals
  if (/\b(welcome to r\/|introduce yourself|read (first|before)|pinned post|community rules)\b/i.test(text)) return 0;

  // Stage 3: Business-context gate
  const subPrior = BUSINESS_SUB_PRIOR[subreddit] ?? 1.0;
  const businessHits = BUSINESS_CONTEXT.filter(re => re.test(text)).length;

  // Low-prior subreddit (general Reddit) with zero business signals → reject
  if (subPrior < 1.8 && businessHits === 0) return 0;

  // Stage 4: Base score
  let score = 3;

  // Business context signals (+1 each, up to +3)
  score += Math.min(3, businessHits);

  // Recurring process (+2 - the most important signal)
  if (RECURRING.some(re => re.test(text))) score += 2;

  // High-value specificity signals (+1 each, up to +3)
  const hvHits = HIGH_VALUE.filter(re => re.test(text)).length;
  score += Math.min(3, hvHits);

  // Promotional post → hard reject (not just a penalty - promos are never pain signals)
  if (PROMO_PATTERNS.some(re => re.test(text))) return 0;

  // Stage 5: Apply subreddit prior multiplier
  score = score * subPrior;

  return Math.max(0, Math.min(10, Math.round(score)));
}

// ── Downstream classifiers (unchanged interface) ──────────────────────────────

export const BUILDER_SUBS = new Set([
  'indiehackers', 'SaaS', 'startups', 'entrepreneur', 'SideProject',
  'webdev', 'programming', 'learnprogramming', 'buildinpublic',
  'microsaas', 'EntrepreneurRideAlong', 'growmybusiness', 'Entrepreneur',
  'smallbusiness_promotion', 'pitchme', 'RoastMyStartup', 'ProductHunters',
  'InternetIsBeautiful', 'made', 'IMadeThis', 'SomebodyMakeThis',
]);

export const VALIDATION_PHRASES = /\b(same|same here|me too|this exactly|i do this too|i have this problem|same problem|exactly this|manually every|spreadsheet for this|been doing this|years of doing|would pay|please build|someone build|still no solution|nothing (good|works)|no good (tool|app|solution)|stuck with|been waiting)\b/i;

export const SOLUTION_PHRASES = /\b(have you tried|you can use|check out|use \w|there('s| is) (already|a tool|an app|software)|i use \w|try \w|just use|look(ing)? into|found a (tool|solution|app)|already (exists|built|available)|you should (try|use|check)|look at \w+\s*(it|,|\.|\?|!))\b/i;
