import { errorResponse, getAccessContext, requireUser } from "@/lib/guard";
import { setActiveRestaurant } from "@/lib/session";

// POST { restaurantId } → switch the active restaurant (§3.3). Only succeeds if
// the user actually has a live membership there.
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const body = await req.json().catch(() => null);
    const restaurantId = body?.restaurantId;
    if (typeof restaurantId !== "string") {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const ctx = await getAccessContext(userId, restaurantId);
    if (!ctx) {
      return Response.json({ error: "no_restaurant_access" }, { status: 403 });
    }

    await setActiveRestaurant(restaurantId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
