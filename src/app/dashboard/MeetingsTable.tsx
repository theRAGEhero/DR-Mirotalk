"use client";

import Link from "next/link";
import { useState } from "react";

type MeetingRow = {
  id: string;
  title: string;
  statusLabel: string;
  expiresLabel: string;
  canDelete: boolean;
};

type Props = {
  initialMeetings: MeetingRow[];
};

export function MeetingsTable({ initialMeetings }: Props) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(meetingId: string) {
    const confirmed = window.confirm("Delete this meeting?");
    if (!confirmed) return;

    setError(null);
    setDeletingId(meetingId);

    const response = await fetch(`/api/meetings/${meetingId}`, {
      method: "DELETE"
    });

    const payload = await response.json();
    setDeletingId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete meeting");
      return;
    }

    setMeetings((prev) => prev.filter((meeting) => meeting.id !== meetingId));
  }

  return (
    <div className="dr-card">
      <div className="grid grid-cols-6 gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
        <span className="col-span-2">Title</span>
        <span>Status</span>
        <span>Expires</span>
        <span></span>
        <span></span>
      </div>
      <div className="divide-y divide-slate-200">
        {meetings.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No meetings yet.</div>
        ) : (
          meetings.map((meeting) => (
            <div key={meeting.id} className="grid grid-cols-6 gap-4 px-4 py-4 text-sm">
              <div className="col-span-2">
                <p className="font-medium text-slate-900">{meeting.title}</p>
              </div>
              <div className={meeting.statusLabel === "Active" ? "text-emerald-600" : "text-slate-400"}>
                {meeting.statusLabel}
              </div>
              <div className="text-slate-500">{meeting.expiresLabel}</div>
              <div className="text-right">
                <Link
                  href={`/meetings/${meeting.id}`}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  View
                </Link>
              </div>
              <div className="text-right">
                {meeting.canDelete ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(meeting.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                    disabled={deletingId === meeting.id}
                  >
                    {deletingId === meeting.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
