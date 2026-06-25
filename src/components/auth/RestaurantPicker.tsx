"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/i18n/LocaleProvider";

export type PickerRestaurant = {
  id: string;
  name: string;
  role: string;
};

export function RestaurantPicker({
  restaurants,
}: {
  restaurants: PickerRestaurant[];
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function pick(id: string) {
    setBusyId(id);
    await fetch("/api/restaurants/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: id }),
    });
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-ink">{t("auth.picker.title")}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {t("auth.picker.subtitle")}
      </p>
      <ul className="mt-6 flex flex-col gap-2">
        {restaurants.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => pick(r.id)}
              disabled={busyId !== null}
              className="flex w-full items-center justify-between rounded-2xl bg-surface px-5 py-4 text-left shadow-sm ring-1 ring-border transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="font-semibold text-ink">{r.name}</span>
              <span className="text-xs text-ink-faint">
                {t(`app.roles.${r.role}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
