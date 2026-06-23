const BASE = "https://app.loops.so/api/v1";

function apiKey(): string {
  const key = process.env.LOOPS_API_KEY;
  if (!key) throw new Error("LOOPS_API_KEY is not set. Add it to .env.shared.");
  return key;
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Loops ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

async function del(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Loops ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export interface LoopsContactProps {
  /** The mailing list ID to subscribe the contact to. */
  mailingLists?: Record<string, boolean>;
  /** Any custom contact properties defined in your Loops account. */
  [key: string]: unknown;
}

/**
 * Create or update a contact. If the email already exists, Loops merges
 * the provided properties. Pass `mailingLists: { [listId]: true }` to
 * subscribe them to a specific list.
 */
export async function upsertContact(
  email: string,
  props: LoopsContactProps = {},
): Promise<void> {
  await post("/contacts/create", { email, ...props });
}

/**
 * Update properties on an existing contact (identified by email).
 */
export async function updateContact(
  email: string,
  props: LoopsContactProps,
): Promise<void> {
  await post("/contacts/update", { email, ...props });
}

/**
 * Delete a contact by email. Use for unsubscribes or account deletion.
 */
export async function deleteContact(email: string): Promise<void> {
  await del("/contacts/delete", { email });
}

/**
 * Send a Loops event for a contact. Events trigger automations configured
 * in the Loops dashboard (e.g. "weekly_rankings_sent").
 */
export async function sendEvent(
  email: string,
  eventName: string,
  eventProps?: Record<string, unknown>,
): Promise<void> {
  await post("/events/send", { email, eventName, eventProperties: eventProps ?? {} });
}

/**
 * Send a transactional email via Loops.
 * The `transactionalId` is the ID of the email template in Loops.
 */
export async function sendTransactional(opts: {
  email: string;
  transactionalId: string;
  dataVariables?: Record<string, string | number>;
}): Promise<void> {
  await post("/transactional", {
    email: opts.email,
    transactionalId: opts.transactionalId,
    dataVariables: opts.dataVariables ?? {},
  });
}
