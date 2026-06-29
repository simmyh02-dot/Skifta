import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listNotifications } from "@/lib/notifications";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { notifications } = await listNotifications(session.userId);

  return <NotificationsView initialNotifications={JSON.parse(JSON.stringify(notifications))} />;
}
