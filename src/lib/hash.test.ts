import { describe, it, expect } from "vitest";
import { generateNumericCode, hashSecret, verifySecret } from "./hash";

describe("secret hashing", () => {
  it("verifies a correct secret and rejects a wrong one", async () => {
    const stored = await hashSecret("123456");
    expect(await verifySecret("123456", stored)).toBe(true);
    expect(await verifySecret("000000", stored)).toBe(false);
  });

  it("produces a salted hash (different output each time)", async () => {
    const a = await hashSecret("123456");
    const b = await hashSecret("123456");
    expect(a).not.toBe(b);
    expect(await verifySecret("123456", a)).toBe(true);
    expect(await verifySecret("123456", b)).toBe(true);
  });

  it("returns false for a malformed stored value", async () => {
    expect(await verifySecret("x", "not-a-valid-hash")).toBe(false);
  });
});

describe("numeric code generation", () => {
  it("generates a zero-padded 6-digit code by default", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateNumericCode()).toMatch(/^\d{6}$/);
    }
  });

  it("honors a custom length", () => {
    expect(generateNumericCode(4)).toMatch(/^\d{4}$/);
  });
});
