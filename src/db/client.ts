import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/webhook_pipeline";

console.log("Connecting to DB:", connectionString);

const pool = new Pool({
  connectionString,
  ssl: false,
});

export const db = drizzle(pool, { schema });
