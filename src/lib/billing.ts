import { prisma } from "./prisma";
import { getSender } from "./messaging";

// Trial lifecycle (§12.1): 30 days, full package unlocked regardless of the
// chosen tier, a reminder e-mail on day 25–28, and a freeze (never an auto
// charge) if no card is on file by day 30. This module holds the two
// time-driven steps; `getEffectiveTier` (the "full package during trial"
// rule) lives in `guard.ts` next to the rest of the access logic.

export const TRIAL_DAYS = 30;
const REMINDER_WINDOW_DAYS = 5; // remind once trialEndsAt is this close

async function billingOwnerContact(restaurantId: string) {
  const membership = await prisma.membership.findFirst({
    where: { restaurantId, isBillingOwner: true, endedAt: null },
    include: { user: { select: { normalizedEmail: true, normalizedPhone: true } } },
  });
  if (!membership) return null;
  const { normalizedEmail, normalizedPhone } = membership.user;
  if (normalizedEmail) return { type: "EMAIL" as const, value: normalizedEmail };
  if (normalizedPhone) return { type: "PHONE" as const, value: normalizedPhone };
  return null;
}

/** Day 25–28 reminder (§12.1 step 6) — sent at most once per restaurant. */
export async function sendTrialReminders(now: Date = new Date()): Promise<number> {
  const dueBy = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60_000);
  const restaurants = await prisma.restaurant.findMany({
    where: {
      subscriptionStatus: "TRIALING",
      trialReminderSentAt: null,
      trialEndsAt: { lte: dueBy, gt: now },
    },
    select: { id: true, name: true },
  });

  let sent = 0;
  for (const restaurant of restaurants) {
    const contact = await billingOwnerContact(restaurant.id);
    if (!contact) continue; // no billing owner contact on file — nothing to notify
    await getSender().send(
      contact,
      `Din gratis provperiod för ${restaurant.name} på Skifta går ut snart. Lägg till ett betalkort för att fortsätta utan avbrott.`,
      "Din provperiod går snart ut",
    );
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { trialReminderSentAt: now },
    });
    sent++;
  }
  return sent;
}

/** Day 30 freeze (§12.1 step 6) — never an automatic charge, just blocks
 *  login until payment; data is preserved (nothing is deleted or modified
 *  besides the status flag). Only freezes restaurants with no subscription
 *  attached, i.e. no card was ever connected. */
export async function freezeExpiredTrials(now: Date = new Date()): Promise<number> {
  const result = await prisma.restaurant.updateMany({
    where: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: { lte: now },
      stripeSubscriptionId: null,
    },
    data: { subscriptionStatus: "FROZEN" },
  });
  return result.count;
}
