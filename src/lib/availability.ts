import { prisma } from "./prisma";

// Recurring weekly availability (§6.1) — so the owner doesn't have to ask
// each week. One row per weekday the person is available; no row = unavailable.

export async function getAvailability(userId: string, restaurantId: string) {
  return prisma.availability.findMany({
    where: { userId, restaurantId },
    orderBy: { weekday: "asc" },
  });
}

export type AvailabilityRange = {
  weekday: number; // 0 = Monday … 6 = Sunday
  startMinute: number;
  endMinute: number;
};

/** Replace a person's full weekly availability in one go. */
export async function setAvailability(
  userId: string,
  restaurantId: string,
  ranges: AvailabilityRange[],
): Promise<void> {
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { userId, restaurantId } }),
    prisma.availability.createMany({
      data: ranges.map((r) => ({
        userId,
        restaurantId,
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
    }),
  ]);
}
