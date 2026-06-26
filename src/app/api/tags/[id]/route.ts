import { deleteTag } from "@/lib/tags";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "tags:manage");

    const ok = await deleteTag(id, activeRestaurantId);
    if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
