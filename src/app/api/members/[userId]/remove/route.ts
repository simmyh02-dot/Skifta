import { removeMember } from "@/lib/gdpr";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST → §13 "anställd slutar" / right-to-erasure: end this person's membership,
// clear their restaurant-scoped secrets + tags, and anonymize the global User
// if this was their last restaurant. Clock/payroll history is preserved.
// Owner/co-owner only (members:manage); works on both tiers.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: targetUserId } = await params;
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    // Don't let an admin remove themselves out from under the restaurant.
    if (targetUserId === userId) {
      return Response.json({ error: "cannot_remove_self" }, { status: 409 });
    }

    const result = await removeMember(targetUserId, activeRestaurantId);
    if (!result.ended) {
      return Response.json({ error: "not_a_member" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
