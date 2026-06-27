import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { finishAuthentication } from "@/lib/webauthn";
import { recordStamp } from "@/lib/clock";
import type { ClockDirection } from "@prisma/client";

// In-app self clock-in/out from the employee's own phone (design refs: the
// "Clock out" hero button, "confirmed with Face ID"). The session proves the
// person; a WebAuthn assertion is the on-device confirmation (§5 method 1).
// Append-only + idempotent on clientId, like every stamp.
export async function POST(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "clock:stamp");

    const body = await req.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId : null;
    if (!clientId) {
      return Response.json({ error: "missing_client_id" }, { status: 400 });
    }
    if (!body?.assertion) {
      return Response.json({ error: "missing_identity" }, { status: 400 });
    }

    // The Face ID assertion must belong to the signed-in user.
    const provenUserId = await finishAuthentication(body.assertion);
    if (provenUserId !== userId) {
      return Response.json({ error: "identity_failed" }, { status: 401 });
    }

    const direction: ClockDirection | undefined =
      body.direction === "IN" || body.direction === "OUT" ? body.direction : undefined;

    const result = await recordStamp({
      userId,
      restaurantId: activeRestaurantId,
      method: "WEBAUTHN",
      clientId,
      direction,
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : null,
    });

    return Response.json({
      ok: true,
      duplicate: result.duplicate,
      direction: result.direction,
      timestamp: result.event.timestamp.toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
