"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  createdAtLabel: string;
};

type Props = {
  initialUsers: UserRow[];
};

export function UsersTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(userId: string) {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;

    setMessage(null);
    setError(null);
    setDeletingId(userId);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE"
    });

    const data = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      setError(data?.error ?? "Unable to delete user");
      return;
    }

    setUsers((prev) => prev.filter((user) => user.id !== userId));
    setMessage("User deleted");
  }

  return (
    <div className="dr-card">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-6 gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span className="col-span-2">Email</span>
            <span>Role</span>
            <span>Must change</span>
            <span>Created</span>
            <span></span>
          </div>
          <div className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No users yet.</div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="grid grid-cols-6 gap-4 px-4 py-3 text-sm">
                  <div className="col-span-2 text-slate-900">{user.email}</div>
                  <div className="text-slate-700">{user.role}</div>
                  <div className="text-slate-500">{user.mustChangePassword ? "Yes" : "No"}</div>
                  <div className="text-slate-500">{user.createdAtLabel}</div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                      disabled={deletingId === user.id}
                    >
                      {deletingId === user.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {message ? <p className="px-4 py-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
