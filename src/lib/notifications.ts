import { prisma } from "./prisma";

/** A user's own notification feed (§6.1), newest first, plus the unread
 *  count for a nav badge. Shared by the page (initial render) and the API
 *  route (client refresh/poll) so both agree on shape. */
export async function listNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, status: "UNREAD" } }),
  ]);
  return { notifications, unreadCount };
}

/** Just the unread count — for the nav-badge poll, which runs every 20s per
 *  signed-in client and doesn't need the 50-row feed payload. */
export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, status: "UNREAD" } });
}
