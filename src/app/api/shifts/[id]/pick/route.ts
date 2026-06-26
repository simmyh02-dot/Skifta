import { pickInterested } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST { userId } → owner picks one of the interested employees for a
// MANUAL_PICK open shift (§6.1).
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

    const ok = await pickInterested(id, userId, activeRestaurantId);
    if (!ok) return Response.json({ error: "no_longer_open" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
