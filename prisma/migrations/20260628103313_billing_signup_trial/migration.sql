-- AlterEnum
ALTER TYPE "CodePurpose" ADD VALUE 'SIGNUP';

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "trialReminderSentAt" TIMESTAMP(3);
