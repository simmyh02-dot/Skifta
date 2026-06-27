import { prisma } from "../prisma";
import { computeDraft, pairIntervals, type PayrollDraft } from "./engine";
import { presetById, type ObRuleSet } from "./rules";

// Server-side reads/writes for the §8.2 payroll draft. The engine (engine.ts) is
// pure; this file is the database-touching part. It reads append-only stamps and
// per-employee rates, runs the deterministic engine, and — only on an explicit
// owner approval — persists a PayrollPeriodSummary. The summary stores the
// transparent line breakdown so it traces back to the rules and stamps (§8.2).

export type MemberDraft = {
  userId: string;
  name: string;
  rate: number | null;
  missingRate: boolean;
  unreviewed: boolean; // open deviation in the period (blocks silent approval, §6.3)
  draft: PayrollDraft;
};

export type PayrollPreview = {
  ruleSet: { id: string; name: string };
  members: MemberDraft[];
};

/** The restaurant's active OB ruleset, reconstructed from the stored preset, or
 *  the honest 'none' default until one is chosen. */
export async function getActiveRuleSet(restaurantId: string): Promise<ObRuleSet> {
  const row = await prisma.oBRuleSet.findFirst({
    where: { restaurantId, isActive: true },
    orderBy: { version: "desc" },
  });
  if (!row) return presetById("none");
  // `rules` holds the serialised ObRuleSet (id/name/windows/overtime).
  const rules = row.rules as unknown as ObRuleSet;
  return { ...rules, name: row.name };
}

/** Compute a draft per active member for the period. Read-only — this is the
 *  "suggest" half of suggest → confirm → write (§8). Nothing is persisted. */
export async function buildPayrollDrafts(
  restaurantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PayrollPreview> {
  const ruleSet = await getActiveRuleSet(restaurantId);

  const memberships = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null },
    select: { userId: true, hourlyRate: true, user: { select: { displayName: true } } },
    orderBy: { user: { displayName: "asc" } },
  });
  const userIds = memberships.map((m) => m.userId);

  const [events, openDeviations] = await Promise.all([
    prisma.clockEvent.findMany({
      where: { restaurantId, userId: { in: userIds }, timestamp: { gte: periodStart, lt: periodEnd } },
      select: { id: true, userId: true, direction: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.deviation.findMany({
      where: { restaurantId, status: "OPEN", createdAt: { gte: periodStart, lt: periodEnd } },
      select: { userId: true },
    }),
  ]);

  const eventsByUser = new Map<string, { id: string; direction: "IN" | "OUT"; timestamp: Date }[]>();
  for (const e of events) {
    const list = eventsByUser.get(e.userId) ?? [];
    list.push({ id: e.id, direction: e.direction, timestamp: e.timestamp });
    eventsByUser.set(e.userId, list);
  }
  const unreviewedUsers = new Set(openDeviations.map((d) => d.userId));

  const members: MemberDraft[] = memberships.map((m) => {
    const rate = m.hourlyRate != null ? Number(m.hourlyRate) : null;
    const intervals = pairIntervals(eventsByUser.get(m.userId) ?? []);
    // With no rate yet, still show hours/OB; gross is left at 0 and flagged.
    const draft = computeDraft(intervals, rate ?? 0, ruleSet);
    return {
      userId: m.userId,
      name: m.user.displayName,
      rate,
      missingRate: rate == null,
      unreviewed: unreviewedUsers.has(m.userId),
      draft,
    };
  });

  return { ruleSet: { id: ruleSet.id, name: ruleSet.name }, members };
}

/** The "confirm → write" half (§8). Recomputes server-side (never trusts client
 *  numbers) and writes an APPROVED PayrollPeriodSummary per cleared member, with
 *  the transparent line breakdown. Members with an unreviewed deviation are
 *  skipped — unreviewed flags never enter an approved underlag silently (§6.3).
 *  Returns who was written and who was held back. */
export async function approvePayroll(
  restaurantId: string,
  approvedById: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ approved: string[]; skipped: { userId: string; reason: "unreviewed" | "missing_rate" }[] }> {
  const preview = await buildPayrollDrafts(restaurantId, periodStart, periodEnd);
  const ruleSetRow = await prisma.oBRuleSet.findFirst({
    where: { restaurantId, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  const approved: string[] = [];
  const skipped: { userId: string; reason: "unreviewed" | "missing_rate" }[] = [];

  for (const m of preview.members) {
    if (m.unreviewed) {
      skipped.push({ userId: m.userId, reason: "unreviewed" });
      continue;
    }
    if (m.missingRate) {
      skipped.push({ userId: m.userId, reason: "missing_rate" });
      continue;
    }
    await prisma.payrollPeriodSummary.upsert({
      where: {
        restaurantId_userId_periodStart_periodEnd: {
          restaurantId,
          userId: m.userId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        restaurantId,
        userId: m.userId,
        periodStart,
        periodEnd,
        baseHours: m.draft.baseHours,
        obHours: m.draft.obHours,
        grossAmount: m.draft.grossAmount,
        status: "APPROVED",
        hasUnreviewedDeviations: false,
        lineItems: m.draft.lines as unknown as object,
        obRuleSetId: ruleSetRow?.id ?? null,
        approvedById,
        approvedAt: new Date(),
      },
      update: {
        baseHours: m.draft.baseHours,
        obHours: m.draft.obHours,
        grossAmount: m.draft.grossAmount,
        status: "APPROVED",
        hasUnreviewedDeviations: false,
        lineItems: m.draft.lines as unknown as object,
        obRuleSetId: ruleSetRow?.id ?? null,
        approvedById,
        approvedAt: new Date(),
      },
    });
    approved.push(m.userId);
  }

  return { approved, skipped };
}
