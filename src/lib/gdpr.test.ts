import { describe, it, expect } from "vitest";
import { monthsBetween, eligibleForAnonymization } from "./gdpr";

describe("monthsBetween (§13 retention math)", () => {
  it("counts whole months, flooring partial ones", () => {
    expect(monthsBetween(new Date("2025-01-15"), new Date("2025-04-15"))).toBe(3);
    expect(monthsBetween(new Date("2025-01-15"), new Date("2025-04-14"))).toBe(2);
    expect(monthsBetween(new Date("2025-01-15"), new Date("2025-01-20"))).toBe(0);
  });

  it("spans year boundaries", () => {
    expect(monthsBetween(new Date("2024-11-10"), new Date("2026-05-10"))).toBe(18);
  });
});

describe("eligibleForAnonymization (§13, person-centric)", () => {
  const now = new Date("2026-06-28");
  const policy = (months: number | null) => new Map([["r1", months]]);

  it("anonymizes when the only membership ended past the window", () => {
    const memberships = [{ restaurantId: "r1", endedAt: new Date("2025-01-01") }];
    expect(eligibleForAnonymization(memberships, policy(12), now)).toBe(true);
  });

  it("does not anonymize while still within the window", () => {
    const memberships = [{ restaurantId: "r1", endedAt: new Date("2026-03-01") }];
    expect(eligibleForAnonymization(memberships, policy(12), now)).toBe(false);
  });

  it("never anonymizes someone still actively employed", () => {
    const memberships = [{ restaurantId: "r1", endedAt: null }];
    expect(eligibleForAnonymization(memberships, policy(12), now)).toBe(false);
  });

  it("keeps the whole person while ANY other restaurant is still active", () => {
    // Left r1 long ago, but still works at r2 → must stay intact (rule #3).
    const memberships = [
      { restaurantId: "r1", endedAt: new Date("2024-01-01") },
      { restaurantId: "r2", endedAt: null },
    ];
    const policies = new Map([
      ["r1", 12],
      ["r2", 12],
    ]);
    expect(eligibleForAnonymization(memberships, policies, now)).toBe(false);
  });

  it("requires EVERY ended membership to be past its own restaurant's window", () => {
    const memberships = [
      { restaurantId: "r1", endedAt: new Date("2024-01-01") }, // past 12mo
      { restaurantId: "r2", endedAt: new Date("2026-05-01") }, // within 12mo
    ];
    const policies = new Map([
      ["r1", 12],
      ["r2", 12],
    ]);
    expect(eligibleForAnonymization(memberships, policies, now)).toBe(false);
  });

  it("blocks anonymization when a restaurant has no policy set", () => {
    const memberships = [{ restaurantId: "r1", endedAt: new Date("2020-01-01") }];
    expect(eligibleForAnonymization(memberships, policy(null), now)).toBe(false);
    expect(eligibleForAnonymization(memberships, new Map(), now)).toBe(false);
  });

  it("is false for a person with no memberships at all", () => {
    expect(eligibleForAnonymization([], policy(12), now)).toBe(false);
  });
});
