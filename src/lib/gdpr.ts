import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AuthError } from "./guard";

// §13 GDPR — right to erasure that doesn't collide with accounting law.
//
// Two hard constraints shape this module:
//  1. Accounts are person-centric (CLAUDE.md rule #3): one User can work at
//     several restaurants. Removing them from ONE restaurant must never scrub
//     the identity they still use at another. We only anonymize the global User
//     once their last active membership has ended.
//  2. `ClockEvent` is append-only and must survive for the statutory accounting
//     period (§13). So erasure ANONYMIZES the person (name + contact + auth
//     secrets) while leaving the time records and aggregated payroll in place —
//     pointing at a now-nameless user. "Persondata anonymiseras, aggregerat
//     löneunderlag bevaras."

/** What a scrubbed person's name becomes — a sentinel, not a real name. */
export const ANONYMIZED_LABEL = "Raderad användare";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Globally scrub a User's personal data: null the contact points, replace the
 * display name with the sentinel, drop every auth secret (WebAuthn keys + all
 * PINs), and stamp `anonymizedAt`. Idempotent. Does NOT touch ClockEvents,
 * memberships, or payroll rows — those are kept for accounting and just lose
 * their link to a named person. Only call once no active membership remains.
 */
export async function anonymizeUser(userId: string, db: Db = prisma): Promise<void> {
  await db.webAuthnCredential.deleteMany({ where: { userId } });
  await db.pinCredential.deleteMany({ where: { userId } });
  await db.user.update({
    where: { id: userId },
    data: {
      displayName: ANONYMIZED_LABEL,
      normalizedPhone: null,
      normalizedEmail: null,
      anonymizedAt: new Date(),
    },
  });
}

export type RemoveMemberResult = {
  ended: boolean; // the membership was active and is now closed
  anonymized: boolean; // this was their last restaurant, so the person was scrubbed
};

/**
 * §13 "anställd slutar" / right-to-erasure for one restaurant. Ends the
 * membership, removes this restaurant's auth secret (PIN) and competence tags,
 * and — only if the person no longer works at any restaurant — anonymizes the
 * global User. The shift/clock history stays put for payroll + accounting.
 * Refuses to remove the billing owner (that would orphan the subscription).
 */
export async function removeMember(
  userId: string,
  restaurantId: string,
): Promise<RemoveMemberResult> {
  const membership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  if (!membership || membership.endedAt) return { ended: false, anonymized: false };
  if (membership.isBillingOwner) throw new AuthError(409, "cannot_remove_billing_owner");

  return prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { endedAt: new Date() },
    });
    // Restaurant-scoped data the owner is entitled to clear right away.
    await tx.pinCredential.deleteMany({ where: { userId, restaurantId } });
    await tx.employeeTag.deleteMany({ where: { userId, tag: { restaurantId } } });

    const stillActive = await tx.membership.count({
      where: { userId, endedAt: null },
    });
    if (stillActive === 0) {
      await anonymizeUser(userId, tx);
      return { ended: true, anonymized: true };
    }
    return { ended: true, anonymized: false };
  });
}

// ───────────────────── Retention sweep (pure core) ─────────────────────

/** Whole months between two instants (floor). */
export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) -
    (to.getDate() < from.getDate() ? 1 : 0)
  );
}

export type MembershipRetentionInput = {
  restaurantId: string;
  endedAt: Date | null;
};

/**
 * Pure decision: may this person's PII be auto-anonymized now? Yes only when
 * EVERY membership has ended and each ended longer ago than its own
 * restaurant's `anonymizeAfterMonths`. A restaurant with no policy on file (or
 * `null` months) blocks anonymization — we never scrub on an unset policy.
 * Person-centric by construction: one still-active or still-within-window
 * membership anywhere keeps the whole person intact.
 */
export function eligibleForAnonymization(
  memberships: MembershipRetentionInput[],
  anonymizeMonthsByRestaurant: Map<string, number | null>,
  now: Date,
): boolean {
  if (memberships.length === 0) return false;
  return memberships.every((m) => {
    if (!m.endedAt) return false;
    const months = anonymizeMonthsByRestaurant.get(m.restaurantId);
    if (months == null) return false;
    return monthsBetween(m.endedAt, now) >= months;
  });
}

/**
 * §13 automatic retention: anonymize the PII of people whose employment ended
 * longer ago than each restaurant's `RetentionPolicy.anonymizeAfterMonths`.
 * Driven by the daily cron. ClockEvents themselves are kept (append-only,
 * accounting) — once the user is anonymized they're just nameless timestamps.
 * Returns how many people were anonymized.
 */
export async function runRetentionSweep(now: Date = new Date()): Promise<number> {
  const policies = await prisma.retentionPolicy.findMany({
    select: { restaurantId: true, anonymizeAfterMonths: true },
  });
  const monthsByRestaurant = new Map(
    policies.map((p) => [p.restaurantId, p.anonymizeAfterMonths]),
  );

  // Candidates: not yet anonymized, with no active membership anywhere.
  const candidates = await prisma.user.findMany({
    where: { anonymizedAt: null, memberships: { every: { endedAt: { not: null } } } },
    select: {
      id: true,
      memberships: { select: { restaurantId: true, endedAt: true } },
    },
  });

  let anonymized = 0;
  for (const user of candidates) {
    if (user.memberships.length === 0) continue; // never employed — leave alone
    if (eligibleForAnonymization(user.memberships, monthsByRestaurant, now)) {
      await anonymizeUser(user.id);
      anonymized++;
    }
  }
  return anonymized;
}
