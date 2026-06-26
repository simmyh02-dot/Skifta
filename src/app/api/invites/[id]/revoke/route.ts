import { revokeInvite } from "@/lib/invite";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → revoke a still-pending invite (§4). Owner/co-owner only, scoped to
// their own restaurant so one restaurant can't revoke another's invite.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const ok = await revokeInvite(id, activeRestaurantId);
    if (!ok) {
      return Response.json({ error: "not_revocable" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
