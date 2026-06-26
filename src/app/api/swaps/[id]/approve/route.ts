import { approveSwap } from "@/lib/swaps";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → owner/co-owner approves an ACCEPTED swap; the shift reassigns.
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
    await requirePermission(activeRestaurantId, "swap:approve");

    const ok = await approveSwap(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "not_eligible" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
