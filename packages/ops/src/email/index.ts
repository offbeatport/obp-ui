import { Resend } from "resend";

let _resend: Resend | null = null;

/**
 * Lazy Resend client. Reads `RESEND_API_KEY` from `.env.shared` (one
 * key for the whole portfolio). Per-app FROM addresses come from each
 * call site, not from env.
 */
export function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set. Add it to the monorepo .env.shared.",
      );
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface SendEmailOptions {
  /** Verified sender, e.g. "Demo <hi@demo.example>". */
  from: string;
  /** One or many recipients. */
  to: string | string[];
  subject: string;
  /** HTML body. Provide either `html` or `text` (or both). */
  html?: string;
  /** Plain-text body. */
  text?: string;
  /** Reply-to override. */
  replyTo?: string | string[];
  /** Tag pairs for Resend analytics. */
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id: string;
}

/**
 * Send a transactional email. Throws if Resend rejects (invalid key,
 * unverified domain, malformed payload). Catch and translate to a
 * user-friendly error at the call site if needed.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  if (!opts.html && !opts.text) {
    throw new Error("sendEmail: at least one of `html` or `text` is required.");
  }
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html ?? "",
    text: opts.text,
    replyTo: opts.replyTo,
    tags: opts.tags,
  } as Parameters<typeof resend.emails.send>[0]);

  if (error) {
    throw new Error(`Resend error: ${error.name} - ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend returned no message id.");
  }
  return { id: data.id };
}

export { Resend };
