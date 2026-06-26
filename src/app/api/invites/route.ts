import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { createInvite } from "@/lib/invite";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// GET → list this restaurant's invites (most recent first).
// POST { name, contact, role } → create + send a personal invite link (§4).
// Both require `members:manage` (owner/co-owner only).

export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const invites = await prisma.invite.findMany({
      where: { restaurantId: activeRestaurantId },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ invites });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    const { userId } = await requirePermission(
      activeRestaurantId,
      "members:manage",
    );

    const body = await req.json().catch(() => null);
    const name = body?.name;
    const contactInput = body?.contact;
    const role = body?.role;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof contactInput !== "string" ||
      (role !== "EMPLOYEE" && role !== "CO_OWNER")
    ) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const contact = normalizeContact(contactInput);
    if (!contact) {
      return Response.json({ error: "invalid_contact" }, { status: 400 });
    }

    const invite = await createInvite({
      restaurantId: activeRestaurantId,
      createdById: userId,
      name: name.trim(),
      contact,
      role,
    });

    return Response.json({ invite });
  } catch (err) {
    return errorResponse(err);
  }
}
