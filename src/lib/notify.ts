import { prisma } from "./prisma";
import { getSender, type ContactTarget } from "./messaging";

// Outbound shift notifications (§6.1: "ny pass, ändring, byte behöver svar").
// A thin, best-effort layer over the messaging interface (`messaging.ts`):
// resolving a contact or sending must NEVER throw back into the shift/swap
// operation that triggered it — a failed SMS can't roll back a real schedule
// change. Bodies are Swedish literals, matching `billing.ts` and the SV-only
// MVP scope (§17); they're outbound messages, not in-app UI text (build rule #1).

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
  restaurantName: string,
  startsAt: Date,
): Promise<void> {
  await notify(
    userId,
    `Du har fått ett pass på ${restaurantName}: ${whenLabel(startsAt)}.`,
    SUBJECT,
  );
}

/** An assigned employee's shift changed time. */
export async function notifyShiftChanged(
  userId: string,
  restaurantName: string,
  startsAt: Date,
): Promise<void> {
  await notify(
    userId,
    `Ditt pass på ${restaurantName} har ändrats: ${whenLabel(startsAt)}.`,
    SUBJECT,
  );
}

/** A swap needs a reply — directed colleague (DIRECTED) or all qualified (BROAD). */
export async function notifySwapNeedsReply(
  userIds: string[],
  restaurantName: string,
  startsAt: Date,
): Promise<void> {
  await notifyMany(
    userIds,
    `En kollega på ${restaurantName} behöver byta bort passet ${whenLabel(startsAt)}. Kan du ta det? Öppna Skifta för att svara.`,
    SUBJECT,
  );
}

/** A colleague accepted a swap — owners must approve the reassignment. */
export async function notifySwapAccepted(
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
): Promise<void> {
  await notifyMany(
    await ownerIds(restaurantId),
    `Ett byte på ${restaurantName} (${whenLabel(startsAt)}) väntar på ditt godkännande.`,
    SUBJECT,
  );
}

/** A swap was approved — tell the new holder and the original requester. */
export async function notifySwapApproved(
  newHolderId: string,
  requesterId: string,
  restaurantName: string,
  startsAt: Date,
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
  ]);
}

/** A swap passed its window with no reply — escalate to the owners. */
export async function notifySwapEscalated(
  restaurantId: string,
  restaurantName: string,
  startsAt: Date,
): Promise<void> {
  await notifyMany(
    await ownerIds(restaurantId),
    `Ingen har svarat på ett byte på ${restaurantName} (${whenLabel(startsAt)}). Det behöver din hjälp.`,
    SUBJECT,
  );
}
