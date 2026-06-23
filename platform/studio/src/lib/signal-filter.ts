/**
 * Shared signal quality filter.
 * Applied at scrape time - before signals hit the DB.
 * Blocks solution launches, announcements, and self-promotion noise.
 */

const SOLUTION_PATTERNS: RegExp[] = [
  // Show HN / Launch HN / Telling HN
  /^show hn:/i,
  /^launch hn:/i,
  /^tell hn:/i,

  // "I built / we built / I made / I created"
  /\b(i|we)\s+(built|made|created|wrote|developed|launched|released|shipped|open[- ]sourced)\b/i,

  // Launch announcements
  /\bjust\s+(launched|released|shipped|open[- ]sourced)\b/i,
  /\bnow\s+(live|available|launched|released)\b/i,
  /\bwe('re| are)\s+(launching|releasing|shipping|announcing)\b/i,
  /\blaunching\s+today\b/i,
  /\btoday\s+we('re| are)\s+(launching|releasing|shipping)\b/i,
  /\bintroducing\b.*\bwe\b/i,
  /\bannouncing\b.*\b(new|our|the)\b/i,
  /\bproud to (announce|share|present)\b/i,

  // "My new / our new X"
  /\b(my|our)\s+new\s+(app|tool|product|project|saas|startup|service|platform|library|package)\b/i,

  // Product Hunt specific
  /\bjust\s+posted\s+on\s+product hunt\b/i,
  /\bwe('re| are)\s+live\s+on\s+product hunt\b/i,
  /\bhunted\b/i,

  // Release / version announcements
  /\bv\d+\.\d+\s+(is\s+)?(out|released|live|here)\b/i,
  /\bversion\s+\d+\s+(is\s+)?(out|released|live|here)\b/i,

  // GitHub repo self-promotion
  /\bstar\s+us\s+on\s+github\b/i,
  /\bcheck\s+out\s+(my|our)\s+(github|repo|repository|project)\b/i,
];

export function isSolutionSignal(text: string): boolean {
  // Only scan the first 300 chars - launch language is always up front
  const head = text.slice(0, 300);
  return SOLUTION_PATTERNS.some((p) => p.test(head));
}
