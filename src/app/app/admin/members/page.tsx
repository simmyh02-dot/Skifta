import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MembersAdminView } from "@/components/admin/MembersAdminView";

export const dynamic = "force-dynamic";

export default async function MembersAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(
    session.userId,
    session.activeRestaurantId,
  );
  if (!ctx || !can(ctx, "members:manage")) redirect("/app");

  const invites = await prisma.invite.findMany({
    where: { restaurantId: session.activeRestaurantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <MembersAdminView
      initialInvites={invites.map((i) => ({
        id: i.id,
        name: i.name,
        normalizedContact: i.normalizedContact,
        role: i.role,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
      }))}
    />
  );
}
