"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";

type Tag = { id: string; name: string };
type Member = { userId: string; displayName: string; role: string; tagIds: string[] };

export function TagsAdmin() {
  const { t } = useTranslations();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setTags(data.tags));
    fetch("/api/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setMembers(data.members));
  }, []);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTag.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTag.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags);
        setNewTag("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (res.ok) setTags((prev) => prev?.filter((tag) => tag.id !== id) ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMemberTag(member: Member, tagId: string) {
    const nextTagIds = member.tagIds.includes(tagId)
      ? member.tagIds.filter((id) => id !== tagId)
      : [...member.tagIds, tagId];

    setMembers(
      (prev) =>
        prev?.map((m) => (m.userId === member.userId ? { ...m, tagIds: nextTagIds } : m)) ??
        null,
    );
    await fetch(`/api/members/${member.userId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: nextTagIds }),
    });
  }

  if (tags === null || members === null) return null;

  return (
    <div className="mt-4 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border">
      <h2 className="text-sm font-semibold text-ink">{t("invite.admin.tagsTitle")}</h2>
      <p className="mt-1 text-xs text-ink-faint">{t("invite.admin.tagsHint")}</p>

      <form onSubmit={addTag} className="mt-3 flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder={t("invite.admin.newTagPlaceholder")}
          className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink"
        />
        <Button type="submit" size="md" disabled={busy}>
          {t("invite.admin.addTag")}
        </Button>
      </form>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-ink"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="text-ink-faint hover:text-accent"
                aria-label={t("invite.admin.removeTag")}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {tags.length > 0 && members.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-ink-muted">
            {t("invite.admin.membersTitle")}
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="py-1 pr-3 text-ink-faint">{t("invite.admin.membersTitle")}</th>
                  {tags.map((tag) => (
                    <th key={tag.id} className="px-2 py-1 text-ink-faint">
                      {tag.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td className="py-1 pr-3 text-ink">{member.displayName}</td>
                    {tags.map((tag) => (
                      <td key={tag.id} className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={member.tagIds.includes(tag.id)}
                          onChange={() => toggleMemberTag(member, tag.id)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
