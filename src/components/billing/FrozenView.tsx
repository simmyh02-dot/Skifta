"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

type Tier = "BAS" | "FULL";

const MONTHLY_KR: Record<Tier, number> = { BAS: 249, FULL: 499 };

export function FrozenView({
  restaurantName,
  tier,
  isBillingOwner,
  billingOwnerName,
}: {
  restaurantName: string;
  tier: Tier;
  isBillingOwner: boolean;
  billingOwnerName: string | null;
}) {
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(interval: "MONTH" | "YEAR") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
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
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rounded-3xl bg-surface p-7 text-center shadow-sm ring-1 ring-border">
          <h1 className="text-xl font-bold text-ink">{t("frozenAccount.title")}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t(isBillingOwner ? "frozenAccount.body" : "frozenAccount.bodyOther", {
              restaurant: restaurantName,
              name: billingOwnerName ?? "—",
            })}
          </p>
          {isBillingOwner && (
            <div className="mt-5 flex flex-col gap-3">
              <Button size="lg" disabled={loading} onClick={() => startCheckout("MONTH")}>
                {t("billing.monthly", { price: MONTHLY_KR[tier] })}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={loading}
                onClick={() => startCheckout("YEAR")}
              >
                {t("billing.yearly", { price: MONTHLY_KR[tier] * 10 })}
              </Button>
              {error && <p className="text-sm text-accent">{error}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
