import { db } from "../db/client";
import { appSettings } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const row = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row[0]?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

export async function getRankingsLimit(): Promise<number> {
  const val = await getSetting("rankings_limit", "10");
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}
