import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getEconomyOverview } from "@/lib/economy-data";
import { monthBounds, periodKey } from "@/lib/economy";
import { EconomyView } from "@/components/economy/EconomyView";

export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  if (!ctx) redirect("/app");
  // Economy/admin is FULL tier + owner/co-owner only (§6.3, §12.3).
  if (!can(ctx, "economy:view")) redirect("/app/schedule");

  const now = new Date();
  const { start, end } = monthBounds(now);
  const [restaurant, user, overview] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { name: true, defaultExportFormat: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true },
    }),
    getEconomyOverview(session.activeRestaurantId, start, end),
  ]);

  return (
    <EconomyView
      role={ctx.role}
      restaurantName={restaurant?.name ?? ""}
      displayName={user?.displayName ?? ""}
      defaultFormat={restaurant?.defaultExportFormat ?? "CSV"}
      initialPeriod={periodKey(now)}
      initialOverview={overview}
    />
  );
}
