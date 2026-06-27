import { describe, it, expect } from "vitest";
import {
  minutesDelta,
  gradeDeviation,
  isRepeatedPattern,
  severityForStamp,
} from "./deviations";

const tol = { toleranceLowMinutes: 10, toleranceHighMinutes: 30 };

const at = (h: number, m: number) => new Date(2026, 5, 26, h, m);

describe("minutesDelta (§6.2)", () => {
  it("measures IN against the shift start, signed", () => {
    expect(minutesDelta(at(17, 5), at(17, 0), at(22, 0), "IN")).toBe(5); // late
    expect(minutesDelta(at(16, 50), at(17, 0), at(22, 0), "IN")).toBe(-10); // early
  });

  it("measures OUT against the shift end", () => {
    expect(minutesDelta(at(22, 20), at(17, 0), at(22, 0), "OUT")).toBe(20); // stayed over
    expect(minutesDelta(at(21, 0), at(17, 0), at(22, 0), "OUT")).toBe(-60); // left early
  });
});

describe("gradeDeviation (§6.2 graded, not binary)", () => {
  it("within tolerance is not flagged either way", () => {
    expect(gradeDeviation(10, tol)).toBe("NONE");
    expect(gradeDeviation(-10, tol)).toBe("NONE");
    expect(gradeDeviation(0, tol)).toBe("NONE");
  });
  it("10–30 min is low priority", () => {
    expect(gradeDeviation(11, tol)).toBe("LOW");
    expect(gradeDeviation(-30, tol)).toBe("LOW");
  });
  it("beyond the high threshold is high priority", () => {
    expect(gradeDeviation(31, tol)).toBe("HIGH");
    expect(gradeDeviation(-120, tol)).toBe("HIGH");
  });
});

describe("repeated-pattern escalation (§6.2)", () => {
  it("flags a run of same-direction low deviations", () => {
    expect(isRepeatedPattern(15, [20, 18], tol)).toBe(true);
  });
  it("does not flag when the run is broken by an on-time stamp", () => {
    expect(isRepeatedPattern(15, [5, 20], tol)).toBe(false);
  });
  it("does not flag opposite-sign deviations as a pattern", () => {
    expect(isRepeatedPattern(15, [-20, -18], tol)).toBe(false);
  });
  it("a single low deviation is not a pattern", () => {
    expect(isRepeatedPattern(15, [], tol)).toBe(false);
  });
  it("severityForStamp bumps a lone LOW to HIGH only on a pattern", () => {
    expect(severityForStamp(15, [], tol)).toBe("LOW");
    expect(severityForStamp(15, [20, 18], tol)).toBe("HIGH");
    expect(severityForStamp(5, [20, 18], tol)).toBe("NONE");
  });
});
