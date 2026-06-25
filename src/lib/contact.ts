import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { ContactType } from "@prisma/client";

// Contact normalisation (spec §4). ALL phone numbers normalise to E.164 (+46…)
// and emails to lowercase BEFORE any matching or storage, so an invite, a login,
// and an existing account always resolve to the same canonical value.

/** Default region for bare national numbers like "0701234567". */
const DEFAULT_REGION = "SE" as const;

export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), DEFAULT_REGION);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164, e.g. +46701234567
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  // Deliberately strict-but-simple: one @, a dot in the domain, no whitespace.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export type NormalizedContact = {
  type: ContactType;
  value: string;
};

/** Detect whether the input is a phone or email and normalise it, or null. */
export function normalizeContact(input: string): NormalizedContact | null {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    const value = normalizeEmail(trimmed);
    return value ? { type: "EMAIL", value } : null;
  }
  const value = normalizePhone(trimmed);
  return value ? { type: "PHONE", value } : null;
}
