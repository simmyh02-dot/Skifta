import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { monthBounds, parsePeriodKey } from "@/lib/economy";
import { approvePayroll } from "@/lib/payroll/data";

// "Confirm → write" step (§8). This is the only place a payroll draft is
// persisted, and it only runs behind the owner's explicit approval click — the
// AI never reaches it. Recomputes server-side (never trusts client numbers) and
// holds back any member with an unreviewed deviation or no rate (§6.3).
export async function POST(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "payroll:manage");

    const body = await req.json().catch(() => null);
    const periodDate = parsePeriodKey(body?.period) ?? new Date();
    const { start, end } = monthBounds(periodDate);

    const result = await approvePayroll(activeRestaurantId, userId, start, end);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
