import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import {
  CUSTOM_RULE_SET_ID,
  OB_PRESETS,
  parseCustomRuleSet,
  presetById,
  type ObRuleSet,
} from "@/lib/payroll/rules";

// Pick or customize the restaurant's OB-rule template (§13). Owners either pick
// a preset, or edit their own windows/overtime (real collective agreements vary
// too much for two fixed presets) — either way it's stored versioned (OBRuleSet)
// so an approved draft can always trace back to exactly which rules applied.
// Admin + FULL tier.
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
      select: { name: true, rules: true },
    });
    const rules = active?.rules as ObRuleSet | undefined;
    const activeId = rules?.id ?? "none";
    return Response.json({
      activeId,
      presets: OB_PRESETS.map((p) => ({ id: p.id, name: p.name })),
      active: rules
        ? { name: active!.name, windows: rules.windows, overtime: rules.overtime }
        : null,
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

    let name: string;
    let rules: ObRuleSet;
    let activeId: string;

    if (body?.custom) {
      const parsed = parseCustomRuleSet(body.custom);
      if (!parsed) {
        return Response.json({ error: "invalid_custom_rules" }, { status: 400 });
      }
      name = parsed.name;
      rules = { id: CUSTOM_RULE_SET_ID, ...parsed };
      activeId = CUSTOM_RULE_SET_ID;
    } else {
      const preset = OB_PRESETS.find((p) => p.id === body?.presetId);
      if (!preset) return Response.json({ error: "invalid_preset" }, { status: 400 });
      name = preset.name;
      rules = presetById(preset.id);
      activeId = preset.id;
    }

    const latest = await prisma.oBRuleSet.findFirst({
      where: { restaurantId: activeRestaurantId, name },
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
          name,
          version,
          rules: rules as unknown as object,
          isActive: true,
          createdById: userId,
        },
      }),
    ]);
    return Response.json({ ok: true, activeId });
  } catch (err) {
    return errorResponse(err);
  }
}
