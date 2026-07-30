-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "readByAgentAt" TIMESTAMP(3),
ADD COLUMN     "readByCustomerAt" TIMESTAMP(3);
