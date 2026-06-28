import Stripe from "stripe";
import type { RestaurantTier } from "@prisma/client";

// Stripe checkout/portal client (§12.1, §12.3). One Stripe Price per
// tier × billing interval — created via the setup script
// (scripts/stripe-setup.ts), not hand-typed in the dashboard, so the IDs
// always match what's actually configured (price, currency, recurring
// interval) and never drift out of sync with this list.

export type BillingInterval = "MONTH" | "YEAR";

export class BillingUnavailableError extends Error {
  constructor() {
    super("billing_unavailable");
  }
}

let client: Stripe | null = null;

/** Throws BillingUnavailableError with no key configured (e.g. local dev
 *  before Stripe is wired up) — callers degrade to an explicit error
 *  response, never a fabricated checkout link. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingUnavailableError();
  client = new Stripe(key);
  return client;
}

const PRICE_ENV: Record<RestaurantTier, Record<BillingInterval, string>> = {
  BAS: { MONTH: "STRIPE_PRICE_BAS_MONTHLY", YEAR: "STRIPE_PRICE_BAS_YEARLY" },
  FULL: { MONTH: "STRIPE_PRICE_FULL_MONTHLY", YEAR: "STRIPE_PRICE_FULL_YEARLY" },
};

/** Looks up the configured Stripe Price id for a (tier, interval) pair.
 *  Throws BillingUnavailableError if that price hasn't been set up yet. */
export function priceIdFor(tier: RestaurantTier, interval: BillingInterval): string {
  const envVar = PRICE_ENV[tier][interval];
  const id = process.env[envVar];
  if (!id) throw new BillingUnavailableError();
  return id;
}
