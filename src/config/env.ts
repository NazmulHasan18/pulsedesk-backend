import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const commaList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).default(12),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // Signs anonymous widget visitor sessions. Kept separate from the agent
  // secrets so a widget token can never be accepted as an agent token (or vice versa).
  WIDGET_SESSION_SECRET: z.string().min(16, "WIDGET_SESSION_SECRET must be at least 16 characters"),
  WIDGET_SESSION_EXPIRES_IN: z.string().default("24h"),

  SEED_SUPERADMIN_EMAIL: z.string().email().default("superadmin@pulsedesk.dev"),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),

  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  // Comma-separated list of origins allowed to open socket connections.
  // Falls back to CLIENT_URL when not set.
  CORS_ORIGINS: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${problems.join("\n")}`);
  throw new Error("Invalid environment configuration");
}

const env = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS ? commaList(parsed.data.CORS_ORIGINS) : [parsed.data.CLIENT_URL],
};

export default env;
