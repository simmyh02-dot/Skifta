"use client";

import { useRef, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { TagsAdmin } from "@/components/admin/TagsAdmin";
import { PeopleAdmin } from "@/components/admin/PeopleAdmin";
import { parseInviteCsv, type ParsedInviteRow } from "@/lib/csv-invite";
import { AppShell } from "@/components/app/AppShell";

type Role = "EMPLOYEE" | "CO_OWNER";

export type InviteRow = {
  id: string;
  name: string;
  normalizedContact: string;
  role: string;
  status: string;
  expiresAt: string;
};

export function MembersAdminView({
  initialInvites,
  role: userRole,
  restaurantName,
  displayName,
}: {
  initialInvites: InviteRow[];
  role: string;
  restaurantName: string;
  displayName: string;
}) {
  const { t } = useTranslations();
  const [invites, setInvites] = useState(initialInvites);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [uploadRows, setUploadRows] = useState<ParsedInviteRow[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputClass =
    "h-11 rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, role }),
      });
      if (!res.ok) {
        setError(t("invite.admin.errorCreate"));
        return;
      }
      const data = await res.json();
      setInvites((prev) => [
        {
          id: data.invite.id,
          name: data.invite.name,
          normalizedContact: data.invite.normalizedContact,
          role: data.invite.role,
          status: data.invite.status,
          expiresAt: data.invite.expiresAt,
        },
        ...prev,
      ]);
      setName("");
      setContact("");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${id}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: "REVOKED" } : inv,
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /** Post a batch of rows to the bulk endpoint (shared by paste + file upload),
   *  report the result, and refresh the invite list. */
  async function submitRows(
    rows: { name: string; contact: string; role: string }[],
  ): Promise<boolean> {
    if (rows.length === 0) return false;
    const res = await fetch("/api/invites/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      setError(t("invite.admin.errorCreate"));
      return false;
    }
    const data = await res.json();
    setBulkResult(
      t("invite.admin.bulkResult", {
        created: data.created,
        skipped: data.skipped?.length ?? 0,
      }),
    );
    const res2 = await fetch("/api/invites");
    if (res2.ok) {
      const list = await res2.json();
      setInvites(
        list.invites.map((i: InviteRow) => ({ ...i, expiresAt: i.expiresAt })),
      );
    }
    return true;
  }

  async function bulkInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBulkResult(null);
    try {
      const rows = bulkText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [namePart, contactPart] = line.split(",").map((s) => s.trim());
          return { name: namePart, contact: contactPart, role: "EMPLOYEE" };
        });
      if (await submitRows(rows)) setBulkText("");
    } finally {
      setLoading(false);
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBulkResult(null);
    setUploadNote(null);
    const text = await file.text();
    const { rows, skipped } = parseInviteCsv(text);
    if (rows.length === 0) {
      setUploadRows([]);
      setUploadNote(t("invite.admin.uploadEmpty"));
    } else {
      setUploadRows(rows);
      setUploadNote(
        t("invite.admin.uploadParsed", { count: rows.length, skipped }),
      );
    }
    // Allow re-picking the same file after a send.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendUpload() {
    setLoading(true);
    setError(null);
    try {
      if (await submitRows(uploadRows)) {
        setUploadRows([]);
        setUploadNote(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell role={userRole} restaurantName={restaurantName} displayName={displayName}>
      <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold text-ink">{t("invite.admin.title")}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {t("invite.admin.subtitle")}
      </p>

      <PeopleAdmin />

      <TagsAdmin />

      <form
        onSubmit={invite}
        className="mt-6 flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border"
      >
        <h2 className="text-sm font-semibold text-ink">
          {t("invite.admin.singleTitle")}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("invite.admin.namePlaceholder")}
            className={`${inputClass} flex-1`}
            required
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("invite.admin.contactPlaceholder")}
            className={`${inputClass} flex-1`}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputClass}
          >
            <option value="EMPLOYEE">{t("app.roles.EMPLOYEE")}</option>
            <option value="CO_OWNER">{t("app.roles.CO_OWNER")}</option>
          </select>
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        <Button type="submit" disabled={loading}>
          {t("invite.admin.send")}
        </Button>
      </form>

      <form
        onSubmit={bulkInvite}
        className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border"
      >
        <h2 className="text-sm font-semibold text-ink">
          {t("invite.admin.bulkTitle")}
        </h2>
        <p className="text-xs text-ink-faint">{t("invite.admin.bulkHint")}</p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={5}
          placeholder={"Anna Andersson, 070 123 45 67\nErik Eriksson, erik@example.com"}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {bulkResult && <p className="text-sm text-ink-muted">{bulkResult}</p>}
        <Button type="submit" variant="secondary" disabled={loading}>
          {t("invite.admin.bulkSend")}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border">
        <h2 className="text-sm font-semibold text-ink">
          {t("invite.admin.uploadTitle")}
        </h2>
        <p className="text-xs text-ink-faint">{t("invite.admin.uploadHint")}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={onFilePicked}
          className="text-sm text-ink-muted file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/15"
        />
        {uploadNote && <p className="text-sm text-ink-muted">{uploadNote}</p>}
        {uploadRows.length > 0 && (
          <>
            <ul className="max-h-40 overflow-y-auto rounded-xl bg-surface-2 px-4 py-2 text-xs text-ink-muted ring-1 ring-border">
              {uploadRows.map((r, i) => (
                <li key={i} className="py-0.5">
                  {r.name} · {r.contact}
                  {r.role === "CO_OWNER" && ` · ${t("app.roles.CO_OWNER")}`}
                </li>
              ))}
            </ul>
            <Button type="button" onClick={sendUpload} disabled={loading}>
              {t("invite.admin.bulkSend")}
            </Button>
          </>
        )}
      </div>

      <ul className="mt-6 flex flex-col gap-2">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 ring-1 ring-border"
          >
            <div>
              <p className="text-sm font-medium text-ink">{inv.name}</p>
              <p className="text-xs text-ink-faint">
                {inv.normalizedContact} · {t(`app.roles.${inv.role}`)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-muted">
                {t(`invite.admin.status.${inv.status}`)}
              </span>
              {inv.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => revoke(inv.id)}
                  disabled={loading}
                  className="text-xs text-accent hover:underline"
                >
                  {t("invite.admin.revoke")}
                </button>
              )}
            </div>
          </li>
        ))}
        {invites.length === 0 && (
          <p className="text-sm text-ink-faint">{t("invite.admin.empty")}</p>
        )}
      </ul>
      </div>
    </AppShell>
  );
}
