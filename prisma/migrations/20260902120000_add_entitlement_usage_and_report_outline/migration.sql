ALTER TABLE "Report" ADD COLUMN "outline" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "EntitlementUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EntitlementUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntitlementUsage_userId_period_kind_key" ON "EntitlementUsage"("userId", "period", "kind");
CREATE INDEX "EntitlementUsage_userId_period_idx" ON "EntitlementUsage"("userId", "period");
ALTER TABLE "EntitlementUsage" ADD CONSTRAINT "EntitlementUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
