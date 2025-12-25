"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  dataspaceId: string;
  isMember: boolean;
  isAdmin: boolean;
  isPrivate: boolean;
  isOwner: boolean;
};

export function DataspaceJoinLeave({
  dataspaceId,
  isMember,
  isAdmin,
  isPrivate,
  isOwner
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/dataspaces/${dataspaceId}/${isMember ? "leave" : "join"}`,
        { method: "POST" }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update dataspace membership");
      } else {
        router.refresh();
      }
    } catch (error) {
      setError("Unable to update dataspace membership");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/dataspaces/${dataspaceId}/share`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Unable to share dataspace");
      } else {
        router.refresh();
      }
    } catch (error) {
      setError("Unable to share dataspace");
    } finally {
      setLoading(false);
    }
  }

  if (isAdmin) {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Admin access
      </span>
    );
  }

  if (isPrivate && isOwner) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="dr-button-outline px-4 py-2 text-sm"
          disabled={loading}
        >
          {loading ? "Sharing..." : "Share dataspace"}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleAction}
        className="dr-button-outline px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? "Updating..." : isMember ? "Leave dataspace" : "Join dataspace"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
