import { setMemberTags } from "@/lib/tags";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

// POST { tagIds } → replace a member's competence tags within this restaurant.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const membership = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId, restaurantId: activeRestaurantId } },
    });
    if (!membership || membership.endedAt) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const tagIds = body?.tagIds;
    if (!Array.isArray(tagIds) || !tagIds.every((id) => typeof id === "string")) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    await setMemberTags(userId, activeRestaurantId, tagIds);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
