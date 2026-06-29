import { createShift, expandWeekdayDates } from "@/lib/shifts";
import { localDateTimeToUtc } from "@/lib/local-time";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST { startDate, endDate, weekdays[], startTime, endTime, assignedUserId?,
// slots?, note?, requiredTagNames? } → recurring/bulk shift creation (§6.1):
// one shift per matching weekday in the date range, owner/co-owner only.
// `weekdays` uses 0=Monday…6=Sunday, matching `Availability.weekday`. Reuses
// `createShift` per date (double-booking guard, tag auto-create); a single
// bad date is skipped and reported rather than failing the whole batch — the
// same pattern as the AI schedule approve route.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "shift:manage");

    const body = await req.json().catch(() => null);
    const startDate = body?.startDate;
    const endDate = body?.endDate;
    const weekdays = Array.isArray(body?.weekdays)
      ? body.weekdays.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6)
      : [];
    const startTime = body?.startTime;
    const endTime = body?.endTime;

    if (
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      weekdays.length === 0
    ) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const slots = typeof body?.slots === "number" && body.slots > 0 ? body.slots : 1;
    const assignedUserId =
      typeof body?.assignedUserId === "string" ? body.assignedUserId : null;
    const note = typeof body?.note === "string" ? body.note : null;
    const requiredTagNames = Array.isArray(body?.requiredTagNames)
      ? body.requiredTagNames.filter((n: unknown) => typeof n === "string")
      : [];

    const dates = expandWeekdayDates(startDate, endDate, weekdays);
    const created = [];
    const skipped: { date: string; reason: string }[] = [];

    for (const date of dates) {
      const startsAt = localDateTimeToUtc(date, startTime);
      const endsAt = localDateTimeToUtc(date, endTime);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        skipped.push({ date, reason: "invalid_time" });
        continue;
      }
      try {
        const shift = await createShift({
          restaurantId: activeRestaurantId,
          startsAt,
          endsAt,
          assignedUserId,
          slots,
          note,
          requiredTagNames,
        });
        created.push(shift);
      } catch {
        skipped.push({ date, reason: "double_booked" });
      }
    }

    return Response.json({ created: created.length, skipped });
  } catch (err) {
    return errorResponse(err);
  }
}
