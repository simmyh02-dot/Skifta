import type { ContactType } from "@prisma/client";

// Outbound messaging for invite links and one-time codes (§4, §5, §12.1).
// The app talks to this interface, never to a concrete provider. Real
// providers (46elks for SMS, Resend for email) are wired in via env — with
// no keys set, everything degrades to logging server-side, which keeps the
// whole auth flow testable with zero external accounts.

export type ContactTarget = { type: ContactType; value: string };

export interface MessageSender {
  send(to: ContactTarget, body: string, subject?: string): Promise<void>;
}

class ConsoleSender implements MessageSender {
  async send(to: ContactTarget, body: string): Promise<void> {
    console.info(`[messaging:dev] → ${to.type} ${to.value}\n${body}`);
  }
}

/** SMS via 46elks (https://46elks.se) — Swedish gateway, Basic-auth REST API. */
class ElksSmsSender implements MessageSender {
  constructor(
    private username: string,
    private password: string,
  ) {}

  async send(to: ContactTarget, body: string): Promise<void> {
    if (to.type !== "PHONE") throw new Error("elks_sms_sender_handles_phone_only");
    const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    const res = await fetch("https://api.46elks.com/a1/sms", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ from: "Skifta", to: to.value, message: body }),
    });
    if (!res.ok) throw new Error(`elks_sms_failed_${res.status}`);
  }
}

/** Email via Resend (https://resend.com) — bearer-token REST API. */
class ResendEmailSender implements MessageSender {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(to: ContactTarget, body: string, subject = "Skifta"): Promise<void> {
    if (to.type !== "EMAIL") throw new Error("resend_email_sender_handles_email_only");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: [to.value], subject, text: body }),
    });
    if (!res.ok) throw new Error(`resend_email_failed_${res.status}`);
  }
}

/** Routes a contact to its provider-backed sender by type, each independently
 *  falling back to the console if its own provider isn't configured — so SMS
 *  and email can be wired up one at a time. */
class RoutingSender implements MessageSender {
  constructor(
    private smsSender: MessageSender,
    private emailSender: MessageSender,
  ) {}

  async send(to: ContactTarget, body: string, subject?: string): Promise<void> {
    const target = to.type === "PHONE" ? this.smsSender : this.emailSender;
    await target.send(to, body, subject);
  }
}

let sender: MessageSender | null = null;

export function getSender(): MessageSender {
  if (sender) return sender;

  const smsSender =
    process.env.SMS_PROVIDER_USERNAME && process.env.SMS_PROVIDER_PASSWORD
      ? new ElksSmsSender(process.env.SMS_PROVIDER_USERNAME, process.env.SMS_PROVIDER_PASSWORD)
      : new ConsoleSender();

  const emailSender = process.env.EMAIL_PROVIDER_API_KEY
    ? new ResendEmailSender(process.env.EMAIL_PROVIDER_API_KEY, process.env.EMAIL_FROM ?? "no-reply@skifta.se")
    : new ConsoleSender();

  sender = new RoutingSender(smsSender, emailSender);
  return sender;
}

/** Test seam: inject a fake sender. */
export function __setSender(custom: MessageSender | null): void {
  sender = custom;
}
