"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";

type Member = { userId: string; displayName: string; role: string };

// §13 staff/erasure management: list active employees and run the
// "anställd slutar" / right-to-erasure flow. The server (`removeMember`) is
// what actually ends the membership, clears secrets, and anonymizes the global
// User only if it was their last restaurant — this is just the trigger + list.
export function PeopleAdmin() {
  const { t } = useTranslations();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setMembers(data.members));
  }, []);

  async function remove(member: Member) {
    if (!window.confirm(t("invite.admin.removeConfirm", { name: member.displayName }))) {
      return;
    }
    setBusyId(member.userId);
    setNote(null);
    try {
      const res = await fetch(`/api/members/${member.userId}/remove`, { method: "POST" });
      if (!res.ok) {
        setNote(t("invite.admin.removeError"));
        return;
      }
      const data = await res.json();
      setMembers((prev) => prev?.filter((m) => m.userId !== member.userId) ?? null);
      setNote(
        t(data.anonymized ? "invite.admin.removeDone" : "invite.admin.removeEnded", {
          name: member.displayName,
        }),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function resetDevice(member: Member) {
    if (!window.confirm(t("invite.admin.resetDeviceConfirm", { name: member.displayName }))) {
      return;
    }
    setBusyId(member.userId);
    setNote(null);
    try {
      const res = await fetch(`/api/members/${member.userId}/reset-device`, { method: "POST" });
      setNote(
        res.ok ? t("invite.admin.resetDeviceDone", { name: member.displayName }) : t("invite.admin.removeError"),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (members === null) return null;

  return (
    <div className="mt-4 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border">
      <h2 className="text-sm font-semibold text-ink">{t("invite.admin.peopleTitle")}</h2>
      <p className="mt-1 text-xs text-ink-faint">{t("invite.admin.peopleHint")}</p>

      {note && <p className="mt-3 text-sm text-ink-muted">{note}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5"
          >
            <div>
              <p className="text-sm font-medium text-ink">{member.displayName}</p>
              <p className="text-xs text-ink-faint">{t(`app.roles.${member.role}`)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => resetDevice(member)}
                disabled={busyId === member.userId}
                className="text-xs text-ink-muted hover:underline disabled:opacity-50"
              >
                {t("invite.admin.resetDevice")}
              </button>
              {member.role !== "OWNER" && (
                <button
                  type="button"
                  onClick={() => remove(member)}
                  disabled={busyId === member.userId}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  {t("invite.admin.removeMember")}
                </button>
              )}
            </div>
          </li>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-ink-faint">{t("invite.admin.empty")}</p>
        )}
      </ul>
    </div>
  );
}
