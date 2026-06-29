import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission, errorResponse } from "@/lib/guard";
import { toCsv } from "@/lib/economy";

// "Exportera all min data" (§6.3): the restaurant's full record — employees,
// schedules, stamp history — as JSON or CSV. One feature, two problems solved:
// anti-lock-in trust AND GDPR data portability (§13). Gated on members:manage
// (admin, BOTH tiers) so even a Bas owner can take their data with them.
export async function GET(req: Request) {
  try {
    const { activeRestaurantId } = await requireUser();
    if (!activeRestaurantId) {
      return Response.json({ error: "no_active_restaurant" }, { status: 400 });
    }
    await requirePermission(activeRestaurantId, "members:manage");

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: activeRestaurantId },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { endedAt: null },
          select: {
            role: true,
            localLabel: true,
            createdAt: true,
            user: { select: { displayName: true, normalizedPhone: true, normalizedEmail: true } },
          },
        },
        shifts: {
          orderBy: { startsAt: "asc" },
          select: {
            startsAt: true,
            endsAt: true,
            status: true,
            note: true,
            assignments: { include: { user: { select: { displayName: true } } } },
            requiredTags: { select: { name: true } },
          },
        },
        clockEvents: {
          orderBy: { timestamp: "asc" },
          select: {
            timestamp: true,
            direction: true,
            verificationMethod: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });
    if (!restaurant) return Response.json({ error: "not_found" }, { status: 404 });

    const slug = restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const format = new URL(req.url).searchParams.get("format");

    if (format === "csv") {
      // CSV flattens to the bulky part — the stamp history — which is what an
      // accountant or the employee themselves most often needs as a sheet.
      const csv = toCsv(
        ["Anställd", "Tidpunkt", "Riktning", "Metod"],
        restaurant.clockEvents.map((e) => [
          e.user.displayName,
          e.timestamp.toISOString(),
          e.direction,
          e.verificationMethod,
        ]),
      );
      return new Response("﻿" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug}-stamplingar.csv"`,
        },
      });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      restaurant: { name: restaurant.name },
      employees: restaurant.memberships.map((m) => ({
        displayName: m.user.displayName,
        role: m.role,
        localLabel: m.localLabel,
        phone: m.user.normalizedPhone,
        email: m.user.normalizedEmail,
        joinedAt: m.createdAt.toISOString(),
      })),
      shifts: restaurant.shifts.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        status: s.status,
        note: s.note,
        assignedTo: s.assignments.map((a) => a.user.displayName).join(", ") || null,
        requiredTags: s.requiredTags.map((t) => t.name),
      })),
      clockEvents: restaurant.clockEvents.map((e) => ({
        displayName: e.user.displayName,
        timestamp: e.timestamp.toISOString(),
        direction: e.direction,
        method: e.verificationMethod,
      })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-data.json"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
