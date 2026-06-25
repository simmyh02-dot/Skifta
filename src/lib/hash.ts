import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt-based hashing for secrets we must store but never read back: one-time
// codes (§4, §12.1) and PINs (§5). No external dependency; format is
// `<saltHex>:<hashHex>` so it is self-describing and verifiable in constant time.

const scryptAsync = promisify(scrypt);
const KEY_LEN = 32;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(secret, salt, KEY_LEN)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(secret, salt, KEY_LEN)) as Buffer;
  // timingSafeEqual throws on length mismatch — guard first.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Cryptographically random numeric code, default 6 digits, for OTPs. */
export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits;
  // Rejection-free enough for OTP: uniform over [0, max) via a wide random int.
  const n = randomBytes(4).readUInt32BE(0) % max;
  return n.toString().padStart(digits, "0");
}
