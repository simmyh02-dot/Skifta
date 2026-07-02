import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { JoinForm } from "@/components/invite/JoinForm";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
          <JoinForm token={token} />
        </div>
      </main>
    </div>
  );
}
