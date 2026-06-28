import type { RestaurantTier } from "@prisma/client";
import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { TRIAL_DAYS } from "@/lib/billing";

const VALID_TIERS: RestaurantTier[] = ["BAS", "FULL"];

// POST { contact, code, displayName, restaurantName, orgNumber?, tier } →
// verifies the code and creates the Restaurant + founding owner in one
// transaction (§12.1 steps 2–4). The chosen `tier` is what they'll be billed
// for once the trial ends — during TRIALING the full package is unlocked
// regardless (enforced in guard.ts's getAccessContext, not here). An existing
// account (same contact, different restaurant already) just gets a second
// Membership — accounts are person-centric (§3.1), never restaurant-owned.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { contact, code, displayName, restaurantName, orgNumber, tier } = body ?? {};

  if (
    typeof contact !== "string" ||
    typeof code !== "string" ||
    typeof displayName !== "string" ||
    typeof restaurantName !== "string" ||
    !displayName.trim() ||
    !restaurantName.trim() ||
    !VALID_TIERS.includes(tier)
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const normalized = normalizeContact(contact);
  if (!normalized) {
    return Response.json({ error: "invalid_contact" }, { status: 400 });
  }

  const ok = await verifyCode(normalized, "SIGNUP", code);
  if (!ok) {
    return Response.json({ error: "invalid_code" }, { status: 401 });
  }

  const userWhere =
    normalized.type === "PHONE"
      ? { normalizedPhone: normalized.value }
      : { normalizedEmail: normalized.value };

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60_000);

  const { userId, restaurantId } = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: userWhere });
    if (!user) {
      user = await tx.user.create({
        data: {
          displayName: displayName.trim(),
          ...(normalized.type === "PHONE"
            ? { normalizedPhone: normalized.value }
            : { normalizedEmail: normalized.value }),
        },
      });
    }

    const restaurant = await tx.restaurant.create({
      data: {
        name: restaurantName.trim(),
        orgNumber: typeof orgNumber === "string" && orgNumber.trim() ? orgNumber.trim() : null,
        tier,
        subscriptionStatus: "TRIALING",
        trialStartedAt: now,
        trialEndsAt,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        restaurantId: restaurant.id,
        role: "OWNER",
        isBillingOwner: true,
      },
    });

    return { userId: user.id, restaurantId: restaurant.id };
  });

  await createSession({ userId, activeRestaurantId: restaurantId });
  return Response.json({ ok: true });
}
