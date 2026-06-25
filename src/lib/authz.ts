import type { Role, RestaurantTier } from "@prisma/client";

// Authorization policy (spec §12.2). ONE place decides what a (role, tier) pair
// may do. Routes call `can()` via the guard in `guard.ts`; nothing relies on
// hiding UI. Adding a feature = adding an Action here, not a new permission tree.
//
// Two independent gates:
//   • Tier gate  — clock-in, economy/admin and AI are FULL-tier only (§12.3).
//   • Role gate  — admin actions require OWNER or CO_OWNER, who are identical
//                  except for billing (§3.2); EMPLOYEE is blocked from them.

export type Action =
  // Shifts (§6.1) — viewing/own actions are open to everyone in both tiers.
  | "shift:viewOwn"
  | "shift:viewAll"
  | "shift:manage"
  | "availability:setOwn"
  | "swap:request"
  | "swap:approve"
  // Clock-in (§6.2) — FULL tier only.
  | "clock:stamp"
  | "clock:viewOwn"
  // Economy / admin (§6.3) — FULL tier + admin only.
  | "economy:view"
  | "economy:export"
  | "payroll:manage"
  | "deviation:review"
  // AI (§8) — FULL tier + admin only.
  | "ai:schedule"
  | "ai:payroll"
  // Org management — admin only, both tiers.
  | "members:manage"
  | "tags:manage"
  | "settings:manage";

/** Actions that require the FULL tier (Bas only has the shift section). */
const FULL_TIER_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "clock:stamp",
  "clock:viewOwn",
  "economy:view",
  "economy:export",
  "payroll:manage",
  "deviation:review",
  "ai:schedule",
  "ai:payroll",
]);

/** Actions only owners/co-owners may perform. */
const ADMIN_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "shift:viewAll",
  "shift:manage",
  "swap:approve",
  "economy:view",
  "economy:export",
  "payroll:manage",
  "deviation:review",
  "ai:schedule",
  "ai:payroll",
  "members:manage",
  "tags:manage",
  "settings:manage",
]);

export function isAdminRole(role: Role): boolean {
  return role === "OWNER" || role === "CO_OWNER";
}

export type AccessContext = {
  role: Role;
  tier: RestaurantTier;
};

/** The single source of truth for "is this allowed?". Pure and synchronous. */
export function can(ctx: AccessContext, action: Action): boolean {
  if (FULL_TIER_ACTIONS.has(action) && ctx.tier !== "FULL") return false;
  if (ADMIN_ACTIONS.has(action) && !isAdminRole(ctx.role)) return false;
  return true;
}
