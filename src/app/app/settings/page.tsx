import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "@/components/app/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  if (!ctx || !can(ctx, "members:manage")) redirect("/app");

  const [restaurant, user] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { name: true, openShiftFill: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true },
    }),
  ]);
  if (!restaurant) redirect("/app");

  return (
    <SettingsView
      role={ctx.role}
      restaurantName={restaurant.name}
      displayName={user?.displayName ?? ""}
      openShiftFill={restaurant.openShiftFill}
    />
  );
}
