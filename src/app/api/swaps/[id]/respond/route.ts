import { acceptSwap } from "@/lib/swaps";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → a qualified colleague accepts a swap request (directed or broad).
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

    const ok = await acceptSwap(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "not_eligible" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
