import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminHomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const [usersCount, meetingsCount] = await Promise.all([
    prisma.user.count(),
    prisma.meeting.count()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Admin
        </h1>
        <p className="text-sm text-slate-600">Quick overview and shortcuts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{usersCount}</p>
          <Link href="/admin/users" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
            Manage users
          </Link>
        </div>
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase text-slate-500">Meetings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{meetingsCount}</p>
          <Link
            href="/admin/global-dashboard"
            className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline"
          >
            View global dashboard
          </Link>
        </div>
      </div>

      <div className="dr-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Admin shortcuts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link href="/admin/users" className="dr-button-outline px-4 py-2 text-sm text-center">
            Users
          </Link>
          <Link href="/admin/global-dashboard" className="dr-button-outline px-4 py-2 text-sm text-center">
            Global dashboard
          </Link>
          <Link href="/plans/new" className="dr-button-outline px-4 py-2 text-sm text-center">
            Create plan
          </Link>
          <Link href="/experiments/round-switch" className="dr-button-outline px-4 py-2 text-sm text-center">
            Round switch experiment
          </Link>
        </div>
      </div>
    </div>
  );
}
