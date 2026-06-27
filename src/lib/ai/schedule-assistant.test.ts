import { describe, it, expect } from "vitest";
import { resolveMembers, type ProposedShift } from "./schedule-assistant";

describe("resolveMembers (§8.1 ambiguity must show, never hide)", () => {
  const members = [
    { id: "u1", name: "Erik" },
    { id: "u2", name: "Anna" },
  ];

  function shift(overrides: Partial<ProposedShift> = {}): ProposedShift {
    return {
      memberName: "Erik",
      date: "2026-07-01",
      startTime: "17:00",
      endTime: "22:00",
      requiredTags: [],
      ambiguous: false,
      note: "",
      ...overrides,
    };
  }

  it("matches a member name case-insensitively", () => {
    const [resolved] = resolveMembers([shift({ memberName: "erik" })], members);
    expect(resolved.memberId).toBe("u1");
    expect(resolved.ambiguous).toBe(false);
  });

  it("flags ambiguous when no member matches, instead of guessing", () => {
    const [resolved] = resolveMembers([shift({ memberName: "Okänd Person" })], members);
    expect(resolved.memberId).toBeNull();
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.note).toContain("Okänd Person");
  });

  it("keeps the AI's own ambiguous flag even when the name matches", () => {
    const [resolved] = resolveMembers(
      [shift({ memberName: "Anna", ambiguous: true, note: "Tiderna varierade förra veckan." })],
      members,
    );
    expect(resolved.memberId).toBe("u2");
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.note).toBe("Tiderna varierade förra veckan.");
  });
});
