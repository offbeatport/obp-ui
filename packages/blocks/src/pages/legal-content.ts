/**
 * Canonical legal copy shared across every offbeatport app. Single source of
 * truth - edit here, every app picks up the change on its next deploy.
 *
 * The text is intentionally generic micro-SaaS legal boilerplate. Real apps
 * dealing with regulated data (medical, financial, EU users at scale) MUST
 * have these reviewed by a lawyer; the templates are good-faith starters,
 * not legal advice.
 *
 * Per-app placeholders (e.g. `{appName}`) are filled in by the page wrappers.
 */

export interface LegalCopyVars {
  appName: string;
  contactEmail: string;
  /** Country/jurisdiction governing the agreement, e.g. "Romania". */
  governingLaw?: string;
  /** Date the current text became effective. ISO YYYY-MM-DD. */
  effectiveDate?: string;
}

const fill = (template: string, vars: LegalCopyVars) =>
  template
    .replaceAll("{appName}", vars.appName)
    .replaceAll("{contactEmail}", vars.contactEmail)
    .replaceAll("{governingLaw}", vars.governingLaw ?? "the European Union")
    .replaceAll("{effectiveDate}", vars.effectiveDate ?? "2026-05-05");

/** Short version that fits in a footer / sentence. */
export const PRIVACY_SUMMARY =
  "We collect the minimum data needed to operate the service, never sell it, and let you delete it any time.";

export const TERMS_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "Acceptance of terms",
    body: "By accessing or using {appName} you agree to these Terms. If you do not agree, do not use the service. We may update these Terms; continued use after changes constitutes acceptance.",
  },
  {
    title: "Eligibility",
    body: "You must be at least 16 years old (or the age of digital consent in your jurisdiction) and able to form a binding contract to use {appName}.",
  },
  {
    title: "Your account",
    body: "You are responsible for safeguarding your credentials and for any activity under your account. Notify us at {contactEmail} immediately if you believe your account has been compromised.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to: (a) reverse-engineer, scrape, or abuse the service; (b) upload unlawful, infringing, or harmful content; (c) attempt to gain unauthorized access; (d) use the service to harass others or send spam.",
  },
  {
    title: "Subscription and billing",
    body: "Paid plans are billed in advance on a recurring basis until canceled. You can cancel any time from your account settings; cancellations take effect at the end of the current billing period. Refunds are at our discretion and generally not provided for partial periods.",
  },
  {
    title: "Intellectual property",
    body: "{appName}, including its software, design, and content we publish, is owned by us or our licensors. You retain ownership of content you create using the service; you grant us a limited license to host and display it as needed to operate the service.",
  },
  {
    title: "Termination",
    body: "We may suspend or terminate your access if you breach these Terms or use the service in a way that creates risk for us or other users. You may terminate at any time by deleting your account.",
  },
  {
    title: "Disclaimers",
    body: 'The service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted availability, error-free operation, or that the service will meet your specific requirements.',
  },
  {
    title: "Limitation of liability",
    body: "To the maximum extent permitted by law, our total liability for any claim arising from your use of the service is limited to the amount you paid us in the twelve months preceding the claim. We are not liable for indirect, consequential, or incidental damages.",
  },
  {
    title: "Governing law",
    body: "These Terms are governed by the laws of {governingLaw}, without regard to conflict-of-laws principles. Disputes will be resolved in the competent courts of that jurisdiction.",
  },
  {
    title: "Contact",
    body: "Questions about these Terms? Email {contactEmail}.",
  },
];

export const PRIVACY_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: "Who we are",
    body: "{appName} is operated by us. This policy explains what data we collect, why, and how you can control it. Questions: {contactEmail}.",
  },
  {
    title: "Data we collect",
    body: "Account data (email, hashed password) when you sign up. Usage data (pages visited, actions taken) for product analytics. Billing data via our payment processor - we never see your card details. Server logs (IP address, user agent) for security and debugging, retained for 30 days.",
  },
  {
    title: "Why we collect it",
    body: "To provide the service, prevent abuse, improve the product, and meet legal obligations. We do not sell your data, and we do not use it to train external AI models.",
  },
  {
    title: "Cookies",
    body: "We use a session cookie to keep you signed in and a small set of analytics cookies (PostHog) to understand product usage. We do not use third-party advertising cookies.",
  },
  {
    title: "Sub-processors",
    body: "We share data with: our hosting provider (server infrastructure), Polar.sh (billing), Resend (transactional email), PostHog (product analytics), Sentry (error monitoring). Each is bound by their own privacy and data-protection commitments.",
  },
  {
    title: "Your rights",
    body: "You can access, export, correct, or delete your data at any time from your account settings. EU/UK users have rights under GDPR including the right to object to processing and the right to lodge a complaint with a supervisory authority. To exercise any right, email {contactEmail}.",
  },
  {
    title: "Data retention",
    body: "Account data is kept while your account is active and for 90 days after deletion (to handle disputes and meet legal obligations). Anonymized analytics may be retained longer.",
  },
  {
    title: "International transfers",
    body: "Our infrastructure is in {governingLaw}. Some sub-processors may transfer data outside this region under standard contractual clauses or equivalent safeguards.",
  },
  {
    title: "Security",
    body: "We use industry-standard encryption in transit (TLS) and at rest where applicable. We restrict internal access to data to those who need it. No system is perfectly secure - we will notify affected users if a breach materially affecting their data occurs.",
  },
  {
    title: "Changes",
    body: "We may update this policy. Material changes will be announced by email to active users at least 14 days before they take effect. The current version is dated {effectiveDate}.",
  },
];

/** Apply the per-app variables to a section list. */
export function fillSections(
  sections: Array<{ title: string; body: string }>,
  vars: LegalCopyVars,
): Array<{ title: string; body: string }> {
  return sections.map((s) => ({
    title: fill(s.title, vars),
    body: fill(s.body, vars),
  }));
}
