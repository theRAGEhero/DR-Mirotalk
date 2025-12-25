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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--card)] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:rounded-full">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            MiroTalk Manager
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/meetings/new" className="hover:text-slate-900">
              New meeting
            </Link>
            <Link href="/dataspace" className="hover:text-slate-900">
              Dataspace
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/plans" className="hover:text-slate-900">
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
            {session.user.role === "ADMIN" ? (
              <Link href="/admin/global-dashboard" className="hover:text-slate-900">
                Global dashboard
              </Link>
            ) : null}
            {session.user.role === "ADMIN" ? (
              <Link href="/admin" className="hover:text-slate-900">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex flex-col items-start gap-1 text-xs text-slate-500 lg:items-end">
          <span className="break-all">{session.user.email}</span>
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
              Profile settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
