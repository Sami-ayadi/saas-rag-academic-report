-- CreateTable
CREATE TABLE "ApiUsageMonthly" (
    "month" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastAggregatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageMonthly_pkey" PRIMARY KEY ("month", "userId", "type")
);

-- CreateIndex
CREATE INDEX "ApiUsageMonthly_month_idx" ON "ApiUsageMonthly"("month");
CREATE INDEX "ApiUsageMonthly_userId_idx" ON "ApiUsageMonthly"("userId");
