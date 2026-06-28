import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FrozenView } from "@/components/billing/FrozenView";

export const dynamic = "force-dynamic";

// Reached only via /app's frozen check (§12.1 step 6) — deliberately does
// NOT go through getAccessContext, since that returns null for FROZEN
// restaurants by design; this page IS the escape hatch out of that state.
export default async function FrozenPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const [restaurant, membership, billingOwner] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { name: true, tier: true, subscriptionStatus: true },
    }),
    prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: session.userId, restaurantId: session.activeRestaurantId } },
      select: { isBillingOwner: true, endedAt: true },
    }),
    prisma.membership.findFirst({
      where: { restaurantId: session.activeRestaurantId, isBillingOwner: true, endedAt: null },
      select: { user: { select: { displayName: true } } },
    }),
  ]);
  if (!restaurant || !membership || membership.endedAt) redirect("/login");
  if (restaurant.subscriptionStatus !== "FROZEN") redirect("/app");

  return (
    <FrozenView
      restaurantName={restaurant.name}
      tier={restaurant.tier}
      isBillingOwner={membership.isBillingOwner}
      billingOwnerName={billingOwner?.user.displayName ?? null}
    />
  );
}
