"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

type Tier = "BAS" | "FULL";
type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "FROZEN" | "CANCELED";

// Matches the prices created by scripts/stripe-setup.mjs (§12.3): monthly kr,
// yearly priced at 10× monthly (≈2 months free) as the retention discount.
const MONTHLY_KR: Record<Tier, number> = { BAS: 249, FULL: 499 };

export function BillingView({
  restaurantName,
  tier,
  subscriptionStatus,
  trialDaysLeft,
  hasStripeCustomer,
  isBillingOwner,
  billingOwnerName,
}: {
  restaurantName: string;
  tier: Tier;
  subscriptionStatus: SubscriptionStatus;
  trialDaysLeft: number | null;
  hasStripeCustomer: boolean;
  isBillingOwner: boolean;
  billingOwnerName: string | null;
}) {
  const { t } = useTranslations();
  const [loading, setLoading] = useState<"MONTH" | "YEAR" | "PORTAL" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string, body?: object) {
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error === "billing_unavailable" ? t("billing.unavailable") : t("billing.error"));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("billing.error"));
    } finally {
      setLoading(null);
    }
  }

  const monthlyKr = MONTHLY_KR[tier];

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <a href="/app/schedule" className="text-sm text-ink-muted hover:text-primary">
            {t("app.nav.schedule")}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-md">
          <h1 className="text-xl font-bold text-ink">{t("billing.title")}</h1>

          {!isBillingOwner ? (
            <div className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-border">
              <h2 className="font-semibold text-ink">{t("billing.notOwnerTitle")}</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                {t("billing.notOwnerBody", {
                  name: billingOwnerName ?? "—",
                  restaurant: restaurantName,
                })}
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-2xl bg-surface p-5 ring-1 ring-border">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  {subscriptionStatus === "TRIALING" ? t("billing.trialBadge") : t("billing.activeBadge")}
                </span>
                <p className="mt-2 text-sm text-ink-muted">
                  {subscriptionStatus === "TRIALING"
                    ? trialDaysLeft && trialDaysLeft > 0
                      ? t("billing.trialDaysLeft", { days: trialDaysLeft })
                      : t("billing.trialEnded")
                    : `${t(tier === "BAS" ? "billing.planBas" : "billing.planFull")} — ${restaurantName}`}
                </p>
              </div>

              <Button
                size="lg"
                disabled={loading !== null}
                onClick={() => {
                  setLoading("MONTH");
                  go("/api/billing/checkout", { interval: "MONTH" });
                }}
              >
                {t("billing.monthly", { price: monthlyKr })}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={loading !== null}
                onClick={() => {
                  setLoading("YEAR");
                  go("/api/billing/checkout", { interval: "YEAR" });
                }}
              >
                {t("billing.yearly", { price: monthlyKr * 10 })}
              </Button>

              {hasStripeCustomer && (
                <button
                  type="button"
                  disabled={loading !== null}
                  onClick={() => {
                    setLoading("PORTAL");
                    go("/api/billing/portal");
                  }}
                  className="text-sm text-primary hover:text-primary-hover"
                >
                  {t("billing.manage")}
                </button>
              )}
              {!hasStripeCustomer && <p className="text-xs text-ink-faint">{t("billing.noCardYet")}</p>}
              {error && <p className="text-sm text-accent">{error}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
