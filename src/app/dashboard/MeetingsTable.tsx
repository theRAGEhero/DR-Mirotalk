"use client";

import Link from "next/link";
import { useState } from "react";

type MeetingRow = {
  id: string;
  title: string;
  statusLabel: string;
  expiresLabel: string;
  language: string;
  providerLabel: string;
  dataspaceLabel: string;
  dataspaceKey: string;
  createdByEmail?: string;
  canDelete: boolean;
};

type Props = {
  initialMeetings: MeetingRow[];
  dataspaceOptions: Array<{ key: string; label: string }>;
  showCreatedBy?: boolean;
};

export function MeetingsTable({ initialMeetings, dataspaceOptions, showCreatedBy = false }: Props) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(initialMeetings);
  const [dataspaceFilter, setDataspaceFilter] = useState("all");

  function applyFilters(nextQuery = query, nextDataspace = dataspaceFilter) {
    const term = nextQuery.trim().toLowerCase();
    setFiltered(
      meetings.filter((meeting) => {
        if (nextDataspace !== "all" && meeting.dataspaceKey !== nextDataspace) {
          return false;
        }
        if (!term) {
          return true;
        }
        const haystack = [
          meeting.title,
          meeting.statusLabel,
          meeting.expiresLabel,
          meeting.language,
          meeting.providerLabel,
          meeting.dataspaceLabel,
          meeting.createdByEmail ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
    );
  }

  function handleClear() {
    setQuery("");
    setDataspaceFilter("all");
    setFiltered(meetings);
  }

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

    const nextMeetings = meetings.filter((meeting) => meeting.id !== meetingId);
    setMeetings(nextMeetings);
    setFiltered(nextMeetings);
  }

  const availableDataspaces = dataspaceOptions.filter((option) => option.key !== "none");

  return (
    <div className="dr-card">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search meetings..."
            className="dr-input w-full rounded px-3 py-2 text-sm"
          />
          <select
            value={dataspaceFilter}
            onChange={(event) => {
              const value = event.target.value;
              setDataspaceFilter(value);
              applyFilters(query, value);
            }}
            className="dr-input w-full rounded px-3 py-2 text-sm sm:w-52"
          >
            <option value="all">All dataspaces</option>
            <option value="none">No dataspace</option>
            {availableDataspaces.map((option) =>
              option.key !== "none" ? (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ) : null
            )}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyFilters()}
              className="dr-button px-3 py-2 text-sm"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="dr-button-outline px-3 py-2 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
          <div className={`${showCreatedBy ? "min-w-[920px]" : "min-w-[820px]"}`}>
          <div
            className={`grid ${showCreatedBy ? "grid-cols-8" : "grid-cols-7"} gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500`}
          >
            <span className="col-span-2">Title</span>
            <span>Status</span>
            <span>Expires</span>
            <span>Language</span>
            <span>Transcriber</span>
            <span>Dataspace</span>
            <span></span>
            {showCreatedBy ? <span>Created by</span> : null}
          </div>
          <div className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">No meetings yet.</div>
            ) : (
              filtered.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`grid ${showCreatedBy ? "grid-cols-8" : "grid-cols-7"} gap-4 px-4 py-4 text-sm`}
                >
                  <div className="col-span-2">
                    <p className="font-medium text-slate-900">{meeting.title}</p>
                  </div>
                  <div className={meeting.statusLabel === "Active" ? "text-emerald-600" : "text-slate-400"}>
                    {meeting.statusLabel}
                  </div>
                  <div className="text-slate-500">{meeting.expiresLabel}</div>
                  <div className="text-slate-700">{meeting.language}</div>
                  <div className="text-slate-700">{meeting.providerLabel}</div>
                  <div className="text-slate-600">{meeting.dataspaceLabel}</div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        View
                      </Link>
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
                  {showCreatedBy ? (
                    <div className="text-slate-600">{meeting.createdByEmail ?? "-"}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {error ? <p className="px-4 py-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
