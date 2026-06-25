import { describe, it, expect } from "vitest";
import { normalizeContact, normalizeEmail, normalizePhone } from "./contact";

describe("phone normalization to E.164 (§4, §15)", () => {
  it("normalizes Swedish national formats to +46…", () => {
    expect(normalizePhone("0701234567")).toBe("+46701234567");
    expect(normalizePhone("070-123 45 67")).toBe("+46701234567");
    expect(normalizePhone("+46 70 123 45 67")).toBe("+46701234567");
  });

  it("returns null for non-numbers", () => {
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("email normalization", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo.Bar@Example.SE ")).toBe("foo.bar@example.se");
  });

  it("rejects malformed addresses", () => {
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@c.se")).toBeNull();
  });
});

describe("contact type detection", () => {
  it("detects phone vs email and normalizes", () => {
    expect(normalizeContact("0701234567")).toEqual({
      type: "PHONE",
      value: "+46701234567",
    });
    expect(normalizeContact("Foo@Bar.se")).toEqual({
      type: "EMAIL",
      value: "foo@bar.se",
    });
  });

  it("returns null for garbage", () => {
    expect(normalizeContact("???")).toBeNull();
  });
});
