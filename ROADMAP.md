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

## Spec section → status

| § | Area | Status | Notes |
|---|------|--------|-------|
| 1–2 | Vision, design principles | ✅ | Encoded as constraints throughout; see CLAUDE.md. |
| 3 | Roles & permissions | 🟡 | Modeled + enforcement layer ✅ (`authz` + `guard`, negative tests). Member-management UI ⬜. |
| 4 | Invite system | 🟡 | Token gen/accept/revoke/bulk-paste ✅, verified end-to-end. CSV file upload ⬜. |
| 5 | Clock-in identity (WebAuthn/PIN) | ⬜ | Schema ready. WebAuthn reg/auth, PIN, QR, <3s flow ⬜. Geofencing 🚫 (designed-for, not built). |
| 6.1 | Shifts (week view, open shifts, swaps, availability) | 🟡 | Week view, CRUD, open-shift fill (both modes, server-enforced), tag matching, full swap lifecycle, availability ✅, verified end-to-end. Escalation cron + notifications + double-booking checks ⬜. |
| 6.2 | Clock-in section + offline + tolerance window | ⬜ | Schema ready (`SyncStatus`, `clientId`, tolerance fields). Service worker + IndexedDB queue ⬜. |
| 6.3 | Economy/admin (summary, deviations, export) | ⬜ | Schema ready. Owner UI, deviation review, export ⬜. |
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
5. **Clock-in** (§5, §6.2) — WebAuthn + PIN, QR, the <3s flow, offline queue + sync.
6. **Economy/admin** (§6.3) — summary, deviation review, export templates (Fortnox/Visma/CSV), "export all my data".
7. **AI** (§8) — schedule NL + payroll draft, both behind the suggest→confirm→write gate.
8. **Billing** (§12) — Stripe checkout, 30-day trial lifecycle, freeze-on-expiry.
9. **PWA** (§14.3) — manifest + service worker (reuses the offline-queue SW).

## Open items to confirm with the owner

- **Trial length:** the mockups say "14-day free trial"; spec §12.1 says **30 days** (deliberate, to span a payroll cycle). The build follows the spec (30). Flag if the mockups should win instead.
- **Visual preview tooling:** the in-editor preview/screenshot tool is bound to the *other* project in this workspace (the primary working dir), so live screenshots of Skifta aren't available through it. Verification is via production build + rendered-HTML checks; a Vercel deploy would give a shareable live URL.
