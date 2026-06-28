import { requireUser, requireBillingOwner, errorResponse } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getStripe, BillingUnavailableError } from "@/lib/stripe";

// POST → opens Stripe's hosted billing portal (manage/cancel subscription,
// update card) for a restaurant that has already checked out at least once.
// Billing-owner only, same exception as /api/billing/checkout.
export async function POST() {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requireBillingOwner(activeRestaurantId);

    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: activeRestaurantId },
      select: { stripeCustomerId: true },
    });
    if (!restaurant.stripeCustomerId) {
      return Response.json({ error: "no_customer" }, { status: 400 });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const session = await stripe.billingPortal.sessions.create({
      customer: restaurant.stripeCustomerId,
      return_url: `${appUrl}/app/billing`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingUnavailableError) {
      return Response.json({ error: "billing_unavailable" }, { status: 503 });
    }
    return errorResponse(err);
  }
}
