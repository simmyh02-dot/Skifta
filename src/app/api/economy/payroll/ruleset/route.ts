import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { OB_PRESETS, presetById } from "@/lib/payroll/rules";

// Pick the restaurant's OB-rule template (§13). Rules come from preset templates
// the owner chooses, not free-form entry — that keeps misconfiguration low. The
// chosen preset is stored versioned (OBRuleSet) so an approved draft can trace
// to exactly which rules applied. Admin + FULL tier.
export async function GET() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "economy:view");

    const active = await prisma.oBRuleSet.findFirst({
      where: { restaurantId: activeRestaurantId, isActive: true },
      orderBy: { version: "desc" },
      select: { rules: true },
    });
    const activeId = (active?.rules as { id?: string } | null)?.id ?? "none";
    return Response.json({
      activeId,
      presets: OB_PRESETS.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { userId, activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "settings:manage");
    await requirePermission(activeRestaurantId, "economy:view"); // FULL-tier gate

    const body = await req.json().catch(() => null);
    const preset = OB_PRESETS.find((p) => p.id === body?.presetId);
    if (!preset) return Response.json({ error: "invalid_preset" }, { status: 400 });

    const latest = await prisma.oBRuleSet.findFirst({
      where: { restaurantId: activeRestaurantId, name: preset.name },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    await prisma.$transaction([
      prisma.oBRuleSet.updateMany({
        where: { restaurantId: activeRestaurantId, isActive: true },
        data: { isActive: false },
      }),
      prisma.oBRuleSet.create({
        data: {
          restaurantId: activeRestaurantId,
          name: preset.name,
          version,
          rules: presetById(preset.id) as unknown as object,
          isActive: true,
          createdById: userId,
        },
      }),
    ]);
    return Response.json({ ok: true, activeId: preset.id });
  } catch (err) {
    return errorResponse(err);
  }
}
