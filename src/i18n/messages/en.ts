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
};

export default en;
