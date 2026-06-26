import { startSwap } from "@/lib/swaps";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → the "Can't work / sick" button (§6.1) on one of my own assigned
// shifts. Starts a swap request in the restaurant's default mode.
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

    const swap = await startSwap(id, userId, activeRestaurantId);
    if (!swap) {
      return Response.json({ error: "not_your_assigned_shift" }, { status: 409 });
    }
    return Response.json({ swap });
  } catch (err) {
    return errorResponse(err);
  }
}
