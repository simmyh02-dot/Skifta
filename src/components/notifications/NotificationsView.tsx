"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";

type NotificationDTO = {
  id: string;
  type:
    | "SHIFT_ASSIGNED"
    | "SHIFT_CHANGED"
    | "SWAP_NEEDS_REPLY"
    | "SWAP_ACCEPTED"
    | "SWAP_APPROVED"
    | "SWAP_ESCALATED"
    | "INTEREST_REJECTED"
    | "DEVIATION_DIGEST";
  restaurantName: string;
  startsAt: string | null;
  count: number | null;
  relatedShiftId: string | null;
  relatedSwapId: string | null;
  actionable: boolean;
  status: "UNREAD" | "READ" | "ACTIONED";
  createdAt: string;
};

function whenLabel(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(new Date(iso));
}

export function NotificationsView({
  initialNotifications,
}: {
  initialNotifications: NotificationDTO[];
}) {
  const { t } = useTranslations();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState<string | null>(null);

  // Mark every unread item READ once the worker has actually opened the feed.
  useEffect(() => {
    const unread = initialNotifications.filter((n) => n.status === "UNREAD");
    if (unread.length === 0) return;
    Promise.all(
      unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "POST" })),
    ).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.status === "UNREAD" ? { ...n, status: "READ" } : n)),
      );
    });
    // Only on the initial load — re-running on every `notifications` change
    // would re-mark items we just optimistically updated locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(notificationId: string, url: string) {
    setBusy(url);
    try {
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        await fetch(`/api/notifications/${notificationId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIONED" }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, status: "ACTIONED" } : n)),
        );
      }
    } finally {
      setBusy(null);
    }
  }

  function body(n: NotificationDTO): string {
    switch (n.type) {
      case "SHIFT_ASSIGNED":
        return t("notifications.body.SHIFT_ASSIGNED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "SHIFT_CHANGED":
        return t("notifications.body.SHIFT_CHANGED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "SWAP_NEEDS_REPLY":
        return t("notifications.body.SWAP_NEEDS_REPLY", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "SWAP_ACCEPTED":
        return t("notifications.body.SWAP_ACCEPTED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "SWAP_APPROVED":
        return t("notifications.body.SWAP_APPROVED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "SWAP_ESCALATED":
        return t("notifications.body.SWAP_ESCALATED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "INTEREST_REJECTED":
        return t("notifications.body.INTEREST_REJECTED", {
          restaurantName: n.restaurantName,
          when: n.startsAt ? whenLabel(n.startsAt) : "",
        });
      case "DEVIATION_DIGEST":
        return t("notifications.body.DEVIATION_DIGEST", {
          restaurantName: n.restaurantName,
          count: String(n.count ?? 0),
        });
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <a href="/app/schedule" className="text-sm text-ink-muted hover:text-primary">
            {t("app.nav.schedule")}
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold text-ink">{t("notifications.title")}</h1>

          {notifications.length === 0 && (
            <p className="mt-6 text-sm text-ink-faint">{t("notifications.empty")}</p>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl p-3 text-sm shadow-sm ring-1 ring-border ${
                  n.status === "UNREAD" ? "bg-primary/5" : "bg-surface"
                }`}
              >
                <p className="text-ink">{body(n)}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {n.actionable && n.status !== "ACTIONED" && n.relatedSwapId && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {n.type === "SWAP_NEEDS_REPLY" && (
                      <button
                        type="button"
                        disabled={busy === `/api/swaps/${n.relatedSwapId}/respond`}
                        onClick={() => act(n.id, `/api/swaps/${n.relatedSwapId}/respond`)}
                        className="h-7 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-ink hover:bg-primary-hover disabled:opacity-60"
                      >
                        {t("notifications.actions.accept")}
                      </button>
                    )}
                    {(n.type === "SWAP_ACCEPTED" || n.type === "SWAP_ESCALATED") && (
                      <button
                        type="button"
                        disabled={busy === `/api/swaps/${n.relatedSwapId}/approve`}
                        onClick={() => act(n.id, `/api/swaps/${n.relatedSwapId}/approve`)}
                        className="h-7 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-ink hover:bg-primary-hover disabled:opacity-60"
                      >
                        {t("notifications.actions.approve")}
                      </button>
                    )}
                    <a
                      href="/app/schedule"
                      className="flex h-7 items-center rounded-full border border-border-strong px-2.5 text-xs text-ink hover:bg-surface-2"
                    >
                      {t("notifications.actions.openSchedule")}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
