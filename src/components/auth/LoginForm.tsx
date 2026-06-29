"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

type Step = "contact" | "code";

export function LoginForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  // A `next` param means the proxy bounced an expired/no-session visit to an
  // app page here, not someone choosing to log in from the marketing site —
  // a clearer "you were signed out" framing reads as more deliberate than
  // the generic first-time login copy.
  const expired = params.has("next");

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      if (!res.ok) {
        setError(t("auth.login.errorContact"));
        return;
      }
      setInfo(t("auth.login.sent"));
      setStep("code");
    } catch {
      setError(t("auth.login.errorContact"));
    } finally {
      setLoading(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, code }),
      });
      if (!res.ok) {
        setError(t("auth.login.errorCode"));
        return;
      }
      const data = (await res.json()) as { restaurantCount?: number };
      router.push((data.restaurantCount ?? 0) > 1 ? "/app/select" : next);
    } catch {
      setError(t("auth.login.errorCode"));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full h-12 rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  if (step === "contact") {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {expired ? t("auth.login.expiredTitle") : t("auth.login.title")}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {expired ? t("auth.login.expiredSubtitle") : t("auth.login.subtitle")}
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            {t("auth.login.contactLabel")}
          </span>
          <input
            type="text"
            autoComplete="username"
            inputMode="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("auth.login.contactPlaceholder")}
            className={inputClass}
            required
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button type="submit" size="lg" disabled={loading || !contact.trim()}>
          {loading ? t("auth.login.sending") : t("auth.login.sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {t("auth.login.codeTitle")}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {t("auth.login.codeSubtitle", { contact })}
        </p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          {t("auth.login.codeLabel")}
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`${inputClass} tabular tracking-[0.4em] text-center text-lg`}
          required
        />
      </label>
      {info && !error && <p className="text-sm text-ink-faint">{info}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
      <Button type="submit" size="lg" disabled={loading || code.length < 6}>
        {loading ? t("auth.login.verifying") : t("auth.login.verify")}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("contact");
            setCode("");
            setError(null);
          }}
          className="text-ink-muted hover:text-ink"
        >
          {t("auth.login.back")}
        </button>
        <button
          type="button"
          onClick={() => requestCode()}
          disabled={loading}
          className="text-primary hover:text-primary-hover"
        >
          {t("auth.login.resend")}
        </button>
      </div>
    </form>
  );
}
