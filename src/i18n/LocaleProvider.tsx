"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./config";
import sv, { type Messages } from "./messages/sv";
import en from "./messages/en";

const catalogs: Record<Locale, Messages> = { sv, en };

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
  /** Dot-path string lookup, e.g. t("hero.title"). Falls back to the default
   *  catalog, then to the key itself, so a missing key never crashes a view. */
  t: (key: string, vars?: Vars) => string;
  /** The full typed catalog, for structured access (arrays, etc.). */
  m: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function lookup(catalog: Messages, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      catalog,
    );
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function LocaleProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Restore a previously chosen locale on the client. Initial render stays
  // deterministic (= initialLocale) to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  // Keep <html lang> in sync for accessibility / SEO without a reload.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    () => setLocale(locale === "sv" ? "en" : "sv"),
    [locale, setLocale],
  );

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const value =
        lookup(catalogs[locale], key) ?? lookup(catalogs[defaultLocale], key);
      return typeof value === "string" ? interpolate(value, vars) : key;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggle, t, m: catalogs[locale] }),
    [locale, setLocale, toggle, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useTranslations(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useTranslations must be used within a <LocaleProvider>");
  }
  return ctx;
}
