"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logClientError } from "@/lib/clientLog";

type DataspaceOption = {
  id: string;
  name: string;
};

type InitialMeeting = {
  id: string;
  title: string;
  description: string | null;
  scheduledStartAt: string | null;
  expiresAt: string | null;
  language: string;
  transcriptionProvider: string;
  dataspaceId: string | null;
  isPublic: boolean;
  requiresApproval: boolean;
  capacity: number | null;
};

type Props = {
  dataspaces: DataspaceOption[];
  mode?: "create" | "edit";
  initialMeeting?: InitialMeeting | null;
};

function normalizeFormError(payload: any, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  const formError = payload?.error?.formErrors?.[0];
  if (typeof formError === "string") return formError;
  const fieldErrors = payload?.error?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const firstKey = Object.keys(fieldErrors)[0];
    const firstValue = firstKey ? fieldErrors[firstKey]?.[0] : null;
    if (typeof firstValue === "string") return firstValue;
  }
  return fallback;
}

function toLocalDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toLocalTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(11, 16);
}

export function NewMeetingForm({ dataspaces, mode = "create", initialMeeting }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [language, setLanguage] = useState("EN");
  const [provider, setProvider] = useState("DEEPGRAM");
  const [dataspaceId, setDataspaceId] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSuggestions, setInviteSuggestions] = useState<
    Array<{ id: string; email: string }>
  >([]);
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [capacity, setCapacity] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialMeeting) return;
    setTitle(initialMeeting.title);
    setDescription(initialMeeting.description ?? "");
    const scheduledDate = initialMeeting.scheduledStartAt
      ? new Date(initialMeeting.scheduledStartAt)
      : null;
    const expiresDate = initialMeeting.expiresAt ? new Date(initialMeeting.expiresAt) : null;
    if (scheduledDate) {
      setDate(toLocalDateInput(scheduledDate));
      setStartTime(toLocalTimeInput(scheduledDate));
    }
    if (scheduledDate && expiresDate) {
      const diffMs = expiresDate.getTime() - scheduledDate.getTime();
      const minutes = Math.max(15, Math.round(diffMs / 60000));
      const allowed = [15, 30, 45, 60, 90, 120, 150];
      const closest = allowed.reduce((prev, current) =>
        Math.abs(current - minutes) < Math.abs(prev - minutes) ? current : prev
      );
      setDurationMinutes(closest);
    }
    setLanguage(initialMeeting.language || "EN");
    setProvider(initialMeeting.transcriptionProvider || "DEEPGRAM");
    setDataspaceId(initialMeeting.dataspaceId ?? "");
    setIsPublic(Boolean(initialMeeting.isPublic));
    setRequiresApproval(Boolean(initialMeeting.requiresApproval));
    setCapacity(initialMeeting.capacity ?? "");
  }, [initialMeeting]);

  const inviteQuery = useMemo(() => {
    const tokens = inviteEmails.split(/[,\n]/);
    return tokens[tokens.length - 1]?.trim() ?? "";
  }, [inviteEmails]);

  const inviteExclude = useMemo(() => {
    const tokens = inviteEmails
      .split(/[,\n]/)
      .slice(0, -1)
      .map((value) => value.trim())
      .filter(Boolean);
    return tokens.join(",");
  }, [inviteEmails]);

  useEffect(() => {
    if (!inviteQuery) {
      setInviteSuggestions([]);
      setShowInviteSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/users?query=${encodeURIComponent(inviteQuery)}&exclude=${encodeURIComponent(inviteExclude)}`
        );
        if (!response.ok) {
          setInviteSuggestions([]);
          return;
        }
        const payload = await response.json();
        setInviteSuggestions(payload?.users ?? []);
        setShowInviteSuggestions(true);
      } catch (fetchError) {
        setInviteSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inviteExclude, inviteQuery]);

  function handleInviteSelect(email: string) {
    const replaced = inviteEmails.replace(/[^,\n]*$/, email);
    const next = replaced.endsWith(",") || replaced.endsWith("\n") ? replaced : `${replaced}, `;
    setInviteEmails(next);
    setInviteSuggestions([]);
    setShowInviteSuggestions(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLogId(null);
    setLoading(true);

    if (isPublic && !dataspaceId) {
      setLoading(false);
      setError("Select a dataspace for public meetings.");
      return;
    }

    const isEdit = mode === "edit" && initialMeeting?.id;
    const response = await fetch(isEdit ? `/api/meetings/${initialMeeting?.id}` : "/api/meetings", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        date: date || undefined,
        startTime: startTime || undefined,
        durationMinutes: durationMinutes || undefined,
        inviteEmails: inviteEmails
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
        language,
        transcriptionProvider: provider,
        dataspaceId: dataspaceId || null,
        isPublic,
        requiresApproval,
        capacity: capacity === "" ? null : Number(capacity)
      })
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch (jsonError) {
      data = null;
    }
    setLoading(false);

    if (!response.ok) {
      const message = normalizeFormError(data, "Unable to save meeting");
      setError(message);
      const loggedId = await logClientError("meeting.save", message, {
        status: response.status,
        payload: data,
        data: { title, date, startTime, durationMinutes }
      });
      if (loggedId) setLogId(loggedId);
      return;
    }

    router.push(`/meetings/${data.id ?? initialMeeting?.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Short description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          rows={3}
          maxLength={240}
          placeholder="Optional context for participants."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Day (optional)</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Start time (optional)</label>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Duration (optional)</label>
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          >
            <option value={15}>15m</option>
            <option value={30}>30m</option>
            <option value={45}>45m</option>
            <option value={60}>1h</option>
            <option value={90}>1h 30m</option>
            <option value={120}>2h</option>
            <option value={150}>2h 30m</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Language</label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          >
            <option value="EN">English</option>
            <option value="IT">Italian</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Transcription engine</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="provider"
                value="DEEPGRAM"
                checked={provider === "DEEPGRAM"}
                onChange={(event) => setProvider(event.target.value)}
                className="h-4 w-4"
              />
              Deepgram (fast)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="provider"
                value="VOSK"
                checked={provider === "VOSK"}
                onChange={(event) => setProvider(event.target.value)}
                className="h-4 w-4"
              />
              Vosk (slow, privacy friendly)
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Dataspace (optional)</label>
        <select
          value={dataspaceId}
          onChange={(event) => setDataspaceId(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
        >
          <option value="">No dataspace</option>
          {dataspaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4"
          />
          Public listed (visible to dataspace members)
        </label>
        {isPublic ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(event) => setRequiresApproval(event.target.checked)}
                className="h-4 w-4"
              />
              Requires approval
            </label>
            <div>
              <label className="text-sm font-medium">Capacity (optional)</label>
              <input
                type="number"
                min={2}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value === "" ? "" : Number(event.target.value))}
                className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
                placeholder="No limit"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium">Invite users (optional)</label>
        <div className="relative mt-1">
          <textarea
            value={inviteEmails}
            onChange={(event) => setInviteEmails(event.target.value)}
            className="dr-input w-full rounded px-3 py-2 text-sm"
            rows={3}
            placeholder="email1@example.com, email2@example.com"
            onFocus={() => setShowInviteSuggestions(true)}
            onBlur={() => setTimeout(() => setShowInviteSuggestions(false), 150)}
          />
          {showInviteSuggestions && inviteSuggestions.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg">
              {inviteSuggestions.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleInviteSelect(user.email)}
                  className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  {user.email}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500">Separate emails with commas or new lines.</p>
      </div>

      {error ? (
        <div className="space-y-1 text-sm">
          <p className="text-red-600">{error}</p>
          {logId ? <p className="text-xs text-slate-500">Logged as {logId}</p> : null}
        </div>
      ) : null}

      <button
        type="submit"
        className="dr-button px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? (mode === "edit" ? "Saving..." : "Creating...") : mode === "edit" ? "Save changes" : "Create meeting"}
      </button>
    </form>
  );
}
