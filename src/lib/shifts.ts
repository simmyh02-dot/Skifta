import { prisma } from "./prisma";
import { upsertTagsByName } from "./tags";
import { AuthError } from "./guard";
import { notifyShiftAssigned, notifyShiftChanged, notifyInterestRejected } from "./notify";

// Shifts section (§6.1) — week view, open shifts, qualification matching.
// A shift has `slots` places; OPEN while fewer than `slots` are filled,
// ASSIGNED ("full") once they're all filled. Qualification is just "has every
// required tag" — restaurants with no tags configured yet mean every shift is
// open to everyone (no required tags).

/**
 * §6.1 double-booking guard: refuse to put a person on two overlapping
 * shifts (any shift they already hold a slot in). Thrown as a 409 the caller
 * surfaces, so it's enforced server-side (not just hidden in the UI), the
 * same as the tier/role checks. Two intervals overlap when each starts before
 * the other ends.
 */
export async function assertNoDoubleBooking(
  userId: string,
  restaurantId: string,
  startsAt: Date,
  endsAt: Date,
  excludeShiftId?: string,
): Promise<void> {
  const clash = await prisma.shiftAssignment.findFirst({
    where: {
      userId,
      shift: {
        restaurantId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
      },
    },
    select: { id: true },
  });
  if (clash) throw new AuthError(409, "double_booked");
}

/** A shift is full once it has as many assignments as it has slots. */
function isFull(slots: number, assignmentCount: number): boolean {
  return assignmentCount >= slots;
}

/**
 * Pure date-range × weekday expansion for bulk shift creation (§6.1). `weekdays`
 * uses the same 0=Monday…6=Sunday convention as `Availability.weekday`.
 * Inclusive of both `startDate` and `endDate` (YYYY-MM-DD).
 */
export function expandWeekdayDates(
  startDate: string,
  endDate: string,
  weekdays: number[],
): string[] {
  const days = new Set(weekdays);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates: string[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = new Date(d.getTime() + 24 * 60 * 60_000)) {
    const isoWeekday = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1; // 0 = Mon … 6 = Sun
    if (days.has(isoWeekday)) dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const SHIFT_LIST_INCLUDE = {
  assignments: { include: { user: { select: { id: true, displayName: true } } } },
  requiredTags: true,
  swapRequests: {
    // Active (actionable) swaps plus the most recent DECLINED one, so the
    // owner's week view can show "Nekat av X" without a second query — the
    // UI picks the first PENDING/ACCEPTED/ESCALATED row as the active one and
    // falls back to the newest DECLINED row otherwise.
    where: {
      status: {
        in: ["PENDING", "ACCEPTED", "ESCALATED", "DECLINED"] as (
          | "PENDING"
          | "ACCEPTED"
          | "ESCALATED"
          | "DECLINED"
        )[],
      },
    },
    orderBy: { createdAt: "desc" as const },
    include: {
      requestedBy: { select: { id: true, displayName: true } },
      directedTo: { select: { id: true, displayName: true } },
      acceptedBy: { select: { id: true, displayName: true } },
    },
  },
  interests: {
    where: { status: "PENDING" as const },
    include: { user: { select: { id: true, displayName: true } } },
  },
};

export async function listWeek(restaurantId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  return prisma.shift.findMany({
    where: {
      restaurantId,
      startsAt: { gte: weekStart, lt: weekEnd },
    },
    include: SHIFT_LIST_INCLUDE,
    orderBy: { startsAt: "asc" },
  });
}

export type CreateShiftInput = {
  restaurantId: string;
  startsAt: Date;
  endsAt: Date;
  assignedUserId?: string | null;
  slots?: number;
  note?: string | null;
  requiredTagNames?: string[];
};

export async function createShift(input: CreateShiftInput) {
  const tagIds = input.requiredTagNames?.length
    ? await upsertTagsByName(input.restaurantId, input.requiredTagNames)
    : [];
  const slots = input.slots && input.slots > 0 ? Math.floor(input.slots) : 1;

  if (input.assignedUserId) {
    await assertNoDoubleBooking(
      input.assignedUserId,
      input.restaurantId,
      input.startsAt,
      input.endsAt,
    );
  }

  const shift = await prisma.shift.create({
    data: {
      restaurantId: input.restaurantId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note ?? null,
      slots,
      status: isFull(slots, input.assignedUserId ? 1 : 0) ? "ASSIGNED" : "OPEN",
      requiredTags: { connect: tagIds.map((id) => ({ id })) },
      ...(input.assignedUserId && {
        assignments: { create: { userId: input.assignedUserId } },
      }),
    },
    include: { requiredTags: true, restaurant: { select: { name: true } }, assignments: true },
  });

  if (input.assignedUserId) {
    await notifyShiftAssigned(
      input.assignedUserId,
      input.restaurantId,
      shift.restaurant.name,
      shift.startsAt,
      shift.id,
    );
  }
  return shift;
}

export type UpdateShiftInput = {
  startsAt?: Date;
  endsAt?: Date;
  slots?: number;
  note?: string | null;
  requiredTagNames?: string[];
};

export async function updateShift(
  shiftId: string,
  restaurantId: string,
  input: UpdateShiftInput,
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId },
    include: { assignments: true },
  });
  if (!shift) return null;

  const tagIds =
    input.requiredTagNames !== undefined
      ? await upsertTagsByName(restaurantId, input.requiredTagNames)
      : undefined;

  // Effective time after this update, for the double-booking guard and the
  // change notification to everyone currently assigned.
  const nextStart = input.startsAt ?? shift.startsAt;
  const nextEnd = input.endsAt ?? shift.endsAt;
  const timeChanged =
    (input.startsAt && +input.startsAt !== +shift.startsAt) ||
    (input.endsAt && +input.endsAt !== +shift.endsAt);
  const nextSlots = input.slots && input.slots > 0 ? Math.floor(input.slots) : shift.slots;

  if (timeChanged) {
    await Promise.all(
      shift.assignments.map((a) =>
        assertNoDoubleBooking(a.userId, restaurantId, nextStart, nextEnd, shiftId),
      ),
    );
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...(input.startsAt && { startsAt: input.startsAt }),
      ...(input.endsAt && { endsAt: input.endsAt }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.slots !== undefined && {
        slots: nextSlots,
        status: shift.status === "OPEN" || shift.status === "ASSIGNED"
          ? (isFull(nextSlots, shift.assignments.length) ? "ASSIGNED" : "OPEN")
          : undefined,
      }),
      ...(tagIds !== undefined && { requiredTags: { set: tagIds.map((id) => ({ id })) } }),
    },
    include: { requiredTags: true, restaurant: { select: { name: true } } },
  });

  if (timeChanged) {
    await Promise.all(
      shift.assignments.map((a) =>
        notifyShiftChanged(a.userId, restaurantId, updated.restaurant.name, updated.startsAt, shiftId),
      ),
    );
  }

  return updated;
}

/** Owner directly assigns one more person to a shift's open slots. */
export async function assignToShift(
  shiftId: string,
  restaurantId: string,
  userId: string,
): Promise<boolean> {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, status: "OPEN" },
    include: { assignments: true, restaurant: { select: { name: true } } },
  });
  if (!shift) return false;
  if (shift.assignments.some((a) => a.userId === userId)) return false;
  await assertNoDoubleBooking(userId, restaurantId, shift.startsAt, shift.endsAt, shiftId);

  const added = await fillSlot(shiftId, userId);
  if (added) await notifyShiftAssigned(userId, restaurantId, shift.restaurant.name, shift.startsAt, shiftId);
  return added;
}

/** Owner removes one person from a shift, reopening it if it's no longer full.
 *  Only live shifts — a COMPLETED/CANCELED shift is history and must never be
 *  resurrected as OPEN. */
export async function unassignFromShift(
  shiftId: string,
  restaurantId: string,
  userId: string,
): Promise<boolean> {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, status: { in: ["OPEN", "ASSIGNED"] } },
  });
  if (!shift) return false;

  const result = await prisma.shiftAssignment.deleteMany({ where: { shiftId, userId } });
  if (result.count === 0) return false;

  await prisma.shift.update({
    where: { id: shiftId },
    data: { status: "OPEN" },
  });
  return true;
}

export async function deleteShift(
  shiftId: string,
  restaurantId: string,
): Promise<boolean> {
  const result = await prisma.shift.deleteMany({
    where: { id: shiftId, restaurantId, status: { not: "COMPLETED" } },
  });
  return result.count > 0;
}

/** Active members qualified for a shift's required tags (empty = everyone). */
export async function qualifiedMembers(restaurantId: string, shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { requiredTags: true },
  });
  if (!shift) return [];

  const members = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null },
    include: { user: { select: { id: true, displayName: true } } },
  });

  if (shift.requiredTags.length === 0) {
    return members.map((m) => m.user);
  }

  // One query for everyone's matching tags, tallied in memory — this runs on
  // every claim/interest/swap qualification check.
  const requiredIds = shift.requiredTags.map((t) => t.id);
  const tagRows = await prisma.employeeTag.findMany({
    where: {
      userId: { in: members.map((m) => m.userId) },
      tagId: { in: requiredIds },
    },
    select: { userId: true },
  });
  const matchCount = new Map<string, number>();
  for (const r of tagRows) {
    matchCount.set(r.userId, (matchCount.get(r.userId) ?? 0) + 1);
  }
  return members
    .filter((m) => matchCount.get(m.userId) === requiredIds.length)
    .map((m) => m.user);
}

/**
 * Atomically fills one of a shift's open slots, locking the shift row for the
 * duration so two concurrent fills (claim, pick, owner-assign) can never push
 * the assignment count past `slots` — the multi-slot equivalent of the old
 * single-assignee `updateMany({ where: { status: "OPEN" } })` exclusivity
 * trick. Once the shift becomes full, every other PENDING `ShiftInterest` for
 * it is rejected (and the candidate notified) rather than silently dropped.
 */
async function fillSlot(shiftId: string, userId: string): Promise<boolean> {
  const becameFull = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE`;
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: { assignments: true },
    });
    if (!shift || shift.status !== "OPEN") return null;
    if (shift.assignments.some((a) => a.userId === userId)) return null;
    if (isFull(shift.slots, shift.assignments.length)) return null;

    await tx.shiftAssignment.create({ data: { shiftId, userId } });
    const nowFull = isFull(shift.slots, shift.assignments.length + 1);
    if (nowFull) {
      await tx.shift.update({ where: { id: shiftId }, data: { status: "ASSIGNED" } });
    }
    return nowFull;
  });
  if (becameFull === null) return false;
  if (becameFull) await rejectRemainingInterests(shiftId, userId);
  return true;
}

/** Marks the picked candidate's interest ACCEPTED and every other still-
 *  PENDING candidate REJECTED, notifying each rejected one — never a silent
 *  `deleteMany`. */
async function rejectRemainingInterests(shiftId: string, pickedUserId: string): Promise<void> {
  await prisma.shiftInterest.updateMany({
    where: { shiftId, userId: pickedUserId, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });

  const stillPending = await prisma.shiftInterest.findMany({
    where: { shiftId, userId: { not: pickedUserId }, status: "PENDING" },
    include: { shift: { include: { restaurant: { select: { id: true, name: true } } } } },
  });
  if (stillPending.length === 0) return;

  // Reject exactly the rows we fetched, so no one is rejected unnotified.
  await prisma.shiftInterest.updateMany({
    where: { id: { in: stillPending.map((i) => i.id) } },
    data: { status: "REJECTED" },
  });
  await Promise.all(
    stillPending.map((i) =>
      notifyInterestRejected(
        i.userId,
        i.shift.restaurant.id,
        i.shift.restaurant.name,
        i.shift.startsAt,
        i.shiftId,
      ),
    ),
  );
}

/**
 * First-come claim of an OPEN shift (§6.1 FIRST_COME). Atomic: only succeeds
 * while still OPEN with a free slot, and only for a qualified member (right
 * competence tag).
 */
export async function claimOpenShift(
  shiftId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { openShiftFill: true },
  });
  if (restaurant?.openShiftFill !== "FIRST_COME") return false;

  const qualified = await qualifiedMembers(restaurantId, shiftId);
  if (!qualified.some((u) => u.id === userId)) return false;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, status: "OPEN" },
  });
  if (!shift) return false;
  await assertNoDoubleBooking(userId, restaurantId, shift.startsAt, shift.endsAt, shiftId);

  return fillSlot(shiftId, userId);
}

export async function expressInterest(
  shiftId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { openShiftFill: true },
  });
  if (restaurant?.openShiftFill !== "MANUAL_PICK") return false;

  const qualified = await qualifiedMembers(restaurantId, shiftId);
  if (!qualified.some((u) => u.id === userId)) return false;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, status: "OPEN" },
  });
  if (!shift) return false;

  await prisma.shiftInterest.upsert({
    where: { shiftId_userId: { shiftId, userId } },
    create: { shiftId, userId },
    update: { status: "PENDING" },
  });
  return true;
}

/** Owner picks one of the interested employees for a MANUAL_PICK open shift. */
export async function pickInterested(
  shiftId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, status: "OPEN" },
    include: { restaurant: { select: { name: true } } },
  });
  if (!shift) return false;
  await assertNoDoubleBooking(userId, restaurantId, shift.startsAt, shift.endsAt, shiftId);

  const added = await fillSlot(shiftId, userId);
  if (added) await notifyShiftAssigned(userId, restaurantId, shift.restaurant.name, shift.startsAt, shiftId);
  return added;
}
