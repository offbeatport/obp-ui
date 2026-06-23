import { format, formatDistanceToNowStrict } from "date-fns";

export function formatDate(
  value: Date | string | number,
  pattern = "MMM d, yyyy",
): string {
  const d = value instanceof Date ? value : new Date(value);
  return format(d, pattern);
}

export function formatRelativeTime(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export interface FormatCurrencyOptions {
  currency?: string;
  locale?: string;
  /** Display 19.99 as "$19.99" (default) or "$20" by overriding minFraction. */
  minFraction?: number;
  maxFraction?: number;
}

export function formatCurrency(
  amount: number,
  opts: FormatCurrencyOptions = {},
): string {
  const {
    currency = "USD",
    locale = "en-US",
    minFraction = 2,
    maxFraction = 2,
  } = opts;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  }).format(amount);
}

export interface FormatNumberOptions {
  locale?: string;
  minFraction?: number;
  maxFraction?: number;
  /** "1,234" → "1.2k" when true. */
  compact?: boolean;
}

export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
  const {
    locale = "en-US",
    minFraction = 0,
    maxFraction = 2,
    compact = false,
  } = opts;
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
  }).format(value);
}
