import { listTags, upsertTagsByName } from "@/lib/tags";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:viewOwn");
    return Response.json({ tags: await listTags(activeRestaurantId) });
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
    await requirePermission(activeRestaurantId, "tags:manage");

    const body = await req.json().catch(() => null);
    const name = body?.name;
    if (typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    await upsertTagsByName(activeRestaurantId, [name.trim()]);
    return Response.json({ tags: await listTags(activeRestaurantId) });
  } catch (err) {
    return errorResponse(err);
  }
}
