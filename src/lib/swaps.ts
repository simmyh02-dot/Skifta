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

  await prisma.$transaction([
    prisma.shiftAssignment.deleteMany({
      where: { shiftId: swap.shiftId, userId: swap.requestedById },
    }),
    prisma.shiftAssignment.create({
      data: { shiftId: swap.shiftId, userId: swap.acceptedById },
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "APPROVED", approvedById, resolvedAt: new Date() },
    }),
  ]);

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
