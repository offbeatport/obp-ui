# ReportFuse

## Niche

Marketing analysts and PPC managers who spend 10–15h/week normalizing CSV exports from multiple ad platforms before they can do any actual analysis.

## Pain post

https://www.reddit.com/r/analytics/comments/[thread]/tired_of_manual_data_cleaning_need_reporting_automation/

"I spend about 15 hours a week just cleaning and merging CSVs from different marketing platforms before I can even start my actual analysis. I've tried building my own ETL pipeline, but the maintenance is becoming a second full-time job."

22 upvotes. Multiple echoes: "Following, I have the same challenge." Key validation: they tried DIY ETL and it broke because platform column names change silently - which is the root problem this tool fixes.

## Loop & monetization

- Retention loop: every normalization run re-exposes the tool; shared CSV outputs include "Normalized with ReportFuse" footer attribution; team invites when an analyst shares the output with their manager
- Monetization moment: after the 3rd free run (anon) - paywall is the save + history features, not the normalization itself
- Archetype: tool-first
- Style + Radius: Azure / Sharp - analytics/B2B audience; sharp edges communicate precision

## V1 features

- Multi-file CSV upload (drag-and-drop or browse)
- AI semantic column mapping via LLM (OpenRouter/Gemini Flash) - understands meaning, not just column names
- Heuristic fallback when LLM is unavailable
- Platform auto-detection from file name + header fingerprints (Google Ads, Meta, TikTok, LinkedIn, X, Snapchat, Pinterest, GA4)
- Canonical schema output: date, platform, campaign, adset, ad, spend, impressions, clicks, cpc, ctr, conversions, roas
- Column mapping summary (what mapped to what, what was skipped)
- Clean merged CSV download
- 10-row preview table with formatted numbers
- Rate limiting: 3 runs/day anon, 10/day free, 1000/day paid
- Run history persisted to SQLite

## Out of scope

ReportFuse normalizes and merges marketing platform CSV exports using AI semantic column matching. It will NOT connect to platform APIs, replace a BI tool, schedule automated runs, or support non-CSV formats in V1.

## Risks

- AnalityQa.com exists in adjacent space - mitigation: ReportFuse differentiates on output ownership (you download a CSV you own), semantic drift-resilience, and no locked-in query sandbox
- LLM cost per run - mitigation: Gemini Flash is ~$0.00015/1k tokens; a 20-header mapping prompt is < 500 tokens = $0.0001/run; acceptable at $49/mo pricing

## Distribution

- Reddit r/analytics, r/PPC, r/FacebookAds - direct reply to pain threads with tool URL
- SEO: "merge google ads meta ads csv", "marketing csv normalize tool" - low competition, high buyer intent
- AppSumo lifetime deal - validates willingness-to-pay, seeds 300–600 early users

## Success signal at 12 months

≥ 50 paying users at $29–49/mo

## Review cadence

Monthly glance at a one-page dashboard (revenue + MAU + organic impressions). The factory is "build once, maintain never" - the review is for signal, not triage.

An app becomes a candidate for deletion only when all four hold:

- ≥ 12 months since launch
- zero paying users for the last 90 days
- zero organic search impressions for the last 90 days
- hosting cost > $0 in observable value
