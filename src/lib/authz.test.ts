import { describe, it, expect } from "vitest";
import { can } from "./authz";

describe("authz policy (§12.2)", () => {
  // The spec's required negative test: a Bas-tier context must be denied the
  // economy endpoints (the route guard turns this `false` into a 403).
  it("denies economy access on the Bas tier, regardless of role", () => {
    expect(can({ role: "OWNER", tier: "BAS" }, "economy:view")).toBe(false);
    expect(can({ role: "CO_OWNER", tier: "BAS" }, "economy:export")).toBe(false);
    expect(can({ role: "EMPLOYEE", tier: "BAS" }, "economy:view")).toBe(false);
    expect(can({ role: "OWNER", tier: "BAS" }, "payroll:manage")).toBe(false);
    expect(can({ role: "OWNER", tier: "BAS" }, "ai:payroll")).toBe(false);
  });

  it("denies clock-in on the Bas tier (clock-in is a Full feature)", () => {
    expect(can({ role: "EMPLOYEE", tier: "BAS" }, "clock:stamp")).toBe(false);
    expect(can({ role: "OWNER", tier: "BAS" }, "clock:stamp")).toBe(false);
  });

  it("allows admins economy access on the Full tier", () => {
    expect(can({ role: "OWNER", tier: "FULL" }, "economy:view")).toBe(true);
    expect(can({ role: "CO_OWNER", tier: "FULL" }, "economy:export")).toBe(true);
    expect(can({ role: "OWNER", tier: "FULL" }, "ai:schedule")).toBe(true);
  });

  it("blocks employees from admin/economy actions even on Full", () => {
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "economy:view")).toBe(false);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "shift:manage")).toBe(false);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "members:manage")).toBe(false);
  });

  it("treats co-owner as equal to owner (§3.2)", () => {
    expect(can({ role: "CO_OWNER", tier: "FULL" }, "members:manage")).toBe(true);
    expect(can({ role: "CO_OWNER", tier: "FULL" }, "settings:manage")).toBe(true);
    expect(can({ role: "CO_OWNER", tier: "FULL" }, "swap:approve")).toBe(true);
  });

  it("lets employees do their everyday shift + clock actions on Full", () => {
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "shift:viewOwn")).toBe(true);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "availability:setOwn")).toBe(true);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "swap:request")).toBe(true);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "clock:stamp")).toBe(true);
    expect(can({ role: "EMPLOYEE", tier: "FULL" }, "clock:viewOwn")).toBe(true);
  });

  it("allows the shift section on both tiers", () => {
    expect(can({ role: "EMPLOYEE", tier: "BAS" }, "shift:viewOwn")).toBe(true);
    expect(can({ role: "OWNER", tier: "BAS" }, "shift:manage")).toBe(true);
  });
});
