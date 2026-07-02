import { listNotifications, unreadNotificationCount } from "@/lib/notifications";
import { requireUser, errorResponse } from "@/lib/guard";

// GET → the signed-in user's own notification feed (§6.1), newest first.
// `?count=1` returns only the unread count — the nav-badge poll doesn't need
// the 50-row feed payload. No permission gate beyond "is this me" — everyone
// sees their own feed, same access level as `clock:viewOwn`'s "own data only"
// pattern.
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    if (new URL(req.url).searchParams.has("count")) {
      return Response.json({ unreadCount: await unreadNotificationCount(userId) });
    }
    const data = await listNotifications(userId);
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
