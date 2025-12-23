"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewMeetingForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [hasExpiry, setHasExpiry] = useState(true);
  const [expiresInHours, setExpiresInHours] = useState(4);
  const [language, setLanguage] = useState("EN");
  const [provider, setProvider] = useState("DEEPGRAM");
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
        hasExpiry,
        expiresInHours: hasExpiry ? expiresInHours : undefined,
        language,
        transcriptionProvider: provider
      })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data?.error?.formErrors?.[0] ?? "Unable to create meeting");
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

      <div className="flex items-center gap-3">
        <input
          id="hasExpiry"
          type="checkbox"
          checked={hasExpiry}
          onChange={(event) => setHasExpiry(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <label htmlFor="hasExpiry" className="text-sm text-slate-700">
          Scade tra X ore
        </label>
      </div>

      {hasExpiry ? (
        <div>
          <label className="text-sm font-medium">Ore</label>
          <input
            type="number"
            min={1}
            max={168}
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(Number(event.target.value))}
            className="dr-input mt-1 w-32 rounded px-3 py-2 text-sm"
          />
        </div>
      ) : null}

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
