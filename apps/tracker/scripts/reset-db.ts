/**
 * Drops all Sentri tracker tables and recreates them via drizzle schema push.
 * Run with: yarn db:reset  (from apps/tracker)
 */
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const TABLES = [
  "agent_logs",
  "positions",
  "products",
  "pool_snapshots",
  "indexer_state",
];

const sql = postgres(DATABASE_URL);

async function main() {
  console.log("Dropping all tables...");
  for (const table of TABLES) {
    await sql`DROP TABLE IF EXISTS ${sql(table)} CASCADE`;
    console.log(`  dropped: ${table}`);
  }
  await sql.end();
  console.log("Done. Run `yarn db:push` to recreate the schema.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
