import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import env from "../src/config/env.js";

const prisma = new PrismaClient();

async function main() {
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
