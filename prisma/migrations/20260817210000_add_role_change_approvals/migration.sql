-- CreateEnum
CREATE TYPE "RoleChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RoleChangeRequest" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "currentRole" "Role" NOT NULL,
    "requestedRole" "Role" NOT NULL,
    "status" "RoleChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleChangeRequest_status_createdAt_idx" ON "RoleChangeRequest"("status", "createdAt");
CREATE INDEX "RoleChangeRequest_targetUserId_idx" ON "RoleChangeRequest"("targetUserId");
CREATE INDEX "RoleChangeRequest_requestedById_idx" ON "RoleChangeRequest"("requestedById");
