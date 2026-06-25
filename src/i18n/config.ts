// Locale configuration for Skifta.
// Swedish is the base/source language (spec §11). English is the first
// additional language, exposed as a discreet SV/EN toggle on the landing page.
// More languages are an additive operation: add a catalog + a label here.

export const locales = ["sv", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "sv";

export const localeLabels: Record<Locale, string> = {
  sv: "SV",
  en: "EN",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

export const LOCALE_STORAGE_KEY = "skifta.locale";
