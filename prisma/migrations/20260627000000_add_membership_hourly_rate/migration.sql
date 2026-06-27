-- §8.2 payroll draft: per-employee base hourly rate (kr/h). Nullable and
-- backward-compatible — existing memberships keep NULL until a rate is set.
ALTER TABLE "Membership" ADD COLUMN "hourlyRate" DECIMAL(10,2);
