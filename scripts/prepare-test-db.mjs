// Creates the test database (if missing) and applies all migrations to it.
// Usage: pnpm test:db   (reads .env, then .env.test overrides)
import { execSync } from "node:child_process";
import fs from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

const loadFile = (file) => (fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {});
const testEnv = { ...loadFile(".env"), ...loadFile(".env.test") };

const url = testEnv.DIRECT_URL || testEnv.DATABASE_URL;
if (!url || !fs.existsSync(".env.test")) {
  console.error("Missing .env.test - copy .env.test.example to .env.test first.");
  process.exit(1);
}

const target = new URL(url);
const dbName = target.pathname.slice(1);
if (!dbName.endsWith("_test")) {
  console.error(`Refusing to prepare "${dbName}": the test database name must end with _test.`);
  process.exit(1);
}

const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";

const client = new pg.Client({ connectionString: adminUrl.toString() });
await client.connect();
const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
if (rowCount === 0) {
  await client.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Created database ${dbName}`);
}
await client.end();

execSync("pnpm exec prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL, DIRECT_URL: url },
});
