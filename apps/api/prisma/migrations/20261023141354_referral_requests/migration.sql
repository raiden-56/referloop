-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFERRED', 'DECLINED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_UPDATED';

-- CreateTable
CREATE TABLE "referral_requests" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "referrerId" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "profileUrl" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_requests_referrerId_status_createdAt_idx" ON "referral_requests"("referrerId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "referral_requests_requesterId_createdAt_idx" ON "referral_requests"("requesterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "referral_requests_jobId_requesterId_status_idx" ON "referral_requests"("jobId", "requesterId", "status");

-- AddForeignKey
ALTER TABLE "referral_requests" ADD CONSTRAINT "referral_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_requests" ADD CONSTRAINT "referral_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_requests" ADD CONSTRAINT "referral_requests_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
