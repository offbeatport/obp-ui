import { db } from '../src/db/index.js';
import { signals } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function main() {
  const rows = await db.select({
    source: signals.source,
    count: sql<number>`count(*)`.as('count'),
  }).from(signals).groupBy(signals.source).orderBy(sql`count(*) desc`);

  console.log('\nSignals per source:');
  for (const r of rows) {
    console.log(`  ${r.source.padEnd(15)} ${r.count}`);
  }
}
main().catch(console.error);
