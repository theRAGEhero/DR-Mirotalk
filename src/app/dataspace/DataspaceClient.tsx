"use client";

import Link from "next/link";
import { useState } from "react";

type Member = {
  id: string;
  email: string;
};

type Dataspace = {
  id: string;
  name: string;
  description: string | null;
  createdByEmail: string;
  members: Member[];
  isPrivate: boolean;
  meetingsCount: number;
};

type Props = {
  initialDataspaces: Dataspace[];
  currentUserId: string;
  personalDataspace: Dataspace;
};

export function DataspaceClient({ initialDataspaces, currentUserId, personalDataspace }: Props) {
  const [dataspaces, setDataspaces] = useState(initialDataspaces);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/dataspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description })
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to create dataspace";
      setError(message);
      return;
    }

    const newSpace: Dataspace = {
      id: payload.id,
      name,
      description: description || null,
      createdByEmail: "You",
      members: [],
      isPrivate: false
    };

    setDataspaces((prev) => [newSpace, ...prev]);
    setName("");
    setDescription("");
  }

  async function handleJoin(id: string) {
    setError(null);
    const response = await fetch(`/api/dataspaces/${id}/join`, { method: "POST" });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to join dataspace";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id
          ? {
              ...space,
              members: space.members.some((member) => member.id === currentUserId)
                ? space.members
                : [...space.members, { id: currentUserId, email: "You" }]
            }
          : space
      )
    );
  }

  async function handleLeave(id: string) {
    setError(null);
    const response = await fetch(`/api/dataspaces/${id}/leave`, { method: "POST" });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to leave dataspace";
      setError(message);
      return;
    }

    setDataspaces((prev) =>
      prev.map((space) =>
        space.id === id
          ? {
              ...space,
              members: space.members.filter((member) => member.id !== currentUserId)
            }
          : space
      )
    );
  }

  async function handleShare() {
    setError(null);
    setSharing(true);
    const response = await fetch(`/api/dataspaces/${personalDataspace.id}/share`, {
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setSharing(false);

    if (!response.ok) {
      const message = payload?.error ?? "Unable to share dataspace";
      setError(message);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="dr-card p-6">
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Create dataspace
        </h2>
        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
            {loading ? "Creating..." : "Create dataspace"}
          </button>
        </form>
      </div>

      <div className="dr-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
              My Data Space
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Private by default. You can share it when you are ready.
            </p>
          </div>
          {personalDataspace.isPrivate ? (
            <button
              type="button"
              onClick={handleShare}
              className="dr-button-outline px-4 py-2 text-sm"
              disabled={sharing}
            >
              {sharing ? "Sharing..." : "Share dataspace"}
            </button>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Shared
            </span>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                <Link href={`/dataspace/${personalDataspace.id}`} className="hover:underline">
                  {personalDataspace.name}
                </Link>
              </h3>
              <p className="text-sm text-slate-600">
                {personalDataspace.description || "No description"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Created by {personalDataspace.createdByEmail}
              </p>
            </div>
            <span className="text-xs font-semibold uppercase text-slate-500">
              {personalDataspace.isPrivate ? "Private" : "Shared"}
            </span>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase text-slate-500">
            Meetings: {personalDataspace.meetingsCount}
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Members</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
              {personalDataspace.members.length === 0 ? (
                <span className="text-slate-500">No members yet.</span>
              ) : (
                personalDataspace.members.map((member) => (
                  <span key={member.id} className="rounded-full bg-white px-3 py-1">
                    {member.email}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dr-card p-6">
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Shared dataspaces
        </h2>
        <p className="mt-2 text-sm text-slate-600">Join an existing dataspace.</p>

        <div className="mt-4 space-y-4">
          {dataspaces.length === 0 ? (
            <p className="text-sm text-slate-500">No dataspaces yet.</p>
          ) : (
            dataspaces.map((space) => {
              const isMember = space.members.some((member) => member.id === currentUserId);
              return (
                <div key={space.id} className="rounded-lg border border-slate-200 bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      <Link href={`/dataspace/${space.id}`} className="hover:underline">
                        {space.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-600">{space.description || "No description"}</p>
                    <p className="mt-1 text-xs text-slate-500">Created by {space.createdByEmail}</p>
                    <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                      Meetings: {space.meetingsCount}
                    </p>
                  </div>
                  {isMember ? (
                    <button
                        type="button"
                        onClick={() => handleLeave(space.id)}
                        className="dr-button-outline px-4 py-2 text-sm"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoin(space.id)}
                        className="dr-button-outline px-4 py-2 text-sm"
                      >
                        Join
                      </button>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Members</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
                      {space.members.length === 0 ? (
                        <span className="text-slate-500">No members yet.</span>
                      ) : (
                        space.members.map((member) => (
                          <span key={member.id} className="rounded-full bg-white px-3 py-1">
                            {member.email}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
