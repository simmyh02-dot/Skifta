import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import {
  buildScheduleContext,
  proposeSchedule,
  resolveMembers,
  ScheduleAiUnavailableError,
} from "@/lib/ai/schedule-assistant";

// "Suggest" step of §8.1 (suggest → confirm → write). Turns the owner's free
// text into a structured shift proposal against real schedule context.
// **Writes nothing** — only /approve persists. FULL tier + admin via
// ai:schedule.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "ai:schedule");

    const body = await req.json().catch(() => null);
    const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
    if (!instruction) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const context = await buildScheduleContext(activeRestaurantId);
    const proposed = await proposeSchedule(instruction, context);
    const shifts = resolveMembers(proposed, context.members);

    return Response.json({ shifts });
  } catch (err) {
    if (err instanceof ScheduleAiUnavailableError) {
      return Response.json({ error: "ai_unavailable" }, { status: 503 });
    }
    return errorResponse(err);
  }
}
