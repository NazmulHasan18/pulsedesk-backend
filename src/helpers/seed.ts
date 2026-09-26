import bcrypt from "bcrypt";
import env from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export async function seed() {
  const email = env.SEED_SUPERADMIN_EMAIL || "superadmin@pulsedesk.dev";
  const password = env.SEED_SUPERADMIN_PASSWORD || "ChangeMe123!";

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super-admin already exists: ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.superAdmin.create({
    data: {
      name: "Platform Super Admin",
      email,
      password: hashedPassword,
    },
  });

  console.log(`✅ Super-admin seeded: ${email} (password: ${password})`);
  console.log("⚠️  Change this password immediately in a real environment.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
