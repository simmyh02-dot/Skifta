import { prisma } from "./prisma";
import { qualifiedMembers } from "./shifts";

// Swap flow (§6.1): "can't work" → request → reply → owner approval. `mode`
// is the restaurant's default at request time (directed = owner picks who's
// asked; broad = all qualified colleagues see it, first to accept wins).

export async function startSwap(shiftId: string, requestedById: string, restaurantId: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, restaurantId, assignedUserId: requestedById, status: "ASSIGNED" },
  });
  if (!shift) return null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { swapDefaultMode: true, swapEscalationMinutes: true },
  });
  if (!restaurant) return null;

  return prisma.shiftSwapRequest.create({
    data: {
      shiftId,
      requestedById,
      mode: restaurant.swapDefaultMode,
      escalateAt: new Date(
        Date.now() + restaurant.swapEscalationMinutes * 60_000,
      ),
    },
  });
}

/** Owner directs a DIRECTED request to a specific qualified colleague. */
export async function directSwap(
  swapId: string,
  directedToId: string,
  restaurantId: string,
): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: swapId, status: "PENDING", mode: "DIRECTED", shift: { restaurantId } },
  });
  if (!swap) return false;

  const qualified = await qualifiedMembers(restaurantId, swap.shiftId);
  if (!qualified.some((u) => u.id === directedToId)) return false;

  await prisma.shiftSwapRequest.update({
    where: { id: swapId },
    data: { directedToId },
  });
  return true;
}

/** A qualified colleague accepts (broad) or the directed colleague accepts. */
export async function acceptSwap(
  swapId: string,
  userId: string,
  restaurantId: string,
): Promise<boolean> {
  const swap = await prisma.shiftSwapRequest.findFirst({
    where: { id: swapId, status: "PENDING", shift: { restaurantId } },
  });
  if (!swap) return false;
  if (swap.mode === "DIRECTED" && swap.directedToId !== userId) return false;
  if (swap.mode === "BROAD") {
    const qualified = await qualifiedMembers(restaurantId, swap.shiftId);
    if (!qualified.some((u) => u.id === userId)) return false;
  }

  const result = await prisma.shiftSwapRequest.updateMany({
    where: { id: swapId, status: "PENDING" },
    data: { acceptedById: userId, status: "ACCEPTED" },
  });
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
      status: "PENDING",
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
  });
  if (!swap || !swap.acceptedById) return false;

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: swap.shiftId },
      data: { assignedUserId: swap.acceptedById },
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "APPROVED", approvedById, resolvedAt: new Date() },
    }),
  ]);
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
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    data: { status: "CANCELED", resolvedAt: new Date() },
  });
  return result.count > 0;
}
