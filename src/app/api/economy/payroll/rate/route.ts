import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";

// List members with their current base rate, for the rate-setting UI.
export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "economy:view");

    const members = await prisma.membership.findMany({
      where: { restaurantId: activeRestaurantId, endedAt: null },
      select: { userId: true, hourlyRate: true, user: { select: { displayName: true } } },
      orderBy: { user: { displayName: "asc" } },
    });
    return Response.json({
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.displayName,
        hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// Set a member's base hourly rate (§8.2 input). Admin + FULL tier. Restaurant-
// scoped: you can only set a rate for someone who is a member of your venue.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "settings:manage");
    await requirePermission(activeRestaurantId, "economy:view"); // FULL-tier gate

    const body = await req.json().catch(() => null);
    const userId = body?.userId;
    const rate = Number(body?.hourlyRate);
    if (typeof userId !== "string" || !Number.isFinite(rate) || rate < 0 || rate > 100000) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await prisma.membership.updateMany({
      where: { userId, restaurantId: activeRestaurantId, endedAt: null },
      data: { hourlyRate: rate },
    });
    if (result.count === 0) return Response.json({ error: "not_a_member" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
