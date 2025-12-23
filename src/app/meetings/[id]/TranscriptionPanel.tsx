"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  meetingId: string;
  canManage: boolean;
  initialRoundId?: string | null;
};

export function TranscriptionPanel({ meetingId, canManage, initialRoundId }: Props) {
  const [roundId, setRoundId] = useState(initialRoundId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [autoAttempted, setAutoAttempted] = useState(false);

  const handleFetch = useCallback(async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    const autoParam = roundId ? "" : "?auto=1";
    const response = await fetch(`/api/meetings/${meetingId}/transcription${autoParam}`, {
      method: "GET"
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Unable to fetch transcription");
      return;
    }

    if (payload?.roundId && !roundId) {
      setRoundId(payload.roundId);
      setMessage("Transcription linked automatically.");
    }
    setData(payload.transcription ?? payload);
  }, [meetingId, roundId]);

  useEffect(() => {
    if (autoAttempted || loading || data) return;
    setAutoAttempted(true);
    handleFetch();
  }, [autoAttempted, loading, data, handleFetch]);

  return (
    <div className="dr-card mt-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Transcription</h3>
          <p className="text-sm text-slate-500">Loaded from the selected transcription service.</p>
        </div>
        <button
          type="button"
          onClick={handleFetch}
          className="dr-button-outline px-4 py-2 text-sm"
          disabled={loading}
        >
          {loading ? "Loading..." : "Load transcription"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {data ? (
        <TranscriptionView data={data} />
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {roundId ? "No transcription loaded yet." : canManage ? "Click load to auto-detect the round ID." : "Transcription not linked yet."}
        </p>
      )}
    </div>
  );
}

function TranscriptionView({ data }: { data: any }) {
  const contributions = Array.isArray(data?.contributions) ? data.contributions : [];
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  const nameById = new Map<string, string>();

  for (const participant of participants) {
    if (participant?.identifier && participant?.name) {
      nameById.set(participant.identifier, participant.name);
    }
  }

  if (contributions.length === 0) {
    return (
      <pre className="mt-4 max-h-96 overflow-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  return (
    <div className="mt-4 space-y-3 text-sm text-slate-800">
      {contributions.map((contribution: any) => {
        const speakerId = contribution?.madeBy ?? "speaker";
        const speakerName = nameById.get(speakerId) ?? speakerId;
        return (
          <div key={contribution?.identifier ?? speakerId} className="rounded border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{speakerName}</p>
            <p className="mt-1 text-slate-800">{contribution?.text ?? ""}</p>
          </div>
        );
      })}
    </div>
  );
}
