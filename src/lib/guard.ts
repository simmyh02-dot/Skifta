import { prisma } from "./prisma";
import { getSession } from "./session";
import { can, type AccessContext, type Action } from "./authz";

// The single server-side enforcement layer (§12.2). Every protected route
// handler calls `requirePermission(...)`; authorization is never left to the
// frontend. `AuthError` carries the HTTP status so handlers can translate it
// uniformly via `errorResponse`.

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<{
  userId: string;
  activeRestaurantId?: string;
}> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "not_authenticated");
  return session;
}

/** Resolve (role, tier) for a user in a restaurant, or null if no live membership. */
export async function getAccessContext(
  userId: string,
  restaurantId: string,
): Promise<AccessContext | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    include: { restaurant: { select: { tier: true } } },
  });
  if (!membership || membership.endedAt) return null;
  return { role: membership.role, tier: membership.restaurant.tier };
}

/** Throws AuthError(401/403) unless the current user may perform `action`. */
export async function requirePermission(
  restaurantId: string,
  action: Action,
): Promise<{ userId: string; ctx: AccessContext }> {
  const { userId } = await requireUser();
  const ctx = await getAccessContext(userId, restaurantId);
  if (!ctx) throw new AuthError(403, "no_restaurant_access");
  if (!can(ctx, action)) throw new AuthError(403, "forbidden");
  return { userId, ctx };
}

/** Turn an AuthError (or anything) into a JSON Response for route handlers. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return Response.json({ error: "internal_error" }, { status: 500 });
}
