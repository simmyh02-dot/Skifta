import { prisma } from "@/lib/prisma";
import { requireUser, errorResponse } from "@/lib/guard";

// POST → mark one of my own notifications READ (or ACTIONED, after acting on
// it from the feed). Scoped to `userId` so nobody can mark someone else's.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userId } = await requireUser();
    const body = await req.json().catch(() => null);
    const status = body?.status === "ACTIONED" ? "ACTIONED" : "READ";

    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { status },
    });
    if (result.count === 0) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
