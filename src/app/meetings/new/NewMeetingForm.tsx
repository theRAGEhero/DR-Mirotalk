"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DataspaceOption = {
  id: string;
  name: string;
};

export function NewMeetingForm({ dataspaces }: { dataspaces: DataspaceOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [language, setLanguage] = useState("EN");
  const [provider, setProvider] = useState("DEEPGRAM");
  const [dataspaceId, setDataspaceId] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date: date || undefined,
        startTime: startTime || undefined,
        durationMinutes: durationMinutes || undefined,
        inviteEmails: inviteEmails
          .split(/[,\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
        language,
        transcriptionProvider: provider,
        dataspaceId: dataspaceId || null
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
      setError(data?.error?.formErrors?.[0] ?? data?.error ?? "Unable to create meeting");
      return;
    }

    router.push(`/meetings/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

      <div>
        <label className="text-sm font-medium">Invite users (optional)</label>
        <textarea
          value={inviteEmails}
          onChange={(event) => setInviteEmails(event.target.value)}
          className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          rows={3}
          placeholder="email1@example.com, email2@example.com"
        />
        <p className="mt-1 text-xs text-slate-500">Separate emails with commas or new lines.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        className="dr-button px-4 py-2 text-sm"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create meeting"}
      </button>
    </form>
  );
}
