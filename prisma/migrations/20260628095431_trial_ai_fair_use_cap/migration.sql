-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "trialAiCallCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialAiFlaggedAt" TIMESTAMP(3);
