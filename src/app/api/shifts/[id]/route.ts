import { updateShift, deleteShift } from "@/lib/shifts";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

export async function PATCH(
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
    const shift = await updateShift(id, activeRestaurantId, {
      startsAt: body?.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body?.endsAt ? new Date(body.endsAt) : undefined,
      slots: typeof body?.slots === "number" && body.slots > 0 ? body.slots : undefined,
      note: body?.note === undefined ? undefined : body.note,
      requiredTagNames: Array.isArray(body?.requiredTagNames)
        ? body.requiredTagNames.filter((n: unknown) => typeof n === "string")
        : undefined,
    });
    if (!shift) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ shift });
  } catch (err) {
    return errorResponse(err);
  }
}

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
    await requirePermission(activeRestaurantId, "shift:manage");

    const ok = await deleteShift(id, activeRestaurantId);
    if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
