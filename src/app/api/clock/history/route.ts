import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { accumulateHours } from "@/lib/clock";
import { startOfWeek } from "@/lib/week";

// The employee's own clock view (§6.2): own stamp history + accumulated hours
// for the current period. NO access to anyone else's stamps or economy data.
// Also reports the person's enrolled devices / PIN status for the setup screen.
export async function GET() {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "clock:viewOwn");

    const weekStart = startOfWeek(new Date());
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const [events, pin, devices, todayShift] = await Promise.all([
      prisma.clockEvent.findMany({
        where: {
          userId,
          restaurantId: activeRestaurantId,
          timestamp: { gte: weekStart },
        },
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          direction: true,
          timestamp: true,
          verificationMethod: true,
          syncStatus: true,
        },
      }),
      prisma.pinCredential.findUnique({
        where: { userId_restaurantId: { userId, restaurantId: activeRestaurantId } },
        select: { id: true },
      }),
      prisma.webAuthnCredential.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
      }),
      prisma.shift.findFirst({
        where: {
          restaurantId: activeRestaurantId,
          assignedUserId: userId,
          startsAt: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const { hours, openSince } = accumulateHours(events);

    // Attach any deviation flag to its stamp so the history can show "+18 min".
    const flags = await prisma.deviation.findMany({
      where: {
        userId,
        restaurantId: activeRestaurantId,
        clockEventId: { in: events.map((e) => e.id) },
      },
      select: { clockEventId: true, minutesDelta: true, severity: true },
    });
    const flagByEvent = new Map(flags.map((f) => [f.clockEventId, f]));
    const eventsWithFlags = events.map((e) => ({
      ...e,
      flag: flagByEvent.get(e.id)
        ? {
            minutesDelta: flagByEvent.get(e.id)!.minutesDelta,
            severity: flagByEvent.get(e.id)!.severity,
          }
        : null,
    }));

    return Response.json({
      weekStart: weekStart.toISOString(),
      events: eventsWithFlags,
      hours: Number(hours.toFixed(2)),
      openSince: openSince ? openSince.toISOString() : null,
      hasPin: !!pin,
      devices,
      hasDevice: devices.length > 0,
      todayShift: todayShift
        ? {
            startsAt: todayShift.startsAt.toISOString(),
            endsAt: todayShift.endsAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
