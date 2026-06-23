/**
 * URL-safe slug. Lowercases, strips diacritics, replaces non-alphanum
 * with `-`, collapses repeats, trims leading/trailing dashes.
 */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

/**
 * Cap a string to `max` chars, appending `suffix` if it had to cut.
 * Counts the suffix toward `max` so the visible width stays bounded.
 */
export function truncate(input: string, max: number, suffix = "…"): string {
  if (input.length <= max) return input;
  return input.slice(0, Math.max(0, max - suffix.length)) + suffix;
}
