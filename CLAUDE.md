# Skifta — project guide for Claude Code

Skifta is a web app for **small restaurants (5–15 staff)** that replaces a paper
logbook and manual hour-counting: scheduling, a time clock, and payroll-ready
hours, exported to Fortnox/Visma. The full, binding spec is
[`restaurang-app-spec-v2.md`](restaurang-app-spec-v2.md). Build status lives in
[`ROADMAP.md`](ROADMAP.md) — read it first, and update it in the same commit as
the code it describes.

## Stack

- **Next.js 16** (App Router) + **TypeScript** · **Tailwind v4** (tokens in `src/app/globals.css`)
- **Prisma 6 + PostgreSQL** (`prisma/schema.prisma`)
- Planned: Stripe (billing), `@simplewebauthn` (clock-in), `@anthropic-ai/sdk` Haiku (AI)
- Hosting: **Vercel**. One codebase, one database.

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build (also the main local verification)
npm run lint
npx prisma validate  # check schema
npx prisma generate  # regenerate client after schema edits
npx prisma migrate dev --name <name>   # once DATABASE_URL is set
```

## Non-negotiable build rules (from the spec — violations are bugs)

1. **No hardcoded UI text** (§11). Every string goes through `t('key')` / the
   locale catalogs in `src/i18n/messages/`. Swedish (`sv.ts`) is the source of
   truth; `en.ts` is typed against it.
2. **`ClockEvent` is append-only** (§9, §13). Never update or delete one. A
   correction creates a `ClockEventAdjustment` that references the original.
3. **Accounts are person-centric** (§3.1). A `User` has many `Membership`s, one
   per restaurant. Never assume "one user → one restaurant" anywhere.
4. **Owner vs co-owner is one flag**, `Membership.isBillingOwner` (§3.2). Do not
   build a second permission tree.
5. **Authorization is enforced in the backend**, in a single middleware layer
   keyed on tier + role (§12.2) — not by hiding UI. Every tier-locked endpoint
   needs a **negative test** (Bas token → 403) before it's considered done.
6. **AI never writes to the DB without a human confirm click** (§8). The flow is
   always suggest → review card → confirm → write.
7. **Clock-in must work offline** and never lose a stamp (§6.2); stamps queue
   locally and sync on reconnect. Target <3s from scan/PIN to confirmation (§5).
8. **Don't rebuild regulated systems** (§6.3): no tax calc, AGI reporting, or
   holiday-pay engine. Produce clean source data and export it.
9. **Discreet complexity** (§10): employees see only schedule + clock-in +
   "can't work" button. Tags, tolerance windows, swap modes are owner-side config.
10. Respect the **out-of-scope list** (§17) — it's as binding as the features.

## Conventions

- Path alias `@/*` → `src/*`.
- Money/hours are `Decimal`; phone numbers normalize to E.164 before storage/matching (§4).
- Keep employee-facing views in the thumb zone, ≥44px touch targets, one-handed (§11).
