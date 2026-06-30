import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { listNotifications } from "@/lib/notifications";
import { NotificationsView } from "@/components/notifications/NotificationsView";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  if (!ctx) redirect("/app");

  const [{ notifications }, restaurant, user] = await Promise.all([
    listNotifications(session.userId),
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { displayName: true },
    }),
  ]);

  return (
    <NotificationsView
      initialNotifications={JSON.parse(JSON.stringify(notifications))}
      role={ctx.role}
      restaurantName={restaurant?.name ?? ""}
      displayName={user?.displayName ?? ""}
    />
  );
}
