import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";

// Review lifecycle for one deviation (§6.3): öppen → granskad → godkänd, with an
// accountable owner. Three actions:
//   • review  — mark "granskad" (seen, parked).
//   • approve — "godkänn som stämplat": accept the actual clocked time as-is.
//   • adjust  — correct the time. This NEVER edits the stamp; ClockEvent is
//               append-only (§9, §13). It writes a ClockEventAdjustment that
//               points back at the original, then approves the deviation.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "deviation:review");

    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action !== "review" && action !== "approve" && action !== "adjust") {
      return Response.json({ error: "invalid_action" }, { status: 400 });
    }

    // Restaurant-scope the deviation: never act on another venue's flag.
    const deviation = await prisma.deviation.findFirst({
      where: { id, restaurantId: activeRestaurantId },
      select: { id: true, clockEventId: true },
    });
    if (!deviation) return Response.json({ error: "not_found" }, { status: 404 });

    if (action === "review") {
      await prisma.deviation.update({
        where: { id },
        data: { status: "REVIEWED", reviewedById: userId, reviewedAt: new Date() },
      });
      return Response.json({ ok: true });
    }

    const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

    if (action === "approve") {
      await prisma.deviation.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: userId,
          reviewedAt: new Date(),
          reason: reason || undefined,
        },
      });
      return Response.json({ ok: true });
    }

    // action === "adjust": needs a corrected time and a reason, and a stamp to
    // attach the correction to.
    if (!deviation.clockEventId) {
      return Response.json({ error: "no_stamp_to_adjust" }, { status: 409 });
    }
    const newTime = body?.newTime ? new Date(body.newTime) : null;
    if (!newTime || Number.isNaN(newTime.getTime()) || !reason) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.clockEventAdjustment.create({
        data: {
          originalEventId: deviation.clockEventId,
          adjustedById: userId,
          newTimestamp: newTime,
          reason,
        },
      }),
      prisma.deviation.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: userId,
          reviewedAt: new Date(),
          reason,
        },
      }),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
