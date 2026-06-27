import { prisma } from "@/lib/prisma";
import { verifyClockToken } from "@/lib/clock-token";
import { resolvePin } from "@/lib/pin";
import { finishAuthentication } from "@/lib/webauthn";
import { recordStamp } from "@/lib/clock";
import type { ClockDirection, VerificationMethod } from "@prisma/client";

// The clock-in stamp (§5/§6.2). Public by design: identity is proven by the
// PIN or the WebAuthn assertion, place by the QR/kiosk token — no prior login.
// Idempotent on `clientId` so the offline queue can replay safely (§6.2).
//
// Body: { token, clientId, pin? | assertion?, direction?, timestamp?, deviceLabel? }

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("invalid_body");

    const restaurantId =
      typeof body.token === "string" ? verifyClockToken(body.token) : null;
    if (!restaurantId) return badRequest("invalid_token");

    const clientId = typeof body.clientId === "string" ? body.clientId : null;
    if (!clientId) return badRequest("missing_client_id");

    // Clock-in is a FULL-tier feature (§12.3). The kiosk has no session/role to
    // key on, so the tier gate is enforced on the restaurant directly here.
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { tier: true },
    });
    if (!restaurant) return badRequest("invalid_token");
    if (restaurant.tier !== "FULL") {
      return Response.json({ error: "tier_locked" }, { status: 403 });
    }

    // Resolve identity. WebAuthn (own phone + Face ID) or PIN (shared tablet).
    let userId: string | null = null;
    let method: VerificationMethod;
    if (body.assertion) {
      userId = await finishAuthentication(body.assertion);
      method = "WEBAUTHN";
    } else if (typeof body.pin === "string") {
      userId = await resolvePin(restaurantId, body.pin);
      method = "PIN";
    } else {
      return badRequest("missing_identity");
    }
    if (!userId) {
      return Response.json({ error: "identity_failed" }, { status: 401 });
    }

    // The proven person must actually belong to this restaurant.
    const membership = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      select: { endedAt: true },
    });
    if (!membership || membership.endedAt) {
      return Response.json({ error: "not_a_member" }, { status: 403 });
    }

    const timestamp =
      typeof body.timestamp === "string" ? new Date(body.timestamp) : undefined;
    if (timestamp && Number.isNaN(timestamp.getTime())) {
      return badRequest("invalid_timestamp");
    }
    const direction: ClockDirection | undefined =
      body.direction === "IN" || body.direction === "OUT" ? body.direction : undefined;

    const result = await recordStamp({
      userId,
      restaurantId,
      method,
      clientId,
      timestamp,
      direction,
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : null,
    });

    const person = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    return Response.json({
      ok: true,
      duplicate: result.duplicate,
      direction: result.direction,
      timestamp: result.event.timestamp.toISOString(),
      displayName: person?.displayName ?? "",
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
