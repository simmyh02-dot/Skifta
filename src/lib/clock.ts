import type { ClockDirection, ClockEvent, VerificationMethod } from "@prisma/client";
import { prisma } from "./prisma";
import {
  minutesDelta,
  severityForStamp,
  gradeDeviation,
  type ToleranceConfig,
} from "./deviations";

// Clock-in core (§6.2). The one rule that outranks everything here: ClockEvent
// is APPEND-ONLY (§9, §13). We never update or delete one — a stamp is a fact
// that happened. Corrections live in ClockEventAdjustment. `clientId` makes the
// write idempotent so the offline queue can replay a stamp without ever
// creating a duplicate.

/** Pure: the direction a new stamp should take, toggling from the last one. */
export function nextDirection(
  last: { direction: ClockDirection } | null | undefined,
): ClockDirection {
  return last?.direction === "IN" ? "OUT" : "IN";
}

type PairableEvent = { direction: ClockDirection; timestamp: Date };

/** Pure: sum worked hours by pairing IN→OUT across an ordered event list.
 *  A trailing unmatched IN means the person is still clocked in; its open time
 *  is reported separately, never silently counted. */
export function accumulateHours(events: PairableEvent[]): {
  hours: number;
  openSince: Date | null;
} {
  const sorted = [...events].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  let ms = 0;
  let openIn: Date | null = null;
  for (const e of sorted) {
    if (e.direction === "IN") {
      openIn = e.timestamp;
    } else if (openIn) {
      ms += e.timestamp.getTime() - openIn.getTime();
      openIn = null;
    }
  }
  return { hours: ms / 3_600_000, openSince: openIn };
}

export type StampInput = {
  userId: string;
  restaurantId: string;
  method: VerificationMethod;
  clientId: string;
  /** Effective (local) time of the stamp. Defaults to now for live stamps;
   *  an offline replay supplies the time it was actually made. */
  timestamp?: Date;
  /** Explicit direction, or omitted to toggle from the person's last stamp. */
  direction?: ClockDirection;
  deviceLabel?: string | null;
  /** QUEUED when arriving still-unsynced from the offline queue (§6.2). */
  synced?: boolean;
};

export type StampResult = {
  event: ClockEvent;
  direction: ClockDirection;
  /** True when this clientId had already been recorded (idempotent replay). */
  duplicate: boolean;
};

/** Record an append-only stamp. Idempotent on `clientId`. Matches the stamp to
 *  the person's scheduled shift that day and, if it falls outside the tolerance
 *  window, opens a graded Deviation for an owner to review (§6.2/§6.3). */
export async function recordStamp(input: StampInput): Promise<StampResult> {
  const existing = await prisma.clockEvent.findUnique({
    where: { clientId: input.clientId },
  });
  if (existing) {
    return { event: existing, direction: existing.direction, duplicate: true };
  }

  const timestamp = input.timestamp ?? new Date();

  const direction =
    input.direction ??
    nextDirection(
      await prisma.clockEvent.findFirst({
        where: { userId: input.userId, restaurantId: input.restaurantId },
        orderBy: { timestamp: "desc" },
        select: { direction: true },
      }),
    );

  const matchedShift = await matchShift(
    input.userId,
    input.restaurantId,
    timestamp,
    direction,
  );

  const event = await prisma.clockEvent.create({
    data: {
      userId: input.userId,
      restaurantId: input.restaurantId,
      direction,
      timestamp,
      verificationMethod: input.method,
      syncStatus: input.synced === false ? "QUEUED" : "SYNCED",
      clientId: input.clientId,
      deviceLabel: input.deviceLabel ?? null,
      scheduledShiftId: matchedShift?.id ?? null,
    },
  });

  if (matchedShift) {
    await maybeOpenDeviation(event, matchedShift, direction);
  }

  return { event, direction, duplicate: false };
}

export type OnShiftEntry = {
  userId: string;
  displayName: string;
  since: string; // ISO of the IN stamp
  tagNames: string[];
  onTime: boolean | null; // null = no matched shift to judge against
};

/** Who is clocked in right now (latest stamp is IN), with their tags and an
 *  on-time read against the matched shift. Powers the kiosk "on shift now"
 *  panel and the §6.3 realtime overview. */
export async function onShiftNow(restaurantId: string): Promise<OnShiftEntry[]> {
  const members = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null },
    select: { userId: true, user: { select: { displayName: true } } },
  });
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);
  const [tagRows, restaurant] = await Promise.all([
    prisma.employeeTag.findMany({
      where: { userId: { in: userIds }, tag: { restaurantId } },
      select: { userId: true, tag: { select: { name: true } } },
    }),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { toleranceLowMinutes: true },
    }),
  ]);
  const tagsByUser = new Map<string, string[]>();
  for (const r of tagRows) {
    const list = tagsByUser.get(r.userId) ?? [];
    list.push(r.tag.name);
    tagsByUser.set(r.userId, list);
  }
  const lowTol = restaurant?.toleranceLowMinutes ?? 10;

  const entries: OnShiftEntry[] = [];
  for (const m of members) {
    const last = await prisma.clockEvent.findFirst({
      where: { userId: m.userId, restaurantId },
      orderBy: { timestamp: "desc" },
      select: { direction: true, timestamp: true, scheduledShiftId: true },
    });
    if (last?.direction !== "IN") continue;

    let onTime: boolean | null = null;
    if (last.scheduledShiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: last.scheduledShiftId },
        select: { startsAt: true },
      });
      if (shift) {
        const deltaMin = Math.abs(
          (last.timestamp.getTime() - shift.startsAt.getTime()) / 60_000,
        );
        onTime = deltaMin <= lowTol;
      }
    }
    entries.push({
      userId: m.userId,
      displayName: m.user.displayName,
      since: last.timestamp.toISOString(),
      tagNames: tagsByUser.get(m.userId) ?? [],
      onTime,
    });
  }
  return entries.sort((a, b) => a.since.localeCompare(b.since));
}

/** The person's assigned shift that day whose relevant boundary is closest to
 *  the stamp (start for IN, end for OUT). Open/unassigned shifts don't match. */
async function matchShift(
  userId: string,
  restaurantId: string,
  timestamp: Date,
  direction: ClockDirection,
) {
  const dayStart = new Date(timestamp);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId,
      assignedUserId: userId,
      startsAt: { gte: dayStart, lt: dayEnd },
    },
  });
  if (shifts.length === 0) return null;

  const boundary = (s: { startsAt: Date; endsAt: Date }) =>
    direction === "IN" ? s.startsAt : s.endsAt;
  return shifts.reduce((best, s) =>
    Math.abs(boundary(s).getTime() - timestamp.getTime()) <
    Math.abs(boundary(best).getTime() - timestamp.getTime())
      ? s
      : best,
  );
}

async function maybeOpenDeviation(
  event: ClockEvent,
  shift: { id: string; startsAt: Date; endsAt: Date },
  direction: ClockDirection,
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: event.restaurantId },
    select: { toleranceLowMinutes: true, toleranceHighMinutes: true },
  });
  if (!restaurant) return;
  const tolerance: ToleranceConfig = restaurant;

  const delta = minutesDelta(event.timestamp, shift.startsAt, shift.endsAt, direction);
  if (gradeDeviation(delta, tolerance) === "NONE") return;

  // Prior same-direction deltas (newest first) feed repeated-pattern detection.
  const priorDeviations = await prisma.deviation.findMany({
    where: { userId: event.userId, restaurantId: event.restaurantId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { clockEvent: { select: { direction: true } } },
  });
  const priorDeltas = priorDeviations
    .filter((d) => d.clockEvent?.direction === direction)
    .map((d) => d.minutesDelta);

  const severity = severityForStamp(delta, priorDeltas, tolerance);

  // Notify an owner/co-owner (§6.3 "every deviation has an accountable owner").
  const owner = await prisma.membership.findFirst({
    where: { restaurantId: event.restaurantId, role: { in: ["OWNER", "CO_OWNER"] }, endedAt: null },
    orderBy: { isBillingOwner: "desc" },
    select: { userId: true },
  });

  await prisma.deviation.create({
    data: {
      restaurantId: event.restaurantId,
      userId: event.userId,
      clockEventId: event.id,
      shiftId: shift.id,
      severity,
      minutesDelta: delta,
      assignedToId: owner?.userId ?? null,
    },
  });
}
