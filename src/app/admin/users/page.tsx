import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/app/admin/users/CreateUserForm";
import { UsersTable } from "@/app/admin/users/UsersTable";
import { formatDateTime } from "@/lib/utils";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  });

  const rows = users.map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    createdAtLabel: formatDateTime(user.createdAt)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Users
        </h1>
        <p className="text-sm text-slate-500">Manage platform users.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <UsersTable initialUsers={rows} />

        <div className="dr-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Create user</h2>
          <p className="text-sm text-slate-500">Invite a new account.</p>
          <div className="mt-4">
            <CreateUserForm />
          </div>
        </div>
      </div>
    </div>
  );
}
