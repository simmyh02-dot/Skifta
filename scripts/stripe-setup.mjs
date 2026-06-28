// One-off setup script (§12.3): creates the two Skifta Products in Stripe,
// each with a monthly and a yearly Price (yearly priced at 10 months — the
// "discount" the spec asks for as a retention lever), then prints the
// resulting Price ids to paste into .env. Safe to re-run — it skips any
// product that already exists by its lookup_key.
//
// Usage: node scripts/stripe-setup.mjs   (reads STRIPE_SECRET_KEY from .env)

import { readFileSync, existsSync } from "node:fs";
import Stripe from "stripe";

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^"(.*)"$/, "$1");
  }
}
loadDotEnv();

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error("STRIPE_SECRET_KEY is not set in .env — add your test secret key first.");
  process.exit(1);
}

const stripe = new Stripe(apiKey);

const PLANS = [
  { tier: "BAS", name: "Skifta Bas", monthlyKr: 249 },
  { tier: "FULL", name: "Skifta Fullt paket", monthlyKr: 499 },
];

async function findOrCreateProduct(tier, name) {
  const lookupKey = `skifta_${tier.toLowerCase()}`;
  const existing = await stripe.products.search({ query: `metadata['lookup_key']:'${lookupKey}'` });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({ name, metadata: { lookup_key: lookupKey } });
}

async function findOrCreatePrice(productId, lookupKey, unitAmount, interval) {
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const match = existing.data.find((p) => p.lookup_key === lookupKey);
  if (match) return match;
  return stripe.prices.create({
    product: productId,
    currency: "sek",
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
  });
}

const envLines = [];
for (const plan of PLANS) {
  const product = await findOrCreateProduct(plan.tier, plan.name);
  const monthly = await findOrCreatePrice(
    product.id,
    `skifta_${plan.tier.toLowerCase()}_monthly`,
    plan.monthlyKr * 100,
    "month",
  );
  // Yearly = 10x the monthly price (≈2 months free) as the discount lever (§12.3).
  const yearly = await findOrCreatePrice(
    product.id,
    `skifta_${plan.tier.toLowerCase()}_yearly`,
    plan.monthlyKr * 10 * 100,
    "year",
  );
  envLines.push(`STRIPE_PRICE_${plan.tier}_MONTHLY="${monthly.id}"`);
  envLines.push(`STRIPE_PRICE_${plan.tier}_YEARLY="${yearly.id}"`);
  console.log(`${plan.name}: monthly ${monthly.id}, yearly ${yearly.id}`);
}

console.log("\nAdd these to .env:\n");
console.log(envLines.join("\n"));
