import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import type { NormalizedContact } from "./contact";
import { getSender } from "./messaging";

// Invite lifecycle (§4). A personal one-time link, bound at creation time to a
// normalized contact + restaurant + intended role. The accept step re-verifies
// that same contact via OTP, so a forwarded link is useless to anyone else.

const TTL_DAYS = 7;

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export type CreateInviteInput = {
  restaurantId: string;
  createdById: string;
  name: string;
  contact: NormalizedContact;
  role: Role;
  isBillingOwner?: boolean;
  tagIds?: string[];
};

export async function createInvite(input: CreateInviteInput) {
  const token = generateToken();
  const invite = await prisma.invite.create({
    data: {
      token,
      restaurantId: input.restaurantId,
      createdById: input.createdById,
      name: input.name,
      contactType: input.contact.type,
      normalizedContact: input.contact.value,
      role: input.role,
      isBillingOwner: input.isBillingOwner ?? false,
      intendedTagIds: input.tagIds ?? [],
      expiresAt: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60_000),
    },
    include: { restaurant: { select: { name: true } } },
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/join/${token}`;
  await getSender().send(
    { type: input.contact.type, value: input.contact.value },
    `Du har blivit inbjuden till ${invite.restaurant.name} på Skifta: ${url} (giltig ${TTL_DAYS} dagar)`,
    `Inbjudan till ${invite.restaurant.name}`,
  );

  return invite;
}

export type LiveInvite = Awaited<ReturnType<typeof getLiveInvite>>;

/** A PENDING, non-expired invite for this token, or null. Does not mutate. */
export async function getLiveInvite(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { restaurant: { select: { name: true } } },
  });
  if (!invite) return null;
  if (invite.status !== "PENDING") return null;
  if (invite.expiresAt <= new Date()) return null;
  return invite;
}

export async function revokeInvite(
  inviteId: string,
  restaurantId: string,
): Promise<boolean> {
  const result = await prisma.invite.updateMany({
    where: { id: inviteId, restaurantId, status: "PENDING" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  return result.count > 0;
}

/**
 * Consume a live invite for a contact that has just been OTP-verified.
 * Creates the membership, and the User too if this contact has no account yet
 * (§4: an existing account just gets a second Membership, never a duplicate).
 */
export async function acceptInvite(
  token: string,
  displayNameIfNew: string,
): Promise<{ userId: string; restaurantId: string } | null> {
  const invite = await getLiveInvite(token);
  if (!invite) return null;

  const userWhere =
    invite.contactType === "PHONE"
      ? { normalizedPhone: invite.normalizedContact }
      : { normalizedEmail: invite.normalizedContact };

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: userWhere });
    if (!user) {
      user = await tx.user.create({
        data: {
          displayName: displayNameIfNew || invite.name,
          ...(invite.contactType === "PHONE"
            ? { normalizedPhone: invite.normalizedContact }
            : { normalizedEmail: invite.normalizedContact }),
        },
      });
    }

    await tx.membership.upsert({
      where: {
        userId_restaurantId: {
          userId: user.id,
          restaurantId: invite.restaurantId,
        },
      },
      create: {
        userId: user.id,
        restaurantId: invite.restaurantId,
        role: invite.role,
        isBillingOwner: invite.isBillingOwner,
      },
      update: {}, // already a member — invite just gets consumed below
    });

    if (invite.intendedTagIds.length > 0) {
      await tx.employeeTag.createMany({
        data: invite.intendedTagIds.map((tagId) => ({
          userId: user.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.invite.update({
      where: { id: invite.id },
      data: { status: "CONSUMED", consumedAt: new Date(), consumedByUserId: user.id },
    });

    return { userId: user.id, restaurantId: invite.restaurantId };
  });
}

export type BulkInviteRow = {
  name: string;
  contact: NormalizedContact;
  role: Role;
};

export type BulkInviteResult = {
  created: number;
  invites: Awaited<ReturnType<typeof createInvite>>[];
};

/** §4 mass-invite: create + send a personal link for each row. */
export async function createBulkInvites(
  restaurantId: string,
  createdById: string,
  rows: BulkInviteRow[],
): Promise<BulkInviteResult> {
  const invites = [];
  for (const row of rows) {
    invites.push(
      await createInvite({
        restaurantId,
        createdById,
        name: row.name,
        contact: row.contact,
        role: row.role,
      }),
    );
  }
  return { created: invites.length, invites };
}
