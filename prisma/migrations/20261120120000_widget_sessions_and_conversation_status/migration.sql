-- Conversation status: OPEN/PENDING/CLOSED -> WAITING/ACTIVE/AI_HANDLED/RESOLVED/CLOSED
--   OPEN with an assigned agent -> ACTIVE
--   OPEN without an agent       -> WAITING
--   PENDING                     -> WAITING
--   CLOSED                      -> CLOSED
ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_old";

CREATE TYPE "ConversationStatus" AS ENUM ('WAITING', 'ACTIVE', 'AI_HANDLED', 'RESOLVED', 'CLOSED');

ALTER TABLE "conversations" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "conversations" ALTER COLUMN "status" TYPE "ConversationStatus" USING (
  CASE
    WHEN "status"::text = 'OPEN' AND "assignedAgentId" IS NOT NULL THEN 'ACTIVE'
    WHEN "status"::text IN ('OPEN', 'PENDING') THEN 'WAITING'
    ELSE 'CLOSED'
  END
)::"ConversationStatus";

ALTER TABLE "conversations" ALTER COLUMN "status" SET DEFAULT 'WAITING';

DROP TYPE "ConversationStatus_old";

-- Guest visitor restore key (hash only)
ALTER TABLE "customers" ADD COLUMN "visitorKeyHash" TEXT;

CREATE UNIQUE INDEX "customers_visitorKeyHash_key" ON "customers"("visitorKeyHash");
