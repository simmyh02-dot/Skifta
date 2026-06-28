"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

type Step = "details" | "code";
type Tier = "BAS" | "FULL";

export function SignupForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const tier: Tier = params.get("plan") === "bas" ? "BAS" : "FULL";

  const [step, setStep] = useState<Step>("details");
  const [displayName, setDisplayName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full h-12 rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      if (!res.ok) {
        setError(t("auth.signup.errorContact"));
        return;
      }
      setStep("code");
    } catch {
      setError(t("auth.signup.errorContact"));
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, code, displayName, restaurantName, orgNumber, tier }),
      });
      if (!res.ok) {
        setError(t("auth.signup.errorCode"));
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError(t("auth.signup.errorCode"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "details") {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("auth.signup.title")}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {t(tier === "BAS" ? "auth.signup.subtitleBas" : "auth.signup.subtitleFull")}
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("auth.signup.nameLabel")}</span>
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("auth.signup.restaurantLabel")}</span>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("auth.signup.orgNumberLabel")}</span>
          <input
            type="text"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
            placeholder={t("auth.signup.orgNumberPlaceholder")}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("auth.signup.contactLabel")}</span>
          <input
            type="text"
            autoComplete="username"
            inputMode="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("auth.signup.contactPlaceholder")}
            className={inputClass}
            required
          />
        </label>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button
          type="submit"
          size="lg"
          disabled={loading || !displayName.trim() || !restaurantName.trim() || !contact.trim()}
        >
          {loading ? t("auth.signup.sending") : t("auth.signup.sendCode")}
        </Button>
        <p className="text-center text-xs text-ink-faint">{t("auth.signup.noCard")}</p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t("auth.signup.codeTitle")}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t("auth.signup.codeSubtitle", { contact })}</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{t("auth.signup.codeLabel")}</span>
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
      {error && <p className="text-sm text-accent">{error}</p>}
      <Button type="submit" size="lg" disabled={loading || code.length < 6}>
        {loading ? t("auth.signup.verifying") : t("auth.signup.verify")}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        {t("auth.signup.legalPrefix")}{" "}
        <a href="/dpa" target="_blank" className="underline hover:text-primary">
          {t("footer.dpa")}
        </a>{" "}
        {t("auth.signup.legalAnd")}{" "}
        <a href="/privacy" target="_blank" className="underline hover:text-primary">
          {t("footer.privacy")}
        </a>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          setStep("details");
          setCode("");
          setError(null);
        }}
        className="text-sm text-ink-muted hover:text-ink"
      >
        {t("auth.signup.back")}
      </button>
    </form>
  );
}
