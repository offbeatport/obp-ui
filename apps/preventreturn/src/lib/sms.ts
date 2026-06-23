import { env } from "./env";

export async function sendSMS(to: string, body: string): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams({
    To: to,
    From: env.TWILIO_FROM_NUMBER,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(`Twilio SMS failed: ${err.message ?? res.statusText}`);
  }

  const data = await res.json() as { sid: string };
  return data.sid;
}
