import { createDb } from "@offbeatport/microsaas-core/db";
import { USAGE_DAY_SQL } from "@offbeatport/microsaas-core/rate-limit";

const { db, sqlite } = createDb({
  extraMigrations: USAGE_DAY_SQL,
});

export { db, sqlite };
