import { prisma } from "@/lib/prisma";
import { createShift } from "@/lib/shifts";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";

type ShiftInput = {
  memberId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  requiredTags?: string[];
};

// "Confirm → write" step of §8.1. The owner has already reviewed/edited the
// exact list shown in the confirmation card; this is the only place a shift
// is persisted from the AI flow, and it re-validates every row server-side
// (real member of this restaurant, valid date/time) rather than trusting the
// client. The AI itself never reaches this route.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "ai:schedule");

    const body = await req.json().catch(() => null);
    const rows: ShiftInput[] = Array.isArray(body?.shifts) ? body.shifts : [];
    if (rows.length === 0) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const memberIds = rows.map((r) => r.memberId).filter((id): id is string => !!id);
    const validMembers = await prisma.membership.findMany({
      where: { restaurantId: activeRestaurantId, endedAt: null, userId: { in: memberIds } },
      select: { userId: true },
    });
    const validIds = new Set(validMembers.map((m) => m.userId));

    const created = [];
    const skipped: { date: string; startTime: string; reason: string }[] = [];

    for (const row of rows) {
      const startsAt = new Date(`${row.date}T${row.startTime}:00`);
      const endsAt = new Date(`${row.date}T${row.endTime}:00`);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
        skipped.push({ date: row.date, startTime: row.startTime, reason: "invalid_time" });
        continue;
      }
      const assignedUserId = row.memberId && validIds.has(row.memberId) ? row.memberId : null;
      if (row.memberId && !assignedUserId) {
        skipped.push({ date: row.date, startTime: row.startTime, reason: "unknown_member" });
        continue;
      }

      const shift = await createShift({
        restaurantId: activeRestaurantId,
        startsAt,
        endsAt,
        assignedUserId,
        requiredTagNames: Array.isArray(row.requiredTags) ? row.requiredTags : [],
      });
      created.push(shift);
    }

    return Response.json({ created: created.length, skipped });
  } catch (err) {
    return errorResponse(err);
  }
}
