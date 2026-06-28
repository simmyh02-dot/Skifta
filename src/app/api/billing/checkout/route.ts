import type { RestaurantTier } from "@prisma/client";
import { requireUser, requireBillingOwner, errorResponse } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getStripe, priceIdFor, BillingUnavailableError, type BillingInterval } from "@/lib/stripe";

const VALID_TIERS: RestaurantTier[] = ["BAS", "FULL"];
const VALID_INTERVALS: BillingInterval[] = ["MONTH", "YEAR"];

// POST { interval, tier? } → creates a Stripe Checkout session that converts
// the trial into a paid subscription (§12.1 step 6–7). Billing-owner only
// (§3.2, the one exception where OWNER/CO_OWNER aren't interchangeable).
// Writes nothing to the restaurant itself — that only happens once the
// webhook confirms payment (suggest → confirm → write applies to money too).
export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requireBillingOwner(activeRestaurantId);

    const body = await req.json().catch(() => null);
    const interval = body?.interval;
    if (!VALID_INTERVALS.includes(interval)) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: activeRestaurantId },
      select: { tier: true, stripeCustomerId: true, name: true, subscriptionStatus: true },
    });
    // Already has a running subscription — buying again would create a
    // second one instead of changing the existing one. Upgrade/downgrade/
    // cancel goes through the portal instead (/api/billing/portal). The UI
    // already hides these buttons for ACTIVE/PAST_DUE; this is the
    // server-side enforcement of the same rule (never just UI-hiding).
    if (restaurant.subscriptionStatus === "ACTIVE" || restaurant.subscriptionStatus === "PAST_DUE") {
      return Response.json({ error: "already_subscribed" }, { status: 409 });
    }
    const tier: RestaurantTier = VALID_TIERS.includes(body?.tier) ? body.tier : restaurant.tier;
    const priceId = priceIdFor(tier, interval);

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    let customerId = restaurant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: restaurant.name,
        metadata: { restaurantId: activeRestaurantId },
      });
      customerId = customer.id;
      await prisma.restaurant.update({
        where: { id: activeRestaurantId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/billing?checkout=success`,
      cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
      metadata: { restaurantId: activeRestaurantId, tier },
      subscription_data: { metadata: { restaurantId: activeRestaurantId, tier } },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingUnavailableError) {
      return Response.json({ error: "billing_unavailable" }, { status: 503 });
    }
    return errorResponse(err);
  }
}
