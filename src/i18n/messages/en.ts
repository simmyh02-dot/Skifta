// English — first additional language (spec §11).
// Typed against `Messages`, so the compiler guarantees structural parity
// with the Swedish source catalog.

import type { Messages } from "./sv";

const en: Messages = {
  lang: {
    toggle: "Change language",
    sv: "SV",
    en: "EN",
  },

  nav: {
    features: "Features",
    pricing: "Pricing",
    login: "Log in",
    cta: "Start free trial",
    menu: "Menu",
  },

  hero: {
    pill: "Built for small restaurants",
    title: "Run the week without the paperwork.",
    subtitle:
      "Skifta puts scheduling, the time clock, and payroll-ready hours in one simple app — made for restaurants with 5–15 staff, priced a fraction of the big systems.",
    ctaPrimary: "Start 30-day free trial",
    ctaSecondary: "See pricing",
    note: "No card required · set up in an afternoon",
    mockLabel: "schedule.png — week view",
  },

  features: {
    shifts: {
      title: "Shifts & swaps",
      body: "Post open shifts, approve swaps in a tap. The week view your team actually reads — no more group-chat scheduling.",
    },
    clock: {
      title: "Time clock",
      body: "Clock in with QR + Face ID, or a PIN at the counter. 0 kr per stamp — and never decipher a paper logbook again.",
    },
    payroll: {
      title: "Payroll-ready hours",
      body: "Hours summed automatically, deviations flagged for sign-off, one-click export to Fortnox & Visma. You stay in control.",
    },
  },

  stats: {
    size: { value: "5–15", label: "staff — built for your size" },
    price: { value: "3×", label: "lighter on price than the big systems" },
    clock: { value: "0 kr", label: "per clock-in, ever" },
    trial: { value: "30 days", label: "free, no card required" },
  },

  pricing: {
    title: "One price per restaurant.",
    subtitle: "Not per user — add your whole team without watching the meter.",
    perMonth: "kr / mo",
    billed: "per restaurant · billed monthly",
    cta: "Start free trial",
    recommended: "Recommended",
    bas: {
      name: "Bas",
      features: [
        "Schedule & week view",
        "Open shifts & swaps",
        "Availability",
        "Unlimited staff",
      ],
    },
    full: {
      name: "Full plan",
      features: [
        "Everything in Bas",
        "Time clock (QR + PIN)",
        "Payroll & admin",
        "AI scheduling",
        "Fortnox / Visma export",
      ],
    },
  },

  ctaBand: {
    title: "Ditch the logbook this week.",
    subtitle: "Free for 30 days. Your data stays yours if you stop.",
    cta: "Start free trial",
  },

  footer: {
    copy: "© 2026 Skifta · Made in Sweden for small restaurants",
  },

  auth: {
    login: {
      title: "Log in",
      subtitle: "Enter your phone or email and we'll send a one-time code.",
      contactLabel: "Phone or email",
      contactPlaceholder: "070 123 45 67",
      sendCode: "Send code",
      codeTitle: "Enter the code",
      codeSubtitle: "We sent a 6-digit code to {contact}.",
      codeLabel: "One-time code",
      verify: "Log in",
      resend: "Send a new code",
      back: "Back",
      sending: "Sending …",
      verifying: "Logging in …",
      errorContact: "Check the number or email and try again.",
      errorCode: "Wrong or expired code. Try again.",
      sent: "If the account exists, a code has been sent.",
    },
    picker: {
      title: "Choose restaurant",
      subtitle: "You have access to more than one restaurant.",
    },
    logout: "Log out",
  },

  invite: {
    join: {
      loading: "Loading invite …",
      invalidTitle: "This link doesn't work",
      invalidBody:
        "The invite may have expired, already been used, or been revoked. Ask the owner to send a new one.",
      title: "You're invited to {restaurant}",
      subtitle: "Hi {name}! You're invited as {role}. Verify your details to finish.",
      sendCode: "Send verification code",
      sending: "Sending …",
      codeLabel: "One-time code",
      verify: "Join",
      verifying: "Joining …",
      resend: "Send new code",
      errorCode: "Wrong or expired code. Try again.",
    },
    admin: {
      title: "Staff",
      subtitle: "Invite new team members with personal, one-time links.",
      singleTitle: "Invite one person",
      namePlaceholder: "Name",
      contactPlaceholder: "Phone or email",
      send: "Send invite",
      bulkTitle: "Invite several at once",
      bulkHint: "One line per person: Name, phone or email",
      bulkSend: "Send all",
      bulkResult: "{created} invites sent, {skipped} skipped.",
      errorCreate: "Couldn't create invite. Check the details.",
      revoke: "Revoke",
      empty: "No invites yet.",
      status: {
        PENDING: "Pending",
        CONSUMED: "Accepted",
        EXPIRED: "Expired",
        REVOKED: "Revoked",
      },
    },
  },

  app: {
    nav: {
      schedule: "Schedule",
      clock: "Clock in",
      profile: "Profile",
      admin: "Admin",
    },
    roles: {
      OWNER: "Owner",
      CO_OWNER: "Co-owner",
      EMPLOYEE: "Employee",
    },
    soon: {
      title: "Signed in",
      body: "Shifts, the time clock and admin are next. You're inside the app shell.",
    },
  },
};

export default en;
