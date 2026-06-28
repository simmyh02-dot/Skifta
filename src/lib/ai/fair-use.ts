import { prisma } from "../prisma";

// Soft AI fair-use cap during trial (§8.3). The cost is negligible (spec:
// well under 1 kr/restaurant/month) — this exists purely to catch extreme
// abuse (bot/misuse), not to limit legitimate customers. So on exceeding the
// cap it ONLY flags for manual review; it never blocks, throttles, or errors
// the caller. Only counts real AI calls (never a fallback/no-key path), and
// only while the restaurant is on TRIALING — paid usage is unmetered.

const TRIAL_FAIR_USE_CAP = 50;

/** Increments the trial AI-call counter and flags the restaurant (once) if it
 *  crosses the soft cap. No-op for non-trialing restaurants. Never throws —
 *  a tracking failure must never affect the AI feature itself. */
export async function recordAiCall(restaurantId: string): Promise<void> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { subscriptionStatus: true, trialAiCallCount: true, trialAiFlaggedAt: true },
    });
    if (!restaurant || restaurant.subscriptionStatus !== "TRIALING") return;

    const newCount = restaurant.trialAiCallCount + 1;
    const shouldFlag = !restaurant.trialAiFlaggedAt && newCount > TRIAL_FAIR_USE_CAP;

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        trialAiCallCount: newCount,
        ...(shouldFlag ? { trialAiFlaggedAt: new Date() } : {}),
      },
    });

    if (shouldFlag) {
      // Internal flag for manual review (§8.3) — no hard block. Same
      // console-only notification gap as the rest of the app; an admin alert
      // channel can read this signal later via `trialAiFlaggedAt`.
      console.warn(`[ai:fair-use] restaurant ${restaurantId} exceeded trial soft cap (${newCount} calls)`);
    }
  } catch {
    // Tracking is best-effort; never let it break the AI feature.
  }
}
