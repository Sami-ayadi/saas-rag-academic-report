ALTER TYPE "public"."JobStatus" ADD VALUE IF NOT EXISTS 'RETRY_WAIT';
ALTER TYPE "public"."JobStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INPUT';

ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'SOURCES_READY';
ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'BRIEF_APPROVED';
ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'OUTLINE_APPROVED';
ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'DRAFTING';
ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
ALTER TYPE "public"."ProjectStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

CREATE TYPE "public"."ReportPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "public"."QuotaReservationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

ALTER TABLE "public"."User" ADD COLUMN "university" TEXT;

ALTER TABLE "public"."Document"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'PROJECT_EVIDENCE',
  ADD COLUMN "pageCount" INTEGER,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "extractionError" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "public"."Report"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "qualityIssues" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "public"."GenerationJob"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "contextHash" TEXT,
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "lockedBy" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "quotaPeriod" TEXT;

ALTER TABLE "public"."Embedding"
  ADD COLUMN "pageNumber" INTEGER,
  ADD COLUMN "locator" TEXT;

CREATE TABLE "public"."ReportPlan" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "templateKey" TEXT NOT NULL DEFAULT 'software-classic-v1',
  "content" JSONB NOT NULL,
  "status" "public"."ReportPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ExportArtifact" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."QuotaReservation" (
  "id" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "public"."QuotaReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuotaReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportPlan_projectId_version_key" ON "public"."ReportPlan"("projectId", "version");
CREATE INDEX "ReportPlan_briefId_idx" ON "public"."ReportPlan"("briefId");
CREATE INDEX "ReportPlan_projectId_status_idx" ON "public"."ReportPlan"("projectId", "status");
CREATE INDEX "ExportArtifact_reportId_createdAt_idx" ON "public"."ExportArtifact"("reportId", "createdAt");
CREATE UNIQUE INDEX "QuotaReservation_operationKey_key" ON "public"."QuotaReservation"("operationKey");
CREATE INDEX "QuotaReservation_userId_period_kind_idx" ON "public"."QuotaReservation"("userId", "period", "kind");
CREATE INDEX "GenerationJob_status_nextAttemptAt_createdAt_idx" ON "public"."GenerationJob"("status", "nextAttemptAt", "createdAt");
CREATE UNIQUE INDEX "GenerationJob_userId_idempotencyKey_key" ON "public"."GenerationJob"("userId", "idempotencyKey");
CREATE INDEX "Embedding_projectId_documentId_chunkIndex_idx" ON "public"."Embedding"("projectId", "documentId", "chunkIndex");

ALTER TABLE "public"."ReportPlan" ADD CONSTRAINT "ReportPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReportPlan" ADD CONSTRAINT "ReportPlan_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "public"."ProjectBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."ReportPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Embedding" ADD CONSTRAINT "Embedding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ExportArtifact" ADD CONSTRAINT "ExportArtifact_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."QuotaReservation" ADD CONSTRAINT "QuotaReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
