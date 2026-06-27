import { prisma } from "./prisma";
import { hashSecret, verifySecret } from "./hash";

// Shared-tablet PIN method (§5 method 2). PINs are 4–6 digits, scoped per
// restaurant (the same person can have a different PIN at each venue), and
// stored only as a salted scrypt hash — never in clear (§5, §9). The spec is
// honest that a PIN is convenience, not strong security; buddy-punching is
// mitigated after the fact by the schedule-reasonableness check that surfaces
// in deviation review (§6.3), not by hardening the PIN itself.

const PIN_RE = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

/** Set (or replace) a member's PIN for one restaurant. */
export async function setPin(
  userId: string,
  restaurantId: string,
  pin: string,
): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const pinHash = await hashSecret(pin);
  await prisma.pinCredential.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    create: { userId, restaurantId, pinHash },
    update: { pinHash },
  });
  return true;
}

/** Resolve the member a PIN belongs to within a restaurant, or null. Checks
 *  every credential in constant-ish time (≤15 staff) so a wrong PIN never
 *  reveals which slot, if any, it was close to. */
export async function resolvePin(
  restaurantId: string,
  pin: string,
): Promise<string | null> {
  if (!isValidPin(pin)) return null;
  const creds = await prisma.pinCredential.findMany({
    where: { restaurantId },
    select: { userId: true, pinHash: true },
  });
  let matchedUserId: string | null = null;
  for (const c of creds) {
    // Verify all to avoid an early-exit timing signal.
    if (await verifySecret(pin, c.pinHash)) matchedUserId = c.userId;
  }
  return matchedUserId;
}
