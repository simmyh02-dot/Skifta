import { describe, expect, it } from "vitest";
import { parseCustomRuleSet } from "./rules";

describe("parseCustomRuleSet", () => {
  const validWindow = {
    label: "Kväll",
    days: [0, 1, 2, 3, 4],
    startMinute: 18 * 60,
    endMinute: 24 * 60,
    percent: 0.5,
  };

  it("accepts a valid custom ruleset with windows and overtime", () => {
    const result = parseCustomRuleSet({
      name: "Eget avtal",
      windows: [validWindow],
      overtime: { thresholdHours: 40, percent: 0.5 },
    });
    expect(result).not.toBeNull();
    expect(result?.windows).toHaveLength(1);
    expect(result?.overtime).toEqual({ thresholdHours: 40, percent: 0.5 });
  });

  it("accepts an empty windows list with no overtime", () => {
    const result = parseCustomRuleSet({ name: "Inget", windows: [], overtime: null });
    expect(result).toEqual({ name: "Inget", windows: [], overtime: null });
  });

  it("rejects a missing or blank name", () => {
    expect(parseCustomRuleSet({ name: "", windows: [] })).toBeNull();
    expect(parseCustomRuleSet({ windows: [] })).toBeNull();
  });

  it("rejects a window with start >= end", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [{ ...validWindow, startMinute: 600, endMinute: 600 }],
    });
    expect(result).toBeNull();
  });

  it("rejects a window with an out-of-range day", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [{ ...validWindow, days: [7] }],
    });
    expect(result).toBeNull();
  });

  it("rejects duplicate days within a window", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [{ ...validWindow, days: [0, 0] }],
    });
    expect(result).toBeNull();
  });

  it("rejects a percent above the sanity cap", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [{ ...validWindow, percent: 10 }],
    });
    expect(result).toBeNull();
  });

  it("rejects a negative percent", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [{ ...validWindow, percent: -0.1 }],
    });
    expect(result).toBeNull();
  });

  it("rejects an overtime threshold of zero or below", () => {
    const result = parseCustomRuleSet({
      name: "x",
      windows: [],
      overtime: { thresholdHours: 0, percent: 0.5 },
    });
    expect(result).toBeNull();
  });

  it("rejects a non-array windows field", () => {
    expect(parseCustomRuleSet({ name: "x", windows: "nope" })).toBeNull();
  });

  it("rejects a non-object input", () => {
    expect(parseCustomRuleSet(null)).toBeNull();
    expect(parseCustomRuleSet("x")).toBeNull();
  });
});
