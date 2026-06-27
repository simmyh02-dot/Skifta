import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { monthBounds, parsePeriodKey } from "@/lib/economy";
import { buildPayrollDrafts } from "@/lib/payroll/data";
import { payrollNote } from "@/lib/ai/payroll-note";

// "Suggest" step of the §8.2 draft (suggest → confirm → write). Computes a
// deterministic per-employee draft and an AI presentation note. **Writes
// nothing** — the owner must explicitly approve before anything is persisted.
// FULL tier + admin via payroll:manage.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "payroll:manage");

    const body = await req.json().catch(() => null);
    const periodDate = parsePeriodKey(body?.period) ?? new Date();
    const { start, end } = monthBounds(periodDate);

    const preview = await buildPayrollDrafts(activeRestaurantId, start, end);

    const periodLabel = start.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
    const note = await payrollNote({
      periodLabel,
      members: preview.members.map((m) => ({
        name: m.name,
        baseHours: m.draft.baseHours,
        obHours: m.draft.obHours,
        gross: m.missingRate ? null : m.draft.grossAmount,
        missingRate: m.missingRate,
        unreviewed: m.unreviewed,
      })),
    });

    return Response.json({ ...preview, note });
  } catch (err) {
    return errorResponse(err);
  }
}
