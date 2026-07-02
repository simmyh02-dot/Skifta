import type { SwapStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { qualifiedMembers, assertNoDoubleBooking } from "./shifts";
import {
  notifySwapNeedsReply,
  notifySwapAccepted,
  notifySwapApproved,
  notifySwapEscalated,
} from "./notify";

// Swap flow (§6.1): "can't work" → request → reply → owner approval. `mode`
// is the restaurant's default at request time (directed = owner picks who's
// asked; broad = all qualified colleagues see it, first to accept wins).

// A PENDING swap and an ESCALATED one are both still actionable — escalation
// just pulls the owner in, it doesn't lock the request — so the reply/decline/
// direct steps treat them the same.
const OPEN_SWAP: SwapStatus[] = ["PENDING", "ESCALATED"];

export async function startSwap(shiftId: string, requestedById: string, restaurantId: string) {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      restaurantId,
      status: "ASSIGNED",
      assignments: { some: { userId: requestedById } },
    },
    include: { restaurant: { select: { name: true, swapDefaultMode: true, swapEscalationMinutes: true } } },
  });
  if (!shift) return null;

  const { restaurant } = shift;
  const swap = await prisma.shiftSwapRequest.create({
    data: {
      shiftId,
      requestedById,
      mode: restaurant.swapDefaultMode,
      escalateAt: new Date(
        Date.now() + restaurant.swapEscalationMinutes * 60_000,
      ),
    },
  });

  // BROAD: every qualified colleague (minus the requester) is asked right away.
  // DIRECTED: nobody is notified until the owner picks who to ask (`directSwap`).
  if (restaurant.swapDefaultMode === "BROAD") {
    const qualified = await qualifiedMembers(restaurantId, shiftId);
    await notifySwapNeedsReply(
      qualified.filter((u) => u.id !== requestedById).map((u) => u.id),
      restaurantId,
      restaurant.name,
      shift.startsAt,
      swap.id,
    );
  }

  return swap;
}

/** Owner directs a DIRECTED request to a specific qualified colleague. */
export async function directSwap(
  swapId: string,
  directedToId: string,
  restaurantId: string,
): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: swapId, status: { in: OPEN_SWAP }, mode: "DIRECTED", shift: { restaurantId } },
    include: { shift: { include: { restaurant: { select: { name: true } } } } },
  });
  if (!swap) return false;

  const qualified = await qualifiedMembers(restaurantId, swap.shiftId);
  if (!qualified.some((u) => u.id === directedToId)) return false;

  await prisma.shiftSwapRequest.update({
    where: { id: swapId },
    data: { directedToId },
  });
  await notifySwapNeedsReply(
    [directedToId],
    restaurantId,
    swap.shift.restaurant.name,
    swap.shift.startsAt,
    swap.id,
  );
  return true;
}

/** A qualified colleague accepts (broad) or the directed colleague accepts. */
export async function acceptSwap(
  swapId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: swapId, status: { in: OPEN_SWAP }, shift: { restaurantId } },
    include: { shift: { include: { restaurant: { select: { name: true } } } } },
  });
  if (!swap) return false;
  if (swap.mode === "DIRECTED" && swap.directedToId !== userId) return false;
  if (swap.mode === "BROAD") {
    const qualified = await qualifiedMembers(restaurantId, swap.shiftId);
    if (!qualified.some((u) => u.id === userId)) return false;
  }

  const result = await prisma.shiftSwapRequest.updateMany({
    where: { id: swapId, status: { in: OPEN_SWAP } },
    data: { acceptedById: userId, status: "ACCEPTED" },
  });
  if (result.count > 0) {
    await notifySwapAccepted(restaurantId, swap.shift.restaurant.name, swap.shift.startsAt, swapId);
  }
  return result.count > 0;
}

export async function declineSwap(
  swapId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const result = await prisma.shiftSwapRequest.updateMany({
    where: {
      id: swapId,
      status: { in: OPEN_SWAP },
      directedToId: userId,
      shift: { restaurantId },
    },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });
  return result.count > 0;
}

/** Owner/co-owner approves an ACCEPTED swap: reassigns the shift. */
export async function approveSwap(
  swapId: string,
  approvedById: string,
  restaurantId: string,
): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: swapId, status: "ACCEPTED", shift: { restaurantId } },
    include: { shift: { include: { restaurant: { select: { name: true } } } } },
  });
  if (!swap || !swap.acceptedById) return false;

  // Don't approve a swap that would double-book the colleague taking over.
  await assertNoDoubleBooking(
    swap.acceptedById,
    restaurantId,
    swap.shift.startsAt,
    swap.shift.endsAt,
    swap.shiftId,
  );

  // Same shift-row lock as `fillSlot`, so a concurrent fill/unassign/approve
  // can't interleave with the reassignment. Re-checked under the lock: the
  // requester must still hold a slot and the acceptor must not already hold
  // one (would violate the unique (shiftId, userId) assignment).
  const acceptedById = swap.acceptedById;
  const approved = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${swap.shiftId} FOR UPDATE`;
    const assignments = await tx.shiftAssignment.findMany({
      where: { shiftId: swap.shiftId },
      select: { userId: true },
    });
    if (!assignments.some((a) => a.userId === swap.requestedById)) return false;
    if (assignments.some((a) => a.userId === acceptedById)) return false;

    await tx.shiftAssignment.deleteMany({
      where: { shiftId: swap.shiftId, userId: swap.requestedById },
    });
    await tx.shiftAssignment.create({
      data: { shiftId: swap.shiftId, userId: acceptedById },
    });
    const flip = await tx.shiftSwapRequest.updateMany({
      where: { id: swapId, status: "ACCEPTED" },
      data: { status: "APPROVED", approvedById, resolvedAt: new Date() },
    });
    return flip.count > 0;
  });
  if (!approved) return false;

  await notifySwapApproved(
    swap.acceptedById,
    swap.requestedById,
    restaurantId,
    swap.shift.restaurant.name,
    swap.shift.startsAt,
    swapId,
  );
  return true;
}

export async function cancelSwap(
  swapId: string,
  requestedById: string,
  restaurantId: string,
): Promise<boolean> {
  const result = await prisma.shiftSwapRequest.updateMany({
    where: {
      id: swapId,
      requestedById,
      shift: { restaurantId },
      status: { in: ["PENDING", "ESCALATED", "ACCEPTED"] },
    },
    data: { status: "CANCELED", resolvedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * §6.1 escalation: a PENDING swap whose `escalateAt` window has passed with no
 * reply is flipped to ESCALATED and the owners are pinged so it doesn't sit
 * silently past the lunch rush. Idempotent — only PENDING rows are touched, so
 * re-running the sweep never re-notifies. Driven by the shifts cron.
 */
/**
 * Opportunistic escalation sweep for request-time call sites (schedule page
 * load). The Vercel cron only runs daily (Hobby plan limit), but the reply
 * window is minutes — so busy restaurants get timely escalation from their own
 * traffic, with the cron as the floor for quiet ones. Throttled per server
 * instance so page loads stay cheap; concurrent sweeps are safe because each
 * escalation is a guarded per-row status flip (no double-notify).
 */
let lastSweepAtMs = 0;
const SWEEP_MIN_INTERVAL_MS = 5 * 60_000;

export async function maybeEscalateOverdueSwaps(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAtMs < SWEEP_MIN_INTERVAL_MS) return;
  lastSweepAtMs = now;
  try {
    await escalateOverdueSwaps();
  } catch (err) {
    // Escalation is best-effort here; the cron remains the backstop.
    console.error("[swaps] opportunistic escalation sweep failed", err);
  }
}

export async function escalateOverdueSwaps(now: Date = new Date()): Promise<number> {
  const overdue = await prisma.shiftSwapRequest.findMany({
    where: { status: "PENDING", escalateAt: { lte: now } },
    include: { shift: { include: { restaurant: { select: { id: true, name: true } } } } },
  });

  let escalated = 0;
  for (const swap of overdue) {
    const flip = await prisma.shiftSwapRequest.updateMany({
      where: { id: swap.id, status: "PENDING" },
      data: { status: "ESCALATED" },
    });
    if (flip.count === 0) continue; // someone resolved it between read and write
    await notifySwapEscalated(
      swap.shift.restaurant.id,
      swap.shift.restaurant.name,
      swap.shift.startsAt,
      swap.id,
    );
    escalated++;
  }
  return escalated;
}
