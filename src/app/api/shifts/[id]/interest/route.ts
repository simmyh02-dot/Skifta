import { expressInterest } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → raise a hand for a MANUAL_PICK open shift (§6.1). The owner later
// picks one via /api/shifts/[id]/pick.
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

    const ok = await expressInterest(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "no_longer_open" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
