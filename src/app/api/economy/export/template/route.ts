import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { parseColumnMapping, type ColumnMapping } from "@/lib/export-template";

// "Import my own template" (§6.3/§4): the owner uploads a sample export file,
// the client parses its header row and lets them map our known fields onto
// those columns, and this saves it as the restaurant's CUSTOM column layout.
// Admin + FULL tier, same gate as the OB-rule builder.
export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "economy:view");

    const template = await prisma.exportTemplate.findFirst({
      where: { restaurantId: activeRestaurantId, format: "CUSTOM", isDefault: true },
      select: { columnMapping: true },
    });
    return Response.json({ mapping: (template?.columnMapping as ColumnMapping | null) ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "settings:manage");
    await requirePermission(activeRestaurantId, "economy:view"); // FULL-tier gate

    const body = await req.json().catch(() => null);
    const mapping = parseColumnMapping(body?.mapping);
    if (!mapping) {
      return Response.json({ error: "invalid_mapping" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.exportTemplate.deleteMany({
        where: { restaurantId: activeRestaurantId, format: "CUSTOM" },
      }),
      prisma.exportTemplate.create({
        data: {
          restaurantId: activeRestaurantId,
          name: "Anpassad mall",
          format: "CUSTOM",
          columnMapping: mapping as unknown as object,
          isDefault: true,
        },
      }),
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
