import fs from "node:fs";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

const loadFile = (file: string) => (fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {});

// .env supplies secrets; .env.test points the run at the separate test database.
const testEnv = { ...loadFile(".env"), ...loadFile(".env.test"), NODE_ENV: "test" };

if (!testEnv.DATABASE_URL?.includes("_test")) {
  throw new Error("Tests must run against a *_test database. Create .env.test from .env.test.example.");
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: testEnv,
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
