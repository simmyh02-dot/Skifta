import { claimOpenShift } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → first-come claim of an OPEN shift (§6.1 FIRST_COME). Anyone can call
// this; `claimOpenShift` is the atomic gate that only lets the first caller win.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:viewOwn");

    const ok = await claimOpenShift(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "no_longer_open" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
