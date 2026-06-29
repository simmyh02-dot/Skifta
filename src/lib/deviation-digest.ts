import { prisma } from "./prisma";
import { notifyDeviationDigest } from "./notify";

// §6.2/§6.3 weekly deviation digest — the only remaining gap noted against
// both sections. A best-effort summary to the owners ("X öppna avvikelser
// väntar på granskning") so flagged clock deviations don't just sit silent
// in the economy view between active payroll runs.

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60_000;

/** Pure decision: is this restaurant due for a digest right now? Never sent,
 *  or the last one was at least a week ago. */
export function isDigestDue(
  lastSentAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= DIGEST_INTERVAL_MS;
}

/**
 * Driven by the daily cron (shares the schedule rather than adding a second
 * Vercel Cron entry, same reasoning as the billing/retention jobs). For every
 * restaurant due for a digest, counts open deviations and — only if there are
 * any — notifies the owners and stamps `deviationDigestSentAt`. A restaurant
 * with zero open deviations still has its timestamp refreshed, so it doesn't
 * fire again until the next window even though nothing was sent.
 * Returns how many digests were actually sent.
 */
export async function runDeviationDigest(now: Date = new Date()): Promise<number> {
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true, deviationDigestSentAt: true },
  });

  let sent = 0;
  for (const r of restaurants) {
    if (!isDigestDue(r.deviationDigestSentAt, now)) continue;

    const openCount = await prisma.deviation.count({
      where: { restaurantId: r.id, status: "OPEN" },
    });

    if (openCount > 0) {
      await notifyDeviationDigest(r.id, r.name, openCount);
      sent++;
    }

    await prisma.restaurant.update({
      where: { id: r.id },
      data: { deviationDigestSentAt: now },
    });
  }
  return sent;
}
