import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, BillingUnavailableError } from "@/lib/stripe";

// Stripe webhook (§12.1 step 7) — the only place that actually writes payment
// outcome to the Restaurant row. Checkout/portal only ever *start* a Stripe
// flow; this confirms it. Signature-verified against the raw body, so it
// can't be spoofed by posting a fake "payment succeeded" event.
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return Response.json({ error: "billing_unavailable" }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    if (err instanceof BillingUnavailableError) {
      return Response.json({ error: "billing_unavailable" }, { status: 503 });
    }
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const restaurantId = session.metadata?.restaurantId;
        if (!restaurantId || typeof session.subscription !== "string") break;
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: {
            subscriptionStatus: "ACTIVE",
            stripeSubscriptionId: session.subscription,
            ...(session.metadata?.tier === "BAS" || session.metadata?.tier === "FULL"
              ? { tier: session.metadata.tier }
              : {}),
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === "active" ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : null;
        if (!status) break;
        await prisma.restaurant.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { subscriptionStatus: status },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.restaurant.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { subscriptionStatus: "CANCELED" },
        });
        break;
      }
      default:
        break; // not every event type matters to us
    }
  } catch (err) {
    console.error("[billing:webhook]", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }

  return Response.json({ received: true });
}
