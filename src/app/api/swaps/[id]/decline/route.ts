import { declineSwap } from "@/lib/swaps";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → the directed colleague declines; owner can then re-direct or
// convert to a broad request manually.
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
    await requirePermission(activeRestaurantId, "swap:request");

    const ok = await declineSwap(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "not_eligible" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
