import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { setPin } from "@/lib/pin";

// Employee sets/replaces their own PIN for the active restaurant (§5 method 2).
// FULL-tier only via the clock:viewOwn gate; the PIN is hashed in setPin().
export async function POST(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "clock:viewOwn");

    const body = await req.json().catch(() => null);
    const ok =
      typeof body?.pin === "string" &&
      (await setPin(userId, activeRestaurantId, body.pin));
    if (!ok) return Response.json({ error: "invalid_pin" }, { status: 400 });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
