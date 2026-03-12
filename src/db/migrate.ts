import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5433/webhook_pipeline";

  console.log("Running migrations with:", connectionString);

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  console.log("Migrations completed");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
