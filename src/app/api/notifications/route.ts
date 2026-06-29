import { listNotifications } from "@/lib/notifications";
import { requireUser, errorResponse } from "@/lib/guard";

// GET → the signed-in user's own notification feed (§6.1), newest first.
// No permission gate beyond "is this me" — everyone sees their own feed,
// same access level as `clock:viewOwn`'s "own data only" pattern.
export async function GET() {
  try {
    const { userId } = await requireUser();
    const data = await listNotifications(userId);
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
