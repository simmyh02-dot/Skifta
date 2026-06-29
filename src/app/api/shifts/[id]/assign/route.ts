import { assignToShift } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST { userId } → owner directly fills one of a shift's open slots
// (§6.1 multi-slot). Distinct from /pick: this isn't gated on an existing
// ShiftInterest row, it's the owner reaching for a specific qualified member.
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

    const ok = await assignToShift(id, activeRestaurantId, userId);
    if (!ok) return Response.json({ error: "no_open_slot" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
