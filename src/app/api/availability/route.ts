import { getAvailability, setAvailability } from "@/lib/availability";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// GET → my own recurring weekly availability.
// PUT { ranges: [{ weekday, startMinute, endMinute }] } → replace it.
export async function GET() {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "availability:setOwn");

    return Response.json({
      ranges: await getAvailability(userId, activeRestaurantId),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "availability:setOwn");

    const body = await req.json().catch(() => null);
    const ranges = body?.ranges;
    if (
      !Array.isArray(ranges) ||
      !ranges.every(
        (r) =>
          typeof r?.weekday === "number" &&
          r.weekday >= 0 &&
          r.weekday <= 6 &&
          typeof r?.startMinute === "number" &&
          typeof r?.endMinute === "number" &&
          r.endMinute > r.startMinute,
      )
    ) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    await setAvailability(userId, activeRestaurantId, ranges);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
