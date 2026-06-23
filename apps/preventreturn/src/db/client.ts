import { createDb } from "@offbeatport/db";
import {
  merchants,
  merchantSettings,
  orders,
  interventions,
  messages,
  PREVENTSHIP_TABLES_SQL,
} from "./schema";

const tableSchema = { merchants, merchantSettings, orders, interventions, messages };

const { db, sqlite, runMigrations } = createDb({
  schema: tableSchema,
  extraMigrations: PREVENTSHIP_TABLES_SQL,
});

export { db, sqlite, runMigrations };
