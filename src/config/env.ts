import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,

  DATABASE_URL: process.env.DATABASE_URL as string,

  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",

  SEED_SUPERADMIN_EMAIL: process.env.SEED_SUPERADMIN_EMAIL || "superadmin@pulsedesk.dev",
  SEED_SUPERADMIN_PASSWORD: process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMe123!",

  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};

export default env;
