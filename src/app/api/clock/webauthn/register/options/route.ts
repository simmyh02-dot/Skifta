import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { startRegistration } from "@/lib/webauthn";

// Begin enrolling the signed-in user's current device for Face ID/Touch ID
// clock-in (§5 method 1). FULL-tier only via clock:viewOwn.
export async function POST() {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "clock:viewOwn");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });
    if (!user) return Response.json({ error: "not_found" }, { status: 404 });

    const options = await startRegistration(user);
    return Response.json(options);
  } catch (err) {
    return errorResponse(err);
  }
}
