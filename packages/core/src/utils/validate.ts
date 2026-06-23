/**
 * Lightweight format checks for places where pulling in zod is
 * overkill (e.g. quick guards inside server handlers, hot loops).
 * For form validation, prefer zod schemas.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value);
}

export function isUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
