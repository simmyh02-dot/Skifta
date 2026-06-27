import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";

// Owner-configurable tolerance window (§6.2). settings:manage + FULL tier (the
// guard enforces both via the action). The thresholds drive deviation grading.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "settings:manage");
    // settings:manage is admin-only but not tier-gated; the clock tolerance is
    // a FULL-tier feature, so gate the tier explicitly too.
    await requirePermission(activeRestaurantId, "clock:viewOwn");

    const body = await req.json().catch(() => null);
    const low = Number(body?.toleranceLowMinutes);
    const high = Number(body?.toleranceHighMinutes);
    if (
      !Number.isInteger(low) ||
      !Number.isInteger(high) ||
      low < 0 ||
      high < low ||
      high > 240
    ) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    await prisma.restaurant.update({
      where: { id: activeRestaurantId },
      data: { toleranceLowMinutes: low, toleranceHighMinutes: high },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
