import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { isAdminRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { BillingView } from "@/components/billing/BillingView";

export const dynamic = "force-dynamic";

function trialDaysLeftFrom(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((+new Date(trialEndsAt) - Date.now()) / 86_400_000));
}

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  // Frozen restaurants are routed via /app → /app/frozen instead (getAccessContext
  // returns null for FROZEN, same as "no membership" — handled by the redirect below).
  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  if (!ctx || !isAdminRole(ctx.role)) redirect("/app");

  const [restaurant, membership, billingOwner, currentUser] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: {
        name: true,
        tier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        stripeCustomerId: true,
      },
    }),
    prisma.membership.findUnique({
      where: { userId_restaurantId: { userId: session.userId, restaurantId: session.activeRestaurantId } },
      select: { isBillingOwner: true },
    }),
    prisma.membership.findFirst({
      where: { restaurantId: session.activeRestaurantId, isBillingOwner: true, endedAt: null },
      select: { user: { select: { displayName: true } } },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true },
    }),
  ]);
  if (!restaurant) redirect("/app");

  const trialDaysLeft = trialDaysLeftFrom(restaurant.trialEndsAt);

  return (
    <BillingView
      restaurantName={restaurant.name}
      displayName={currentUser?.displayName ?? ""}
      tier={restaurant.tier}
      subscriptionStatus={restaurant.subscriptionStatus}
      trialDaysLeft={trialDaysLeft}
      hasStripeCustomer={Boolean(restaurant.stripeCustomerId)}
      isBillingOwner={membership?.isBillingOwner ?? false}
      billingOwnerName={billingOwner?.user.displayName ?? null}
    />
  );
}
