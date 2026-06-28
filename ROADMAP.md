# Skifta — build roadmap & status

This file is the continuity record between work sessions (spec §14.2). It maps
**every** section of [`restaurang-app-spec-v2.md`](restaurang-app-spec-v2.md) to
its current build status so nothing is silently dropped. Update it in the same
commit as the code it describes.

**Legend:** ✅ done · 🟡 partial / scaffolded · ⬜ not started · 🚫 deliberately out of MVP scope (§17)

---

## Foundation (this session)

- ✅ Project scaffold — Next.js 16 (App Router) + TypeScript + Tailwind v4, private git repo.
- ✅ Design system — palette & type from the mockups (`src/app/globals.css`): cream surfaces, deep teal brand, dark sections, terracotta accent for deviations.
- ✅ i18n layer (§11) — `src/i18n/`. Swedish base + English, typed catalogs, `t()` helper, **no hardcoded UI text**. Landing toggle swaps locale **without reload**.
- ✅ Landing page (§11, §12.3) — `src/components/landing/`. Hero, features, stats band, pricing (Bas 249 / Fullt 499), CTA, footer. SV default, discreet SV/EN pill. Verified: production build passes + `/` prerenders SSR in Swedish.
- ✅ Data model (§9) — `prisma/schema.prisma`. All §9 entities + the Deviation lifecycle (§6.3). Append-only `ClockEvent` + `ClockEventAdjustment`; person-centric `User`/`Membership`. Validates & generates (Prisma 6).
- ⬜ Database provisioning + first migration (needs a Postgres `DATABASE_URL`).

## Auth & access spine (this session)

- ✅ Authorization policy + guard (§12.2) — single layer (`src/lib/authz.ts` + `guard.ts`), keyed on tier + role. **Negative tests pass** (Bas → denied economy/clock; employee → denied admin; co-owner = owner).
- ✅ Session — signed JWT in an httpOnly cookie (`src/lib/session.ts`, edge-safe verify in `session-token.ts`).
- ✅ Edge gate — `src/proxy.ts` bounces unauthenticated users off `/app`. Verified: `/app` → 307 `/login`.
- ✅ OTP login — request-code / verify / logout APIs, `VerificationCode` model, hashed codes, contact normalization to E.164. Console sender so the flow runs with no SMS keys. Verified: bad contact → 400.
- ✅ Login UI + restaurant picker (§3.3) — `/login` (contact → code) and `/app/select`.
- ✅ End-to-end login — DB provisioned (Neon Postgres), first migration run, real login→session→`/app` flow verified against it.
- ⬜ Real SMS/email provider (still console-logged in dev).
- 20 unit tests green (`npm test`); production build passes.

## Invite system (this session, §4)

- ✅ Single invite — `POST /api/invites` creates a personal one-time link (random 24-byte token), sent via the console messaging stub. Owner/co-owner only (`members:manage`).
- ✅ Accept flow — `/join/[token]`: public preview (`GET /api/join/[token]`), OTP re-verification against the invite's own contact (never the requester's input), then `POST .../accept` creates the User (or reuses an existing one for multi-restaurant) + Membership and signs the person in.
- ✅ Single-use enforcement — token is dead after consumption (`CONSUMED` status), 404s on reuse. Forwarded links can't be completed by someone else (contact mismatch fails OTP).
- ✅ Revoke — `POST /api/invites/[id]/revoke`, owner/co-owner only, restaurant-scoped; revoked links 404 immediately.
- ✅ Bulk invite — `POST /api/invites/bulk` accepts a list of {name, contact, role} rows (admin UI: paste "Name, contact" per line); invalid rows are skipped and reported, valid ones get a personal link each.
- ✅ Admin UI — `/app/admin/members`: single-invite form, bulk-paste box, pending/consumed/revoked list with revoke action. Linked from the app home for owners/co-owners.
- ✅ Verified end-to-end against the real DB: created invite → code logged → accepted → new session → reuse blocked (404) → non-admin blocked from inviting (403) → bulk invite with one bad row → revoke → revoked link dead.
- ⬜ CSV/Excel file upload (current bulk import is paste-a-list, not file parsing) — explicitly listed as MVP-required by §4; the paste-list path satisfies the "skip OCR-migration, do structured bulk" requirement but not a literal file upload yet.

## Shifts section (this session, §6.1)

- ✅ Week view — `/app/schedule` (`ScheduleView`), Mon–Sun columns, prev/next-week nav, shows everyone's shifts to owner/co-owner, own + open shifts to employees.
- ✅ Owner shift CRUD — create (assign or leave OPEN), delete; required tags auto-create by name (no separate tag-creation step needed when scheduling).
- ✅ Open shifts, both fill modes — `openShiftFill` (FIRST_COME / MANUAL_PICK) read from the restaurant's settings and **enforced server-side**, not just hidden in the UI: `/claim` only works in FIRST_COME, `/interest` + owner `/pick` only in MANUAL_PICK.
- ✅ Qualification matching (§7) — `qualifiedMembers()` gates claim/interest/swap-accept by competence tag; a shift with no required tags is open to everyone.
- ✅ "Can't work / sick" swap flow — `POST /api/shifts/[id]/swap` starts a request in the restaurant's default mode (`swapDefaultMode`); DIRECTED needs an owner `/direct` pick, BROAD is visible to all qualified colleagues; `/respond`, `/decline`, `/approve`, `/cancel` cover the rest of the lifecycle. Approval is what actually reassigns the shift.
- ✅ Availability — `/app/availability`, weekly recurring ranges, full replace on save (`PUT /api/availability`).
- ✅ Competence tags admin — `TagsAdmin` inside `/app/admin/members`: create/delete tags, per-member tag checkboxes.
- ✅ Verified end-to-end against the real DB with two test employees: assigned shift → sick button → owner directs to colleague → colleague accepts → owner approves → shift reassigned; open tagged shift → unqualified employee blocked → tag assigned → MANUAL_PICK interest → owner pick; employee correctly blocked (403) from shift:manage/tags:manage actions.
- ⬜ Escalation is data-only (`escalateAt` is set, no cron flips status to `ESCALATED` or notifies the owner) — needs a scheduled job once hosting supports one.
- ⬜ Notifications (new shift, change, swap needs a reply) — no push/email infra yet; same gap as the rest of the app (console-only).
- ⬜ Double-booking prevention (assigning/claiming a shift that overlaps another shift the same person already has) is not checked.
- 🔧 Schema addition: `ShiftInterest` model (manual-pick interest list) — wasn't in the original §9 model set, added this session with its own migration.

## Clock-in section (this session, §5/§6.2)

- ✅ Stamp endpoint — `POST /api/clock/stamp`, **public by design**: place is proven by the QR/kiosk token, identity by PIN or WebAuthn — no prior login. **Append-only** `ClockEvent`, **idempotent on `clientId`** (replay → `duplicate:true`, never a second row), direction auto-toggles from the last stamp. Verified end-to-end against the real DB.
- ✅ Place proof — stateless HMAC clock token (`src/lib/clock-token.ts`, no schema migration); tampered/forged tokens → 400. The QR encodes `/clock/<token>`.
- ✅ **Tier gate enforced server-side** — clock-in is FULL only; a Bas restaurant's kiosk token → **403 `tier_locked`** (the kiosk has no session/role, so the tier is checked on the restaurant directly). Proven end-to-end.
- ✅ PIN method (§5 method 2) — set/replace own PIN (`POST /api/clock/pin`), hashed with scrypt; kiosk PIN entry resolves to the member restaurant-scoped, all hashes checked to avoid an early-exit timing signal.
- ✅ WebAuthn method (§5 method 1) — `@simplewebauthn` v13. Registration while signed in (own device, `register/options`+`verify`); **discoverable** kiosk authentication (`auth/options`, verified inside the stamp). Many credentials per user (new/lost phone). Only the public credential is stored. **Built + typechecks + build passes; needs real-device + HTTPS field verification** (Face ID/Touch ID can't be exercised here).
- ✅ Tolerance window + graded deviations (§6.2) — `src/lib/deviations.ts`: `|Δ| ≤ low` = none, `≤ high` = LOW, else HIGH; **repeated same-direction pattern escalates to HIGH**. A stamp is matched to the day's assigned shift by closest boundary; an out-of-tolerance stamp opens an OPEN `Deviation` **assigned to an owner** (§6.3). Unit-tested + verified (90-min-late IN → HIGH/OPEN, owner-assigned).
- ✅ Own clock view — `/app/clock` (`ClockView`): week history + **accumulated hours** (paired IN→OUT, `accumulateHours`) + still-clocked-in indicator; device/PIN setup. No access to others' stamps or economy data (§6.2).
- ✅ Kiosk — `/clock/[token]` (`ClockKiosk`), public, outside the `/app` proxy: big tap-to-stamp (WebAuthn) + PIN pad, green check + haptic, invalid/tier-locked states. Verified it renders (200 + localized invalid message).
- ✅ Offline resilience (§6.2) — IndexedDB queue (`src/lib/clock-queue.ts`) + flush-on-reconnect (`useSyncExternalStore` online status) + service worker shell cache (`public/clock-sw.js`). PIN stamps queue when offline and replay idempotently; calm "we'll sync" message, never an error. (WebAuthn needs a live challenge, so offline stamping is the PIN path.)
- ✅ Admin setup — `/app/clock/setup` (`ClockAdminView`): printable **QR** (`qrcode`) + copyable kiosk link + configurable tolerance window (`POST /api/clock/settings`, settings:manage + FULL).
- ✅ UI aligned to the design references (`Design references for claude/`) — kiosk reworked to the two-column Scandinavian layout (PIN keypad + dot indicators, persistent "scan with your phone" QR/Face ID card, live **"on shift now"** list, big header clock); employee mobile view reworked to the teal **"on shift now"** hero (live elapsed time, in-app Face ID **clock-out** via `POST /api/clock/self`, period total, flagged history rows) + bottom tab bar. New shared primitives `Avatar`, `TagDot` (`tag-color.ts`), `MobileTabBar`. Both surfaces visually verified in the preview against the mockups.
- ✅ In-app self clock-in/out (`/api/clock/self`) — session identity + WebAuthn confirm; `onShiftNow()` realtime list (`/api/clock/onshift`, reused by §6.3).
- ✅ i18n — full `clock` catalog (sv source + en), tier-gated nav links. 40 tests green (20 new: clock-token, deviations, clock pure logic); production build passes.
- ⬜ Lost/new-device re-registration via OTP + owner-initiated device reset (§5) — `DEVICE_REREGISTER` code purpose exists; flow not built.
- ⬜ <3s field validation under lunch rush (§5 process requirement) and full cold-start PWA offline boot (§14.3, SW currently caches the shell after first load) — need a real device/deploy.
- ⬜ Weekly deviation digest notification (§6.3) — same console-only gap as the rest of the app.

## Economy/admin section (this session, §6.3)

- ✅ Owner overview — `/app/economy` (`EconomyView`), FULL tier + owner/co-owner only (`economy:view`, verified: unauth → 307 `/login`, API → 401). Period-scoped (calendar month, prev/next nav). Four tabs: **Payroll period** (stat cards + per-employee table), **Time clock** (realtime on-shift), **Deviations** (review queue), **Settings** (export).
- ✅ Automatic hour summarisation — `src/lib/economy-data.ts` sums worked hours per employee per period by reusing the append-only `accumulateHours` pairing; constant number of queries regardless of headcount. Stat cards: total hours, flagged (open) deviations, on-shift count, activation/adoption (X of Y).
- ✅ Deviation review lifecycle (§6.3) — `POST /api/economy/deviations/[id]` with `review` (→ REVIEWED), `approve` ("godkänn som stämplat" → APPROVED), or `adjust`. **Adjust honours append-only**: it writes a `ClockEventAdjustment` pointing back at the original stamp + reason, never mutating the `ClockEvent`, then approves the deviation. Restaurant-scoped; `deviation:review` (FULL + admin).
- ✅ **Export gate enforced server-side** (§6.3 — "ogranskade avvikelser inkluderas ALDRIG tyst") — `splitExportable` holds back any member with an OPEN deviation; `GET /api/economy/export` returns **409 + the blocked names** unless the owner explicitly acknowledges exclusion (`?exclude=1`), which exports only the cleared members. No silent inclusion, no silent auto-adjustment. Unit-tested.
- ✅ Export formats + "save as my default" — Fortnox / Visma / generic CSV column layouts (`buildExportCsv`, documented plausible structures; CUSTOM falls back to generic until a template is imported). CSV with UTF-8 BOM so Excel reads å/ä/ö. `POST /api/economy/export/default` persists `defaultExportFormat` (settings:manage + FULL).
- ✅ "Exportera all min data" (§6.3 + §13 GDPR portability) — `GET /api/economy/export-all?format=json|csv`: full restaurant dump (employees, schedules, stamp history) as structured JSON or a stamp-history CSV. Gated on `members:manage` (admin, **both tiers**) so a Bas owner can also take their data.
- ✅ Realtime overview — reuses `onShiftNow()` ("vem är instämplad just nu").
- ✅ i18n — full `economy` catalog (sv source + en). Economy nav links added to schedule/clock desktop headers (admin) + owner mobile Admin tab → `/app/economy` (bar-chart icon, per mockup); member admin cross-linked. 12 new unit tests (period math, CSV escaping, export gate, format layouts); **52 tests green** (8 files); production build passes.
- ⬜ OB classification + estimated gross payroll (the mockup's "OB" and "Est gross" columns/cards) — deferred to **§8.2** (AI-assisted payroll draft): needs an OB rule set + per-member rate, which is the next milestone. Hours/deviations/export underlag is complete and honest without fabricated money figures.
- ⬜ Import-my-own-template (CUSTOM column mapping upload) — schema (`ExportTemplate.columnMapping`) ready; upload UI not built. Same file-upload gap as §4 bulk CSV.
- ⬜ Weekly deviation digest notification (§6.3) — same console-only notification gap as the rest of the app.

## AI payroll draft (this session, §8.2)

- ✅ **Deterministic rules engine** (`src/lib/payroll/engine.ts`) — the numbers are rule-based, not AI (§8.2). Pairs append-only stamps into worked intervals, splits them across local-midnight boundaries (overnight shifts), and applies the restaurant's OB windows + optional overtime as supplements **on top of** base pay (no double-counting). Produces a transparent per-line breakdown (base, each OB window, overtime) that links back to the exact stamp ids — §8.2 spårbarhet. 11 unit tests.
- ✅ **OB-rule presets** (`src/lib/payroll/rules.ts`, §13) — owner picks a preset template ("Inget OB-tillägg" / "Kväll & helg"), not free-form entry. Stored **versioned** as an `OBRuleSet` row so an approved draft traces to exactly which rules applied.
- ✅ **AI presentation layer** (`src/lib/ai/payroll-note.ts`) — Claude **Haiku** (`claude-haiku-4-5`, the model the spec specifies §8) writes a short Swedish summary of the *already-computed* draft. The AI only summarises/presents — it computes no number and **never writes to the DB** (build rule #6). Degrades gracefully: with no `ANTHROPIC_API_KEY` it returns a deterministic Swedish note, so the flow runs with zero AI keys. System prompt is prompt-cached (§8.3). 3 tests.
- ✅ **suggest → confirm → write** (§8, hard rule) — `POST /api/economy/payroll/preview` computes the draft + note and **persists nothing**; `POST .../approve` is the only writer and runs only behind the owner's explicit click, **recomputing server-side** (never trusts client numbers) and writing `PayrollPeriodSummary` rows with the line breakdown. Members with an **unreviewed deviation** (§6.3) or **no rate** are held back and named, never folded in silently. `payroll:manage` (FULL + admin), verified unauth → 401.
- ✅ **Rates + OB config** — `Membership.hourlyRate` added (nullable `Decimal`; migration applied to the live Neon DB 2026-06-27). `GET/POST /api/economy/payroll/rate` (per-employee rate) and `/ruleset` (OB preset) under settings:manage + FULL.
- ✅ **UI** — new "Löneutkast" tab in `EconomyView`: Generate (AI) → review cards with the transparent breakdown + AI note (AI/fallback badge) + missing-rate/unreviewed flags → Approve & save (confirm-card flow); disclaimer that it's a draft, not a binding payslip. Settings tab gains the OB-preset picker + per-employee rate inputs. This fills the mockup's OB/gross columns that §6.3 deferred.
- ✅ i18n — full `economy.draft` / `rates` / `obRules` catalogs (sv + en). **66 tests green**; production build passes; all 4 payroll routes registered.
- ⬜ §8.1 (NL → schedule changes) — the other half of §8; not started.
- ⬜ Real OB rates from a specific collective agreement, and the "import my own column template" (CUSTOM) export mapping — presets are illustrative starting points the owner adjusts.

## AI scheduling (this session, §8.1)

- ✅ **NL → structured proposal** (`src/lib/ai/schedule-assistant.ts`) — Claude Haiku with **forced tool-use** (not free text) so the model always returns a typed shift list, never prose to parse. Context fed to the model is real: active members + their tags, and the previous week's actual shifts (so "samma som förra veckan" has something concrete to copy from), per spec §8.1 step 2.
- ✅ **Ambiguity surfaces, never hides** — each proposed row carries `ambiguous`/`note`; a member name that doesn't match anyone in the restaurant is flagged (never silently dropped or fuzzy-guessed) via `resolveMembers`. Unit-tested.
- ✅ **suggest → confirm → write** (§8, hard rule) — `POST /api/schedule/ai/preview` computes the proposal and **persists nothing**; `POST /api/schedule/ai/approve` is the only writer, runs only behind the owner's explicit click, and **re-validates every row server-side** (real member of this restaurant, valid date/time) rather than trusting the client. `ai:schedule` (FULL + admin).
- ✅ **No fabricated fallback** — unlike §8.2's deterministic numbers, there's no honest way to "guess" a schedule interpretation without a model, so with no `ANTHROPIC_API_KEY` the preview route returns 503 `ai_unavailable` and the UI says so plainly, rather than inventing a fake parse.
- ✅ **UI** — `/app/schedule` gets an "AI-schemaläggning" entry next to "Nytt pass" (owner/co-owner, FULL tier only): free-text box → review card listing every proposed shift **by name/date/time** (not a summary sentence, per §8.1 design requirement) → "Ändra manuellt" makes the list inline-editable → "Godkänn" (writes) / "Avbryt" (discards). Ambiguous rows are visually flagged with the model's own note.
- ✅ i18n — `schedule.ai` catalog (sv + en). **69 tests green**; production build passes; both AI routes registered.

## AI fair use (this session, §8.3)

- ✅ **Soft trial cap** (`src/lib/ai/fair-use.ts`) — `recordAiCall()` increments `Restaurant.trialAiCallCount` only while `subscriptionStatus = TRIALING` (paid usage is unmetered) and only counts a real model call (never the no-key fallback path, since that has no AI cost). Crossing **50 calls** sets `trialAiFlaggedAt` once and logs internally — **never** a hard block, exactly per spec ("flaggas internt … INGEN hård spärr"). Best-effort: a tracking failure never breaks the AI feature itself.
- ✅ Wired into both AI call sites — payroll preview (only when `payrollNote` actually used Haiku, i.e. `source === "ai"`) and schedule preview (after a successful `proposeSchedule`, which throws before any count if no key is configured).
- ✅ Migration `trial_ai_fair_use_cap` applied to the live Neon DB (additive nullable/defaulted columns).
- ✅ Build passes; existing 69 tests still green (this is a thin DB-backed counter, consistent with the codebase's pattern of not mocking Prisma in unit tests — verified instead by build + code review).

## PWA (this session, §14.3)

- ✅ **Manifest** (`src/app/manifest.ts`, Next's metadata-file convention) — served at `/manifest.webmanifest`, `start_url: /app`, `display: standalone`, brand theme/background colors, 192/512 + maskable icons. Verified: fetches 200 with the right shape.
- ✅ **Icons** (`public/icons/`) — generated programmatically (no design tool/new dependency) from the same rounded-diamond mark as `Logo.tsx`, in the brand teal/cream palette; plain + maskable variants at 192/512.
- ✅ **App-wide install + offline shell** — `src/components/PwaRegister.tsx` registers the existing clock-in service worker (`public/clock-sw.js`, §6.2) from the root layout, so every route gets the install prompt and offline shell, not just the kiosk. **Privacy fix made in the same change:** the SW's cache key is the URL only, with no notion of "whose session" — so `/app/*` (authenticated, per-user HTML) is now explicitly excluded from caching to avoid one user's page being served to the next session on a shared device; only public pages (`/`, `/login`, `/clock/*`, static assets) are cached. Verified live: manifest linked, SW registered at root scope, icons 200, cache contains only public paths after visiting `/` and `/login`.
- ✅ `appleWebApp` + `theme-color` viewport metadata for iOS/Android install chrome.
- ✅ Build + lint + 69 tests still green.
- ⬜ Real-device install/offline verification (Android/iOS home-screen add, full cold-start offline boot) — needs a deployed HTTPS origin, same gap noted in §6.2/§5.

## Billing (this session, §12)

- ✅ **Signup flow** (`/signup`, `src/components/auth/SignupForm.tsx`, `/api/auth/signup/{request-code,verify}`) — discovered this was a real gap, not just unbuilt billing: the landing page already linked `/signup?plan=bas|full` but nothing created a `Restaurant` yet. New `CodePurpose.SIGNUP` OTP step (mirrors login/invite-accept) verifies the founding owner's contact before creating Restaurant + User + Membership(`role: OWNER, isBillingOwner: true`) in one transaction — the soft qualification §12.1 step 4 asks for (name + restaurant name/orgnr + verified contact). Accounts stay person-centric (§3.1): an existing User signing up a second restaurant just gets a second Membership.
- ✅ **Trial unlocks the full package regardless of chosen tier** (§12.1 step 3) — `getAccessContext` in `src/lib/guard.ts` now computes an *effective* tier: `FULL` while `subscriptionStatus = TRIALING`, the row's real `tier` otherwise. One change point fixes every page/route that calls it; previously a Bas-tier signup would have wrongly stayed locked out of clock-in/economy/AI during its own trial.
- ✅ **Frozen-account gate** (§12.1 step 6: "fryses kontot, data bevaras, inloggning blockeras") — `getAccessContext` returns null (no access) for `FROZEN`, same as no membership; `/app` checks subscription status first and routes to `/app/frozen` instead of looping. The frozen page is deliberately *not* gated through `getAccessContext` — it's the one page that must stay reachable to pay your way out.
- ✅ **Trial lifecycle cron** (`src/lib/billing.ts`, `/api/cron/billing`, `vercel.json`) — day-25–28 reminder e-mail to the billing owner (sent at most once, `trialReminderSentAt`), day-30 freeze **only if no Stripe subscription is attached** (never an automatic charge — spec is explicit: "INGEN automatisk debitering av ett kort kunden glömt"). Authenticated via `CRON_SECRET` bearer header, the documented Vercel Cron pattern; verified unauthenticated → 401.
- ✅ **Stripe checkout + portal + webhook** (`src/lib/stripe.ts`, `/api/billing/{checkout,portal,webhook}`) — hosted Checkout Session (monthly/yearly), Customer Portal for managing/canceling, and a signature-verified webhook that's the *only* writer of payment outcome (checkout/portal merely start a Stripe flow — suggest → confirm → write applies to money too). Billing-owner only (`requireBillingOwner` in guard.ts), the one documented exception where OWNER/CO_OWNER aren't interchangeable (§3.2) — checked directly on `Membership.isBillingOwner`, not a new permission tree (CLAUDE.md rule #4).
- ✅ **Setup script** (`scripts/stripe-setup.mjs`) — creates the Bas/Fullt Products + monthly/yearly Prices via the Stripe API (yearly = 10× monthly, ~2 months free, the §12.3 retention discount) so the Price ids in `.env` always match what's actually configured; not hand-typed in the dashboard. Not yet run — needs your `STRIPE_SECRET_KEY` in `.env` first.
- ✅ **UI** — `/app/billing` (trial countdown / active badge, monthly/yearly checkout buttons, manage-subscription link once a card exists) and `/app/frozen` (the escape hatch — same checkout buttons, plus an "ask the owner" message for non-billing-owner staff). Nav entry added next to Members/Economy for owners/co-owners.
- ✅ Migration `billing_signup_trial` (CodePurpose.SIGNUP, Restaurant.trialReminderSentAt) applied to the live Neon DB. Build + lint + 69 tests green. **Verified end-to-end against the real DB** with a throwaway test restaurant (created, then deleted): signup → session → `/app/schedule`; flipped to FROZEN → `/app` correctly redirects to `/app/frozen`, direct `/app/schedule` hit bounces the same way; checkout → 503 `billing_unavailable` (no Stripe key yet, degrades cleanly instead of fabricating a link); portal → 400 `no_customer`; cron → 401 unauthenticated.
- ✅ **Stripe fully wired** — `STRIPE_SECRET_KEY` (test mode) set; `scripts/stripe-setup.mjs` run, Bas/Fullt monthly+yearly Prices created and IDs in `.env`; webhook endpoint added in the Stripe dashboard pointed at `/api/billing/webhook` with its signing secret in Vercel; `CRON_SECRET` generated and set in both `.env` and Vercel. Live-verified: `/api/billing/checkout` returns a real `checkout.stripe.com` URL and persists `stripeCustomerId` on the restaurant (tested + cleaned up against the real DB and a real test-mode Stripe customer).
- ⬜ **Not yet verified**: a real Checkout completion against the *deployed* URL, to confirm the webhook actually flips `TRIALING`→`ACTIVE` in production (can't be driven from local dev — needs a live deploy + a real test-card payment).
- ⬜ Referral ("bjud in en annan restaurang") and the move-restaurant-on-churn flow (§12.4) — not started, lower priority per spec ("liten funktion").

## Spec section → status

| § | Area | Status | Notes |
|---|------|--------|-------|
| 1–2 | Vision, design principles | ✅ | Encoded as constraints throughout; see CLAUDE.md. |
| 3 | Roles & permissions | 🟡 | Modeled + enforcement layer ✅ (`authz` + `guard`, negative tests). Member-management UI ⬜. |
| 4 | Invite system | 🟡 | Token gen/accept/revoke/bulk-paste ✅, verified end-to-end. CSV file upload ⬜. |
| 5 | Clock-in identity (WebAuthn/PIN) | 🟡 | PIN method, QR/kiosk + stamp flow, tier gate ✅ (verified). WebAuthn reg/discoverable-auth built (needs real-device verification). Device re-registration/reset ⬜. <3s lunch-rush field test ⬜. Geofencing 🚫. |
| 6.1 | Shifts (week view, open shifts, swaps, availability) | 🟡 | Week view, CRUD, open-shift fill (both modes, server-enforced), tag matching, full swap lifecycle, availability ✅, verified end-to-end. Escalation cron + notifications + double-booking checks ⬜. |
| 6.2 | Clock-in section + offline + tolerance window | 🟡 | Stamp (append-only, idempotent), own history + hours, graded tolerance/deviations, IndexedDB queue + SW shell cache ✅ (verified). Cold-start PWA offline boot + deviation digest ⬜. |
| 6.3 | Economy/admin (summary, deviations, export) | 🟡 | Owner UI (4 tabs), hour summary, deviation review (append-only adjust), export gate (unreviewed → blocked), Fortnox/Visma/CSV formats + save-default, export-all-my-data, realtime overview ✅. OB/gross → §8.2; CUSTOM template upload + deviation digest ⬜. |
| 7 | Competence tags | ✅ | `Tag`/`EmployeeTag` + admin UI (create/delete tags, assign per member) + qualification matching enforced in shift claim/interest/swap-accept. |
| 8.1 | NL → schedule changes (AI) | ✅ | Haiku forced tool-use → structured proposal, confirm-card UI (exact list, editable, ambiguity shown), suggest→confirm→write, server-side re-validation on approve. No-key → explicit 503, no fake fallback. |
| 8.2 | Payroll draft (AI) | 🟡 | Deterministic OB/overtime engine (traceable line items), Haiku presentation note (graceful no-key fallback), suggest→confirm→write, rates + OB presets, draft UI ✅. Real agreement rates + CUSTOM template ⬜. |
| 8.3 | AI cost / fair-use | ✅ | Prompt caching on the note's system prompt ✅. Soft ~50-call trial cap (flag, not block) ✅. |
| 9 | Data model | ✅ | See `prisma/schema.prisma`. |
| 10 | Discreet complexity (UI) | ✅ (principle) | Enforced as a build rule; re-checked per view. |
| 11 | i18n + mobile-first + landing | ✅ | i18n + landing done. Mobile-first app shells ⬜. |
| 12 | Business model (trial, tiers, pricing) | 🟡 | Pricing UI ✅. Tier middleware + **negative tests** ✅. Signup + 30-day trial (full package unlocked regardless of tier) + soft-qualification + reminder/freeze cron + Stripe checkout/portal/webhook ✅, keys configured, checkout verified live. Full webhook confirmation needs a real deploy ⬜. Referral + move-restaurant flows ⬜. |
| 13 | Legal / GDPR / retention | 🟡 | `OBRuleSet` (versioned), `RetentionPolicy` modeled. DPA, privacy policy, erasure flow ⬜. |
| 14 | Hosting / VCS / PWA path | 🟡 | Git repo ✅. PWA manifest+SW ✅ (installable, app-wide offline shell). Vercel deploy ⬜ (native 🚫). |
| 15 | Acceptance criteria | ⬜ | Test suite ⬜ (esp. tier 403 negative tests, offline-no-loss, append-only). |
| 16 | Payroll-admin workflow reference | n/a | Guides prioritization; steps 1–4 are the value target. |
| 17 | Out of MVP scope | 🚫 | BankID, own tax calc, OCR, geofencing, native app, per-tier codebases, languages beyond SV. |

## Suggested next milestones (in order)

1. ✅ **Auth spine** — OTP login, session, restaurant picker (§3.3), DB provisioned and verified end-to-end.
2. ✅ **Tier/role middleware + negative tests** (§12.2) — single authorization layer; Bas → 403 proven in tests.
3. ✅ **Invite system** (§4) — single-use tokens, OTP accept, revoke, bulk-paste invite, admin UI. ⬜ CSV file upload remains.
4. ✅ **Shifts section** (§6.1) — week view, open shifts (both fill modes, server-enforced), swap flow with tag matching (§7), availability, tags admin. ⬜ Escalation cron, notifications, double-booking checks remain.
5. ✅ **Clock-in** (§5, §6.2) — PIN + WebAuthn identity, QR/kiosk, append-only idempotent stamps, graded tolerance/deviations, own history + hours, offline queue + SW, admin QR/tolerance setup. ⬜ Device re-registration/reset, real-device WebAuthn + <3s field test, cold-start PWA offline remain.
6. ✅ **Economy/admin** (§6.3) — period summary + per-employee hours, deviation review (append-only adjust), export gate (unreviewed never silent), Fortnox/Visma/CSV formats + save-default, "export all my data". ⬜ OB/gross (→§8.2), CUSTOM template upload, deviation digest remain.
7. ✅ **AI** (§8) — payroll draft (§8.2) ✅, NL→schedule (§8.1) ✅, soft fair-use trial cap (§8.3) ✅: deterministic OB/gross engine + Haiku note for payroll, Haiku forced tool-use → confirm-card for scheduling, both suggest→confirm→write, both AI call sites counted against a 50-call/trial soft cap that flags-not-blocks.
8. ✅ **PWA** (§14.3) — manifest + app-wide service worker registration (reuses the offline-queue SW from §6.2), installable home-screen icon, themed standalone display.
9. ✅ **Billing** (§12) — signup flow, 30-day trial (full package unlocked regardless of chosen tier), frozen-account gate, reminder/freeze cron, Stripe checkout/portal/webhook all built, keys configured (test mode), and checkout verified live against the real DB + Stripe. ⬜ A full Checkout-to-webhook confirmation still needs a real deploy.

## Open items to confirm with the owner

- **Trial length:** the mockups say "14-day free trial"; spec §12.1 says **30 days** (deliberate, to span a payroll cycle). The build follows the spec (30). Flag if the mockups should win instead.
- **Visual preview tooling:** the in-editor preview/screenshot tool is bound to the *other* project in this workspace (the primary working dir), so live screenshots of Skifta aren't available through it. Verification is via production build + rendered-HTML checks; a Vercel deploy would give a shareable live URL.
