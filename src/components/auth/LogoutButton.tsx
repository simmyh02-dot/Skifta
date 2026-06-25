"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@/i18n/LocaleProvider";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useTranslations();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="text-sm font-medium text-ink-muted hover:text-ink"
    >
      {t("auth.logout")}
    </button>
  );
}
