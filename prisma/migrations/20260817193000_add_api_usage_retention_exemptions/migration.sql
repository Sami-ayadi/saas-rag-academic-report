-- AlterTable
ALTER TABLE "ApiUsage"
ADD COLUMN "retentionExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "retentionReason" TEXT,
ADD COLUMN "retentionMarkedAt" TIMESTAMP(3),
ADD COLUMN "retentionMarkedBy" TEXT;

-- CreateIndex
CREATE INDEX "ApiUsage_retentionExempt_createdAt_idx" ON "ApiUsage"("retentionExempt", "createdAt");
