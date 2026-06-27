import { prisma } from "./prisma";
import { accumulateHours, onShiftNow, type OnShiftEntry } from "./clock";
import { roundHours, type MemberSummary } from "./economy";

// Server-side reads for the economy/admin overview (§6.3). Pure shaping lives in
// `economy.ts`; this file is the part that touches the database. Everything is
// restaurant-scoped and read-only — it summarises append-only ClockEvents, it
// never mutates them.

export type DeviationRow = {
  id: string;
  userId: string;
  displayName: string;
  severity: "NONE" | "LOW" | "HIGH";
  status: "OPEN" | "REVIEWED" | "APPROVED";
  minutesDelta: number;
  direction: "IN" | "OUT" | null;
  /** Effective time of the stamp that triggered the flag, if any. */
  stampAt: string | null;
  /** The matched shift's relevant boundary, for "X min vs schedule" copy. */
  shiftStartsAt: string | null;
  shiftEndsAt: string | null;
  reason: string | null;
  createdAt: string;
};

export type EconomyOverview = {
  periodStart: string;
  periodEnd: string;
  members: MemberSummary[];
  deviations: DeviationRow[];
  onShift: OnShiftEntry[];
  totals: {
    totalHours: number;
    /** Open (unreviewed) deviations across the restaurant — the approval queue. */
    openDeviations: number;
    onShiftCount: number;
    staffCount: number;
    /** Activated = at least one credential registered (adoption, §6.3). */
    activatedCount: number;
  };
};

/** Build the owner's economy overview for one period: summed hours per member,
 *  the deviation queue, the realtime on-shift list, and headline totals. */
export async function getEconomyOverview(
  restaurantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<EconomyOverview> {
  const memberships = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null },
    select: {
      userId: true,
      user: {
        select: {
          displayName: true,
          _count: { select: { pinCredentials: true, webauthnCredentials: true } },
        },
      },
    },
    orderBy: { user: { displayName: "asc" } },
  });
  const userIds = memberships.map((m) => m.userId);

  // All stamps and deviations for the period, fetched once and grouped in memory
  // so we issue a constant number of queries regardless of headcount.
  const [events, deviations, onShift] = await Promise.all([
    prisma.clockEvent.findMany({
      where: {
        restaurantId,
        userId: { in: userIds },
        timestamp: { gte: periodStart, lt: periodEnd },
      },
      select: { userId: true, direction: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.deviation.findMany({
      where: {
        restaurantId,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { displayName: true } },
        clockEvent: { select: { direction: true, timestamp: true } },
      },
    }),
    onShiftNow(restaurantId),
  ]);

  const eventsByUser = new Map<string, { direction: "IN" | "OUT"; timestamp: Date }[]>();
  for (const e of events) {
    const list = eventsByUser.get(e.userId) ?? [];
    list.push({ direction: e.direction, timestamp: e.timestamp });
    eventsByUser.set(e.userId, list);
  }

  // Per-member deviation tallies for the period.
  const openByUser = new Map<string, number>();
  const reviewedByUser = new Map<string, number>();
  for (const d of deviations) {
    if (d.status === "OPEN") openByUser.set(d.userId, (openByUser.get(d.userId) ?? 0) + 1);
    else reviewedByUser.set(d.userId, (reviewedByUser.get(d.userId) ?? 0) + 1);
  }

  const shiftIds = deviations.map((d) => d.shiftId).filter((id): id is string => !!id);
  const shifts = shiftIds.length
    ? await prisma.shift.findMany({
        where: { id: { in: shiftIds } },
        select: { id: true, startsAt: true, endsAt: true },
      })
    : [];
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  const members: MemberSummary[] = memberships.map((m) => {
    const { hours, openSince } = accumulateHours(eventsByUser.get(m.userId) ?? []);
    const openDeviations = openByUser.get(m.userId) ?? 0;
    return {
      userId: m.userId,
      displayName: m.user.displayName,
      activated:
        m.user._count.pinCredentials > 0 || m.user._count.webauthnCredentials > 0,
      hours: roundHours(hours),
      openDeviations,
      reviewedDeviations: reviewedByUser.get(m.userId) ?? 0,
      hasUnreviewedDeviations: openDeviations > 0,
      openSince: openSince ? openSince.toISOString() : null,
    };
  });

  const deviationRows: DeviationRow[] = deviations.map((d) => {
    const shift = d.shiftId ? shiftById.get(d.shiftId) : undefined;
    return {
      id: d.id,
      userId: d.userId,
      displayName: d.user.displayName,
      severity: d.severity,
      status: d.status,
      minutesDelta: d.minutesDelta,
      direction: d.clockEvent?.direction ?? null,
      stampAt: d.clockEvent?.timestamp.toISOString() ?? null,
      shiftStartsAt: shift?.startsAt.toISOString() ?? null,
      shiftEndsAt: shift?.endsAt.toISOString() ?? null,
      reason: d.reason,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    members,
    deviations: deviationRows,
    onShift,
    totals: {
      totalHours: roundHours(members.reduce((sum, m) => sum + m.hours, 0)),
      openDeviations: deviations.filter((d) => d.status === "OPEN").length,
      onShiftCount: onShift.length,
      staffCount: memberships.length,
      activatedCount: members.filter((m) => m.activated).length,
    },
  };
}
