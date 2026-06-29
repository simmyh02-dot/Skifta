import { unassignFromShift } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST { userId } → owner removes one person from a shift's filled slots
// (§6.1 multi-slot). Reopens the shift if it's no longer full.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:manage");

    const body = await req.json().catch(() => null);
    const userId = body?.userId;
    if (typeof userId !== "string") {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const ok = await unassignFromShift(id, activeRestaurantId, userId);
    if (!ok) return Response.json({ error: "not_assigned" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
