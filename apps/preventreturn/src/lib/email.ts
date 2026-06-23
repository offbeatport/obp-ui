import { env } from "./env";

export async function sendEmail(opts: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from ?? "PreventReturn <noreply@preventreturn.com>",
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(`Resend failed: ${err.message ?? res.statusText}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

export function buildInterventionEmailHtml(opts: {
  storeName: string;
  buyerFirstName: string;
  messageBody: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p style="margin-bottom: 16px;">Hi ${opts.buyerFirstName},</p>
  <p style="margin-bottom: 24px; line-height: 1.6;">${opts.messageBody}</p>
  <p style="color: #666; font-size: 13px;">- The ${opts.storeName} team</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 11px;">
    You're receiving this because you placed an order with ${opts.storeName}.
    Reply to this email to respond.
  </p>
</body>
</html>`;
}
