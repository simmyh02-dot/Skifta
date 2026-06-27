import { prisma } from "@/lib/prisma";
import { verifyClockToken } from "@/lib/clock-token";
import { onShiftNow } from "@/lib/clock";

// Live "on shift now" list for the kiosk (§6.2/§6.3). Public, scoped by the
// kiosk token, FULL-tier only — it shows who is currently clocked in, the same
// data the owner's realtime overview uses.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const restaurantId = token ? verifyClockToken(token) : null;
    if (!restaurantId) {
      return Response.json({ error: "invalid_token" }, { status: 400 });
    }
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { tier: true },
    });
    if (!restaurant) return Response.json({ error: "invalid_token" }, { status: 400 });
    if (restaurant.tier !== "FULL") {
      return Response.json({ error: "tier_locked" }, { status: 403 });
    }

    const onShift = await onShiftNow(restaurantId);
    return Response.json({ onShift });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
