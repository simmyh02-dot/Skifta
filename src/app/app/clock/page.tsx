import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ClockView } from "@/components/clock/ClockView";

export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  if (!ctx) redirect("/app");
  // Clock-in is FULL tier only (§12.3); Bas members have no clock section.
  if (!can(ctx, "clock:viewOwn")) redirect("/app/schedule");

  const [restaurant, user] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true },
    }),
  ]);

  return (
    <ClockView
      role={ctx.role}
      restaurantName={restaurant?.name ?? ""}
      displayName={user?.displayName ?? ""}
    />
  );
}
