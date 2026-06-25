import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

// Edge gate for the authenticated app (Next 16 "proxy" convention, formerly
// middleware). This is a cheap presence/validity check only; the real
// tier/role authorization happens server-side in the route guard (§12.2).
// Unauthenticated users are bounced to /login with a `next` param.

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
