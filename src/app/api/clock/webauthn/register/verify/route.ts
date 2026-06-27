import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { finishRegistration } from "@/lib/webauthn";

// Verify the attestation and store the new credential (§5 method 1).
export async function POST(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "clock:viewOwn");

    const body = await req.json().catch(() => null);
    if (!body?.response) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const ok = await finishRegistration(
      userId,
      body.response,
      typeof body.deviceLabel === "string" ? body.deviceLabel : null,
    );
    if (!ok) return Response.json({ error: "verification_failed" }, { status: 400 });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
