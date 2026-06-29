-- CreateEnum
CREATE TYPE "ShiftInterestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'SWAP_NEEDS_REPLY', 'SWAP_ACCEPTED', 'SWAP_APPROVED', 'SWAP_ESCALATED', 'INTEREST_REJECTED', 'DEVIATION_DIGEST');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ACTIONED');

-- AlterTable: Shift gains `slots` (multi-slot shifts); existing rows default
-- to 1 (their one existing assignee, if any).
ALTER TABLE "Shift" ADD COLUMN "slots" INTEGER NOT NULL DEFAULT 1;

-- CreateTable: ShiftAssignment replaces the single Shift.assignedUserId.
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_shiftId_userId_key" ON "ShiftAssignment"("shiftId", "userId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_userId_idx" ON "ShiftAssignment"("userId");

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing single assignment becomes one ShiftAssignment row
-- before the old column is dropped. Nothing is lost.
INSERT INTO "ShiftAssignment" ("id", "shiftId", "userId", "createdAt")
SELECT substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24), "id", "assignedUserId", "createdAt"
FROM "Shift"
WHERE "assignedUserId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_assignedUserId_fkey";

-- AlterTable: drop the now-replaced single-assignee column.
ALTER TABLE "Shift" DROP COLUMN "assignedUserId";

-- AlterTable: ShiftInterest gains a status instead of being deleted when a
-- shift fills (so a rejected candidate can be surfaced + notified, not just
-- silently removed).
ALTER TABLE "ShiftInterest" ADD COLUMN "status" "ShiftInterestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable: in-app notification feed, additive to the existing SMS/e-mail
-- sends in notify.ts.
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "restaurantName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "count" INTEGER,
    "relatedShiftId" TEXT,
    "relatedSwapId" TEXT,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
