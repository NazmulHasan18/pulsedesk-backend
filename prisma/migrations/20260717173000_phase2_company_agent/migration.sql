-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
