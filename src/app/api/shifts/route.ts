import { listWeek, createShift } from "@/lib/shifts";
import { startOfWeek } from "@/lib/week";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

// GET ?week=ISO-date → this restaurant's shifts for that week (Mon–Sun).
// POST { startsAt, endsAt, assignedUserId?, note?, requiredTagNames? } →
// create a shift (owner/co-owner only); no assignedUserId = an open shift.
export async function GET(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:viewOwn");

    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("week");
    const weekStart = startOfWeek(weekParam ? new Date(weekParam) : new Date());

    const [shifts, restaurant] = await Promise.all([
      listWeek(activeRestaurantId, weekStart),
      prisma.restaurant.findUnique({
        where: { id: activeRestaurantId },
        select: { openShiftFill: true, swapDefaultMode: true },
      }),
    ]);
    return Response.json({
      weekStart: weekStart.toISOString(),
      shifts,
      openShiftFill: restaurant?.openShiftFill,
      swapDefaultMode: restaurant?.swapDefaultMode,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:manage");

    const body = await req.json().catch(() => null);
    const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
    if (
      !startsAt ||
      !endsAt ||
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const shift = await createShift({
      restaurantId: activeRestaurantId,
      startsAt,
      endsAt,
      assignedUserId: typeof body?.assignedUserId === "string" ? body.assignedUserId : null,
      note: typeof body?.note === "string" ? body.note : null,
      requiredTagNames: Array.isArray(body?.requiredTagNames)
        ? body.requiredTagNames.filter((n: unknown) => typeof n === "string")
        : [],
    });

    return Response.json({ shift });
  } catch (err) {
    return errorResponse(err);
  }
}
