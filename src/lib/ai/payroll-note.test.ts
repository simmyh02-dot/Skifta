import { describe, it, expect } from "vitest";
import { fallbackNote, payrollNote, type PayrollNoteInput } from "./payroll-note";

const base: PayrollNoteInput = {
  periodLabel: "juni 2026",
  members: [
    { name: "Erik L.", baseHours: 38, obHours: 6, gross: 6800, missingRate: false, unreviewed: false },
    { name: "Sara M.", baseHours: 20, obHours: 0, gross: null, missingRate: true, unreviewed: false },
    { name: "Olle R.", baseHours: 25, obHours: 4, gross: 4200, missingRate: false, unreviewed: true },
  ],
};

describe("fallbackNote (deterministic, no AI needed)", () => {
  it("names members missing a rate and members with unreviewed deviations", () => {
    const text = fallbackNote(base);
    expect(text).toContain("juni 2026");
    expect(text).toContain("Sara M."); // missing rate
    expect(text).toContain("Olle R."); // unreviewed
    expect(text).toContain("11000"); // 6800 + 4200 gross sum
  });

  it("says nothing needs action when all rates set and all reviewed", () => {
    const clean = fallbackNote({
      periodLabel: "juni 2026",
      members: [{ name: "A", baseHours: 10, obHours: 0, gross: 1500, missingRate: false, unreviewed: false }],
    });
    expect(clean).toMatch(/redo att granskas/);
  });
});

describe("payrollNote", () => {
  it("falls back to the deterministic note with no API key (never throws)", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const note = await payrollNote(base);
      expect(note.source).toBe("fallback");
      expect(note.text).toBe(fallbackNote(base));
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});
