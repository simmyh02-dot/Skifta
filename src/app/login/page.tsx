import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, getSession, rememberDevice } from "@/lib/session";
import { DEVICE_COOKIE, verifyDeviceToken } from "@/lib/device-token";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

// Already have a valid session (the 30-day cookie, §12.1)? Skip straight to
// the app instead of making an already-logged-in person redo the OTP step.
// No live session but this is a remembered device (§12 decided design)? Mint
// a fresh one silently instead of showing the OTP form.
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");

  const deviceToken = (await cookies()).get(DEVICE_COOKIE)?.value;
  const device = deviceToken ? await verifyDeviceToken(deviceToken) : null;
  if (device) {
    await createSession(device);
    await rememberDevice(device);
    redirect("/app");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Skifta">
          <Logo />
        </Link>
        <LangToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-sm ring-1 ring-border">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
