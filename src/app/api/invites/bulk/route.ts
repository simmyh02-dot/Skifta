import { normalizeContact } from "@/lib/contact";
import { createBulkInvites, type BulkInviteRow } from "@/lib/invite";
import { requirePermission, requireUser, errorResponse } from "@/lib/guard";

// POST { rows: [{ name, contact, role }] } → mass-invite (§4 "bjud in alla").
// Each row gets its own personal one-time link; invalid rows are skipped and
// reported back rather than failing the whole batch.

export async function POST(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    const { userId } = await requirePermission(
      activeRestaurantId,
      "members:manage",
    );

    const body = await req.json().catch(() => null);
    const rawRows = body?.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const rows: BulkInviteRow[] = [];
    const skipped: { name: unknown; contact: unknown }[] = [];

    for (const row of rawRows) {
      const name = typeof row?.name === "string" ? row.name.trim() : "";
      const role = row?.role === "CO_OWNER" ? "CO_OWNER" : "EMPLOYEE";
      const contact =
        typeof row?.contact === "string"
          ? normalizeContact(row.contact)
          : null;
      if (!name || !contact) {
        skipped.push({ name: row?.name, contact: row?.contact });
        continue;
      }
      rows.push({ name, contact, role });
    }

    const result = await createBulkInvites(activeRestaurantId, userId, rows);
    return Response.json({ created: result.created, skipped });
  } catch (err) {
    return errorResponse(err);
  }
}
