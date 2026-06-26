import { prisma } from "@/lib/prisma";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// GET → active members of the current restaurant with their tags (§3, §7).
// Used by the admin UI for member/tag management.
export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const memberships = await prisma.membership.findMany({
      where: { restaurantId: activeRestaurantId, endedAt: null },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            employeeTags: { include: { tag: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      members: memberships.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        tagIds: m.user.employeeTags
          .filter((et) => et.tag.restaurantId === activeRestaurantId)
          .map((et) => et.tagId),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
