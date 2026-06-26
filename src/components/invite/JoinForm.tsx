"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

type Preview = {
  name: string;
  restaurantName: string;
  role: string;
};

type Status = "loading" | "invalid" | "code" | "done";

export function JoinForm({ token }: { token: string }) {
  const { t } = useTranslations();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setStatus("invalid");
          return;
        }
        setPreview(data);
        setStatus("code");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function sendCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${token}/request-code`, {
        method: "POST",
      });
      if (!res.ok) {
        setStatus("invalid");
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError(t("invite.join.errorCode"));
        return;
      }
      setStatus("done");
      router.push("/app");
      router.refresh();
    } catch {
      setError(t("invite.join.errorCode"));
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return <p className="text-sm text-ink-muted">{t("invite.join.loading")}</p>;
  }

  if (status === "invalid") {
    return (
      <div>
        <h1 className="text-xl font-bold text-ink">
          {t("invite.join.invalidTitle")}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t("invite.join.invalidBody")}
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full h-12 rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">
          {t("invite.join.title", { restaurant: preview!.restaurantName })}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {t("invite.join.subtitle", {
            name: preview!.name,
            role: t(`app.roles.${preview!.role}`),
          })}
        </p>
      </div>

      {!sent ? (
        <Button
          type="button"
          size="lg"
          onClick={sendCode}
          disabled={loading}
        >
          {loading ? t("invite.join.sending") : t("invite.join.sendCode")}
        </Button>
      ) : (
        <form onSubmit={accept} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              {t("invite.join.codeLabel")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={`${inputClass} tabular tracking-[0.4em] text-center text-lg`}
              required
            />
          </label>
          {error && <p className="text-sm text-accent">{error}</p>}
          <Button type="submit" size="lg" disabled={loading || code.length < 6}>
            {loading ? t("invite.join.verifying") : t("invite.join.verify")}
          </Button>
          <button
            type="button"
            onClick={sendCode}
            disabled={loading}
            className="text-sm text-primary hover:text-primary-hover"
          >
            {t("invite.join.resend")}
          </button>
        </form>
      )}
    </div>
  );
}
