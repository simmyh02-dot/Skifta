import type { ExportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";

const FORMATS: ExportFormat[] = ["FORTNOX", "VISMA", "CSV", "CUSTOM"];

// "Spara som min standard" (§6.3): the chosen export format becomes the
// restaurant's default so it never has to be reconfigured. Admin-only.
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "settings:manage");
    await requirePermission(activeRestaurantId, "economy:view"); // FULL-tier gate

    const body = await req.json().catch(() => null);
    const format = body?.format?.toUpperCase?.();
    if (!format || !FORMATS.includes(format as ExportFormat)) {
      return Response.json({ error: "invalid_format" }, { status: 400 });
    }

    await prisma.restaurant.update({
      where: { id: activeRestaurantId },
      data: { defaultExportFormat: format as ExportFormat },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
