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
| 8.1 | NL → schedule changes (AI) | ⬜ | Confirm-card flow, Haiku integration ⬜. **Hard rule:** suggest → confirm → write. |
| 8.2 | Payroll draft (AI) | ⬜ | `PayrollPeriodSummary.lineItems` for transparent breakdown. Rules engine + draft UI ⬜. |
| 8.3 | AI cost / fair-use | ⬜ | Prompt caching + soft trial cap ⬜. |
| 9 | Data model | ✅ | See `prisma/schema.prisma`. |
| 10 | Discreet complexity (UI) | ✅ (principle) | Enforced as a build rule; re-checked per view. |
| 11 | i18n + mobile-first + landing | ✅ | i18n + landing done. Mobile-first app shells ⬜. |
| 12 | Business model (trial, tiers, pricing) | 🟡 | Pricing UI ✅. Tier middleware + **negative tests** ✅. Stripe checkout, 30-day trial, soft-qualification ⬜. |
| 13 | Legal / GDPR / retention | 🟡 | `OBRuleSet` (versioned), `RetentionPolicy` modeled. DPA, privacy policy, erasure flow ⬜. |
| 14 | Hosting / VCS / PWA path | 🟡 | Git repo ✅. Vercel deploy ⬜. PWA manifest+SW ⬜ (native 🚫). |
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
7. **AI** (§8) — schedule NL + payroll draft (the OB/gross half of the §6.3 mockup lives here), both behind the suggest→confirm→write gate.
8. **Billing** (§12) — Stripe checkout, 30-day trial lifecycle, freeze-on-expiry.
9. **PWA** (§14.3) — manifest + service worker (reuses the offline-queue SW).

## Open items to confirm with the owner

- **Trial length:** the mockups say "14-day free trial"; spec §12.1 says **30 days** (deliberate, to span a payroll cycle). The build follows the spec (30). Flag if the mockups should win instead.
- **Visual preview tooling:** the in-editor preview/screenshot tool is bound to the *other* project in this workspace (the primary working dir), so live screenshots of Skifta aren't available through it. Verification is via production build + rendered-HTML checks; a Vercel deploy would give a shareable live URL.
