import { prisma } from "./prisma";
import { upsertTagsByName } from "./tags";
import { AuthError } from "./guard";
import { notifyShiftAssigned, notifyShiftChanged } from "./notify";

// Shifts section (§6.1) — week view, open shifts, qualification matching.
// One Shift row per slot; OPEN until someone is assigned. Qualification is
// just "has every required tag" — restaurants with no tags configured yet
// mean every shift is open to everyone (no required tags).

/**
 * §6.1 double-booking guard: refuse to put a person on two overlapping
 * ASSIGNED shifts. Thrown as a 409 the caller surfaces, so it's enforced
 * server-side (not just hidden in the UI), the same as the tier/role checks.
 * Two intervals overlap when each starts before the other ends.
 */
export async function assertNoDoubleBooking(
  userId: string,
  restaurantId: string,
  startsAt: Date,
  endsAt: Date,
  excludeShiftId?: string,
): Promise<void> {
  const clash = await prisma.shift.findFirst({
    where: {
      restaurantId,
      assignedUserId: userId,
      status: "ASSIGNED",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AuthError(409, "double_booked");
}

export async function listWeek(restaurantId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000);
  return prisma.shift.findMany({
    where: {
      restaurantId,
      startsAt: { gte: weekStart, lt: weekEnd },
    },
    include: {
      assignedUser: { select: { id: true, displayName: true } },
      requiredTags: true,
      swapRequests: {
        where: { status: { in: ["PENDING", "ACCEPTED", "ESCALATED"] } },
        include: {
          requestedBy: { select: { id: true, displayName: true } },
          directedTo: { select: { id: true, displayName: true } },
          acceptedBy: { select: { id: true, displayName: true } },
        },
      },
      interests: {
        include: { user: { select: { id: true, displayName: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}

export type CreateShiftInput = {
  restaurantId: string;
  startsAt: Date;
  endsAt: Date;
  assignedUserId?: string | null;
  note?: string | null;
  requiredTagNames?: string[];
};

export async function createShift(input: CreateShiftInput) {
  const tagIds = input.requiredTagNames?.length
    ? await upsertTagsByName(input.restaurantId, input.requiredTagNames)
    : [];

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
      assignedUserId: input.assignedUserId ?? null,
      status: input.assignedUserId ? "ASSIGNED" : "OPEN",
      requiredTags: { connect: tagIds.map((id) => ({ id })) },
    },
    include: { requiredTags: true, restaurant: { select: { name: true } } },
  });

  if (shift.assignedUserId) {
    await notifyShiftAssigned(shift.assignedUserId, shift.restaurant.name, shift.startsAt);
  }
  return shift;
}

export type UpdateShiftInput = {
  startsAt?: Date;
  endsAt?: Date;
  assignedUserId?: string | null;
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
  });
  if (!shift) return null;

  const tagIds =
    input.requiredTagNames !== undefined
      ? await upsertTagsByName(restaurantId, input.requiredTagNames)
      : undefined;

  // Effective time + assignee after this update, for the double-booking guard
  // and the change notification.
  const nextStart = input.startsAt ?? shift.startsAt;
  const nextEnd = input.endsAt ?? shift.endsAt;
  const nextAssignee =
    input.assignedUserId !== undefined ? input.assignedUserId : shift.assignedUserId;
  const timeChanged =
    (input.startsAt && +input.startsAt !== +shift.startsAt) ||
    (input.endsAt && +input.endsAt !== +shift.endsAt);
  const reassigned =
    input.assignedUserId !== undefined && input.assignedUserId !== shift.assignedUserId;

  if (nextAssignee) {
    await assertNoDoubleBooking(nextAssignee, restaurantId, nextStart, nextEnd, shiftId);
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...(input.startsAt && { startsAt: input.startsAt }),
      ...(input.endsAt && { endsAt: input.endsAt }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.assignedUserId !== undefined && {
        assignedUserId: input.assignedUserId,
        status: input.assignedUserId ? "ASSIGNED" : "OPEN",
      }),
      ...(tagIds !== undefined && { requiredTags: { set: tagIds.map((id) => ({ id })) } }),
    },
    include: { requiredTags: true, restaurant: { select: { name: true } } },
  });

  // A freshly-assigned person gets "new shift"; an existing holder whose time
  // moved gets "changed". Avoids double-pinging the same person on reassignment.
  if (reassigned && nextAssignee) {
    await notifyShiftAssigned(nextAssignee, updated.restaurant.name, updated.startsAt);
  } else if (timeChanged && nextAssignee) {
    await notifyShiftChanged(nextAssignee, updated.restaurant.name, updated.startsAt);
  }

  return updated;
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

  const requiredIds = new Set(shift.requiredTags.map((t) => t.id));
  const qualified = [];
  for (const m of members) {
    const tags = await prisma.employeeTag.findMany({
      where: { userId: m.userId, tagId: { in: Array.from(requiredIds) } },
    });
    if (tags.length === requiredIds.size) qualified.push(m.user);
  }
  return qualified;
}

/**
 * First-come claim of an OPEN shift (§6.1 FIRST_COME). Atomic: only succeeds
 * while still OPEN, and only for a qualified member (right competence tag).
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

  const result = await prisma.shift.updateMany({
    where: { id: shiftId, restaurantId, status: "OPEN" },
    data: { assignedUserId: userId, status: "ASSIGNED" },
  });
  if (result.count > 0) {
    await prisma.shiftInterest.deleteMany({ where: { shiftId } });
  }
  return result.count > 0;
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
    update: {},
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

  const result = await prisma.shift.updateMany({
    where: { id: shiftId, restaurantId, status: "OPEN" },
    data: { assignedUserId: userId, status: "ASSIGNED" },
  });
  if (result.count > 0) {
    await prisma.shiftInterest.deleteMany({ where: { shiftId } });
    await notifyShiftAssigned(userId, shift.restaurant.name, shift.startsAt);
  }
  return result.count > 0;
}
