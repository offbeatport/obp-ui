import { db } from '../src/db/index.js';
import { signals } from '../src/db/schema.js';
import { like, and, eq } from 'drizzle-orm';

async function main() {
  const toDelete = await db.select({ id: signals.id, rawText: signals.rawText })
    .from(signals)
    .where(and(eq(signals.source, 'hn'), like(signals.rawText, 'Show HN:%')));

  console.log(`Found ${toDelete.length} Show HN signals`);
  toDelete.forEach(s => console.log(' -', s.rawText.slice(0, 80)));

  if (toDelete.length > 0) {
    await db.delete(signals)
      .where(and(eq(signals.source, 'hn'), like(signals.rawText, 'Show HN:%')));
    console.log(`Deleted ${toDelete.length} signals.`);
  } else {
    console.log('Nothing to delete.');
  }
}

main().catch(console.error);
