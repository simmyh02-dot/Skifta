import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySessionToken,
} from "@/lib/session-token";
import { DEVICE_COOKIE, verifyDeviceToken } from "@/lib/device-token";

// Edge gate for the authenticated app (Next 16 "proxy" convention, formerly
// middleware). This is a cheap presence/validity check only; the real
// tier/role authorization happens server-side in the route guard (§12.2).
// Unauthenticated users are bounced to /login with a `next` param — unless
// this browser is a remembered device (§12 decided design), in which case a
// fresh session is silently re-minted from the device cookie instead of
// forcing another OTP round-trip.

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const deviceToken = req.cookies.get(DEVICE_COOKIE)?.value;
    const device = deviceToken ? await verifyDeviceToken(deviceToken) : null;
    if (device) {
      // Redirect to the same URL so the new Set-Cookie is applied before the
      // page renders (a cookie set on this response isn't visible to this
      // same request's Server Components).
      const res = NextResponse.redirect(req.url);
      res.cookies.set(
        SESSION_COOKIE,
        await signSession(device),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_MAX_AGE_SECONDS,
        },
      );
      return res;
    }

    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
