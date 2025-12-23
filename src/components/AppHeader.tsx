import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export async function AppHeader() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return (
    <header className="sticky top-4 z-20">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-[color:var(--stroke)] bg-[color:var(--card)] px-5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            MiroTalk Manager
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/meetings/new" className="hover:text-slate-900">
              New meeting
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/plans/new" className="hover:text-slate-900">
                Plans
              </Link>
            ) : null}
            <Link href="/experiments/round-switch" className="hover:text-slate-900">
              Round switch
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/admin/users" className="hover:text-slate-900">
                Users
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">{session.user.email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
