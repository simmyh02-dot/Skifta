import type { ContactType } from "@prisma/client";

// Outbound messaging for invite links and one-time codes (§4, §5, §12.1).
// The app talks to this interface, never to a concrete provider — so a real
// SMS gateway (46elks/Twilio) or email service (Resend/Postmark) plugs in via
// env later without touching call sites. Until then the ConsoleSender logs the
// message server-side, which keeps the whole auth flow testable with no keys.

export type ContactTarget = { type: ContactType; value: string };

export interface MessageSender {
  send(to: ContactTarget, body: string): Promise<void>;
}

class ConsoleSender implements MessageSender {
  async send(to: ContactTarget, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[messaging:dev] → ${to.type} ${to.value}\n${body}`);
  }
}

let sender: MessageSender | null = null;

export function getSender(): MessageSender {
  if (sender) return sender;
  // TODO: when SMS_PROVIDER_API_KEY / EMAIL_PROVIDER_API_KEY are set, return a
  // real provider-backed sender here. For now everything goes to the console.
  sender = new ConsoleSender();
  return sender;
}

/** Test seam: inject a fake sender. */
export function __setSender(custom: MessageSender | null): void {
  sender = custom;
}
