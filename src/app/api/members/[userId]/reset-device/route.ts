import { prisma } from "@/lib/prisma";
import { resetWebAuthnCredentials } from "@/lib/webauthn";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → §5 "förlorad enhet": owner/co-owner removes a colleague's lost-device
// WebAuthn credentials, since they're already trusted admins. The person then
// re-registers (self-service OTP flow at the kiosk, or normal login).
// Owner/co-owner only (members:manage); works on both tiers, since losing a
// phone isn't a FULL-tier-only problem.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: targetUserId } = await params;
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const membership = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: targetUserId, restaurantId: activeRestaurantId } },
    });
    if (!membership) {
      return Response.json({ error: "not_a_member" }, { status: 404 });
    }

    const removed = await resetWebAuthnCredentials(targetUserId);
    return Response.json({ ok: true, removed });
  } catch (err) {
    return errorResponse(err);
  }
}
