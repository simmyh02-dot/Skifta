import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { getSender, type ContactTarget } from "./messaging";

// Outbound shift notifications (§6.1: "ny pass, ändring, byte behöver svar").
// A thin, best-effort layer over the messaging interface (`messaging.ts`):
// resolving a contact or sending must NEVER throw back into the shift/swap
// operation that triggered it — a failed SMS can't roll back a real schedule
// change. SMS/e-mail bodies are Swedish literals, matching `billing.ts` and
// the SV-only MVP scope (§17); they're outbound messages, not in-app UI text
// (build rule #1).
//
// Each send is mirrored into the `Notification` table (additive in-app feed,
// §6.1) so a worker can see + act on it inside Skifta, not just via SMS. The
// feed stores structured fields and renders copy through `t()`, unlike the
// SMS body — an in-app surface doesn't get the SMS exception to rule #1.

async function userContact(userId: string): Promise<ContactTarget | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { normalizedEmail: true, normalizedPhone: true },
  });
  if (!user) return null;
  if (user.normalizedPhone) return { type: "PHONE", value: user.normalizedPhone };
  if (user.normalizedEmail) return { type: "EMAIL", value: user.normalizedEmail };
  return null;
}

/** Owners + co-owners with a live membership — the people a swap escalates to
 *  and who approve an accepted swap. */
async function ownerIds(restaurantId: string): Promise<string[]> {
  const owners = await prisma.membership.findMany({
    where: { restaurantId, endedAt: null, role: { in: ["OWNER", "CO_OWNER"] } },
    select: { userId: true },
  });
  return owners.map((o) => o.userId);
}

/** Send one message to one user, swallowing every failure (best-effort). */
async function notify(userId: string, body: string, subject: string): Promise<void> {
  try {
    const contact = await userContact(userId);
    if (!contact) return; // no contact on file — nothing to do, never an error
    await getSender().send(contact, body, subject);
  } catch (err) {
    // A notification failure must not break the operation that triggered it.
    console.error("[notify] send failed", err);
  }
}

async function notifyMany(userIds: string[], body: string, subject: string): Promise<void> {
  await Promise.all(userIds.map((id) => notify(id, body, subject)));
}

type NotificationFields = {
  restaurantName: string;
  startsAt?: Date;
  count?: number;
  relatedShiftId?: string;
  relatedSwapId?: string;
  actionable?: boolean;
};

/** Best-effort in-app feed row, mirroring an SMS/e-mail send. Never throws —
 *  a feed-write failure can't break the schedule/swap operation either. */
async function recordNotification(
  userId: string,
  restaurantId: string,
  type: NotificationType,
  fields: NotificationFields,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        restaurantId,
        type,
        restaurantName: fields.restaurantName,
        startsAt: fields.startsAt ?? null,
        count: fields.count ?? null,
        relatedShiftId: fields.relatedShiftId ?? null,
        relatedSwapId: fields.relatedSwapId ?? null,
        actionable: fields.actionable ?? false,
      },
    });
  } catch (err) {
    console.error("[notify] feed write failed", err);
  }
}

async function recordNotificationMany(
  userIds: string[],
  restaurantId: string,
  type: NotificationType,
  fields: NotificationFields,
): Promise<void> {
  await Promise.all(userIds.map((id) => recordNotification(id, restaurantId, type, fields)));
}

function whenLabel(startsAt: Date): string {
  // Stockholm-time, compact "tis 8 juli 17:00" style for SMS.
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(startsAt);
}

const SUBJECT = "Skifta – schema";

/** Employee was assigned a (new or picked) shift. */
export async function notifyShiftAssigned(
  userId: string,
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  shiftId?: string,
): Promise<void> {
  await Promise.all([
    notify(userId, `Du har fått ett pass på ${restaurantName}: ${whenLabel(startsAt)}.`, SUBJECT),
    recordNotification(userId, restaurantId, "SHIFT_ASSIGNED", {
      restaurantName,
      startsAt,
      relatedShiftId: shiftId,
    }),
  ]);
}

/** An assigned employee's shift changed time. */
export async function notifyShiftChanged(
  userId: string,
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  shiftId?: string,
): Promise<void> {
  await Promise.all([
    notify(userId, `Ditt pass på ${restaurantName} har ändrats: ${whenLabel(startsAt)}.`, SUBJECT),
    recordNotification(userId, restaurantId, "SHIFT_CHANGED", {
      restaurantName,
      startsAt,
      relatedShiftId: shiftId,
    }),
  ]);
}

/** A candidate's interest in an open shift wasn't the one picked — the shift
 *  filled with someone else. Replaces the old silent `deleteMany` of leftover
 *  interest rows. */
export async function notifyInterestRejected(
  userId: string,
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  shiftId?: string,
): Promise<void> {
  await Promise.all([
    notify(
      userId,
      `Passet på ${restaurantName} (${whenLabel(startsAt)}) gick till en kollega den här gången.`,
      SUBJECT,
    ),
    recordNotification(userId, restaurantId, "INTEREST_REJECTED", {
      restaurantName,
      startsAt,
      relatedShiftId: shiftId,
    }),
  ]);
}

/** A swap needs a reply — directed colleague (DIRECTED) or all qualified (BROAD). */
export async function notifySwapNeedsReply(
  userIds: string[],
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  swapId?: string,
): Promise<void> {
  await Promise.all([
    notifyMany(
      userIds,
      `En kollega på ${restaurantName} behöver byta bort passet ${whenLabel(startsAt)}. Kan du ta det? Öppna Skifta för att svara.`,
      SUBJECT,
    ),
    recordNotificationMany(userIds, restaurantId, "SWAP_NEEDS_REPLY", {
      restaurantName,
      startsAt,
      relatedSwapId: swapId,
      actionable: true,
    }),
  ]);
}

/** A colleague accepted a swap — owners must approve the reassignment. */
export async function notifySwapAccepted(
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  swapId?: string,
): Promise<void> {
  const owners = await ownerIds(restaurantId);
  await Promise.all([
    notifyMany(
      owners,
      `Ett byte på ${restaurantName} (${whenLabel(startsAt)}) väntar på ditt godkännande.`,
      SUBJECT,
    ),
    recordNotificationMany(owners, restaurantId, "SWAP_ACCEPTED", {
      restaurantName,
      startsAt,
      relatedSwapId: swapId,
      actionable: true,
    }),
  ]);
}

/** A swap was approved — tell the new holder and the original requester. */
export async function notifySwapApproved(
  newHolderId: string,
  requesterId: string,
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  swapId?: string,
): Promise<void> {
  await Promise.all([
    notify(
      newHolderId,
      `Du har tagit över passet på ${restaurantName}: ${whenLabel(startsAt)}.`,
      SUBJECT,
    ),
    notify(
      requesterId,
      `Ditt byte på ${restaurantName} (${whenLabel(startsAt)}) är godkänt – du är inte längre inbokad.`,
      SUBJECT,
    ),
    recordNotification(newHolderId, restaurantId, "SWAP_APPROVED", {
      restaurantName,
      startsAt,
      relatedSwapId: swapId,
    }),
    recordNotification(requesterId, restaurantId, "SWAP_APPROVED", {
      restaurantName,
      startsAt,
      relatedSwapId: swapId,
    }),
  ]);
}

/** A swap passed its window with no reply — escalate to the owners. */
export async function notifySwapEscalated(
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
  swapId?: string,
): Promise<void> {
  const owners = await ownerIds(restaurantId);
  await Promise.all([
    notifyMany(
      owners,
      `Ingen har svarat på ett byte på ${restaurantName} (${whenLabel(startsAt)}). Det behöver din hjälp.`,
      SUBJECT,
    ),
    recordNotificationMany(owners, restaurantId, "SWAP_ESCALATED", {
      restaurantName,
      startsAt,
      relatedSwapId: swapId,
      actionable: true,
    }),
  ]);
}

/** Weekly summary of open clock deviations, so flags don't sit silent between
 *  payroll runs (§6.2/§6.3). */
export async function notifyDeviationDigest(
  restaurantId: string,
  restaurantName: string,
  openCount: number,
): Promise<void> {
  const owners = await ownerIds(restaurantId);
  await Promise.all([
    notifyMany(
      owners,
      `${restaurantName}: ${openCount} ${openCount === 1 ? "öppen avvikelse" : "öppna avvikelser"} väntar på granskning i Skifta.`,
      SUBJECT,
    ),
    recordNotificationMany(owners, restaurantId, "DEVIATION_DIGEST", {
      restaurantName,
      count: openCount,
    }),
  ]);
}
