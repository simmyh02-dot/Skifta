import type { ExportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { getEconomyOverview } from "@/lib/economy-data";
import {
  monthBounds,
  parsePeriodKey,
  periodKey,
  splitExportable,
  buildExportCsv,
} from "@/lib/economy";

const FORMATS: ExportFormat[] = ["FORTNOX", "VISMA", "CSV", "CUSTOM"];

// Export summarised hours for a period (§6.3). The §6.3 rule is enforced here,
// not just in the UI: a member with an unreviewed deviation is NEVER folded in
// silently. With unreviewed flags present the export is blocked (409) and the
// blocked names are returned; the owner must either review them or explicitly
// acknowledge exclusion (`?exclude=1`), which exports only the cleared members.
export async function GET(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "economy:export");

    const { searchParams } = new URL(req.url);
    const periodDate = parsePeriodKey(searchParams.get("period")) ?? new Date();
    const { start, end } = monthBounds(periodDate);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: activeRestaurantId },
      select: { defaultExportFormat: true, name: true },
    });
    const requested = searchParams.get("format")?.toUpperCase();
    const format: ExportFormat =
      requested && FORMATS.includes(requested as ExportFormat)
        ? (requested as ExportFormat)
        : restaurant?.defaultExportFormat ?? "CSV";

    const overview = await getEconomyOverview(activeRestaurantId, start, end);
    const { exportable, blocked } = splitExportable(overview.members);

    const acknowledged = searchParams.get("exclude") === "1";
    if (blocked.length > 0 && !acknowledged) {
      return Response.json(
        {
          error: "unreviewed_deviations",
          blocked: blocked.map((m) => ({ userId: m.userId, displayName: m.displayName })),
        },
        { status: 409 },
      );
    }

    const csv = buildExportCsv(exportable, format, { start, end });
    const key = periodKey(periodDate);
    const slug = (restaurant?.name ?? "skifta").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `${slug}-${key}-${format.toLowerCase()}.csv`;

    // BOM so Excel reads UTF-8 (å/ä/ö) correctly.
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
