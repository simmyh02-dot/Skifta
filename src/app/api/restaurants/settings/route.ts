import { errorResponse, getAccessContext, requireUser } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    const ctx = await getAccessContext(userId, activeRestaurantId);
    if (!ctx || !can(ctx, "members:manage")) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const updates: { name?: string; openShiftFill?: "FIRST_COME" | "MANUAL_PICK" } = {};

    if (typeof body?.name === "string" && body.name.trim().length > 0) {
      updates.name = body.name.trim().slice(0, 120);
    }
    if (body?.openShiftFill === "FIRST_COME" || body?.openShiftFill === "MANUAL_PICK") {
      updates.openShiftFill = body.openShiftFill;
    }
    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "no_valid_fields" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: activeRestaurantId },
      data: updates,
      select: { name: true, openShiftFill: true },
    });
    return Response.json({ ok: true, restaurant });
  } catch (err) {
    return errorResponse(err);
  }
}
