import { describe, it, expect } from "vitest";
import { nextDirection, accumulateHours } from "./clock";

describe("nextDirection (§6.2 toggle)", () => {
  it("first stamp is IN", () => {
    expect(nextDirection(null)).toBe("IN");
    expect(nextDirection(undefined)).toBe("IN");
  });
  it("toggles from the last stamp", () => {
    expect(nextDirection({ direction: "IN" })).toBe("OUT");
    expect(nextDirection({ direction: "OUT" })).toBe("IN");
  });
});

describe("accumulateHours (§6.2 own accumulated hours)", () => {
  const ev = (h: number, dir: "IN" | "OUT") => ({
    direction: dir,
    timestamp: new Date(2026, 5, 26, h, 0),
  });

  it("sums paired IN→OUT spans", () => {
    const { hours, openSince } = accumulateHours([ev(9, "IN"), ev(17, "OUT")]);
    expect(hours).toBe(8);
    expect(openSince).toBeNull();
  });

  it("handles multiple shifts in a period", () => {
    const { hours } = accumulateHours([
      ev(9, "IN"),
      ev(12, "OUT"),
      ev(13, "IN"),
      ev(17, "OUT"),
    ]);
    expect(hours).toBe(7);
  });

  it("reports a still-open IN without counting it", () => {
    const { hours, openSince } = accumulateHours([ev(9, "IN")]);
    expect(hours).toBe(0);
    expect(openSince).toEqual(new Date(2026, 5, 26, 9, 0));
  });

  it("is order-independent", () => {
    const { hours } = accumulateHours([ev(17, "OUT"), ev(9, "IN")]);
    expect(hours).toBe(8);
  });
});
