import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
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
            <SignupForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
