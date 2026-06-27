import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { getEconomyOverview } from "@/lib/economy-data";
import { monthBounds, parsePeriodKey } from "@/lib/economy";

// Owner/co-owner economy overview for a period (§6.3). FULL tier + admin, both
// enforced by `economy:view`. Read-only summary of append-only stamps.
export async function GET(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "economy:view");

    const { searchParams } = new URL(req.url);
    const periodDate = parsePeriodKey(searchParams.get("period")) ?? new Date();
    const { start, end } = monthBounds(periodDate);

    const overview = await getEconomyOverview(activeRestaurantId, start, end);
    return Response.json(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
