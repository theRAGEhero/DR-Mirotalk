"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TranscriptLine = {
  id: string;
  time?: number;
  text: string;
  speaker?: number | string;
};

type Props = {
  roomId: string;
};

function formatTimestamp(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function LiveTranscriptPanel({ roomId }: Props) {
  const [status, setStatus] = useState<"idle" | "waiting" | "connecting" | "live" | "error">(
    "idle"
  );
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const headerLabel = useMemo(() => {
    if (status === "live") return "Live";
    if (status === "connecting") return "Connecting";
    if (status === "waiting") return "Waiting";
    if (status === "error") return "Error";
    return "Idle";
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    async function fetchFileName(): Promise<string | null> {
      setStatus((prev) => (prev === "idle" ? "waiting" : prev));
      const response = await fetch(`/api/live-bridge/file-name?roomId=${encodeURIComponent(roomId)}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Live bridge unavailable");
      }
      const payload = await response.json().catch(() => null);
      if (!payload?.wsUrl) return null;
      return payload.wsUrl as string;
    }

    async function connect() {
      if (wsRef.current) return;
      try {
        const wsUrl = await fetchFileName();
        if (!wsUrl) {
          if (!pollingRef.current) {
            pollingRef.current = setInterval(() => {
              if (cancelled) return;
              connect().catch(() => null);
            }, 4000);
          }
          return;
        }
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        if (cancelled) return;
        setStatus("connecting");
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (cancelled) return;
          setStatus("live");
          setError(null);
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload?.transcript || !payload?.is_final) return;
            const speaker = payload?.words?.[0]?.speaker;
            const time = payload?.words?.[0]?.start;
            setLines((prev) => {
              const next = [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  text: payload.transcript as string,
                  speaker,
                  time
                }
              ];
              return next.slice(-80);
            });
          } catch (parseError) {
            // ignore parse errors
          }
        };
        socket.onerror = () => {
          if (cancelled) return;
          setStatus("error");
          setError("Live stream disconnected.");
        };
        socket.onclose = () => {
          if (cancelled) return;
          wsRef.current = null;
          setStatus("waiting");
          if (!pollingRef.current) {
            pollingRef.current = setInterval(() => {
              if (cancelled) return;
              connect().catch(() => null);
            }, 5000);
          }
        };
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Live bridge unavailable");
      }
    }

    connect().catch(() => null);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId]);

  return (
    <aside className="dr-card h-[360px] w-full overflow-hidden p-4 sm:h-[520px] lg:w-[260px] lg:self-stretch">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Deepgram Live</p>
          <p className="text-sm font-semibold text-slate-900">Live transcript</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            status === "live"
              ? "bg-emerald-100 text-emerald-700"
              : status === "error"
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {headerLabel}
        </span>
      </div>
      <div className="mt-3 h-full overflow-y-auto pr-2 text-xs text-slate-600">
        {lines.length === 0 ? (
          <div className="space-y-3 text-sm text-slate-500">
            <p>Waiting for live transcription to start.</p>
            <p>Start recording to stream text here.</p>
            {error ? <p className="text-rose-600">{error}</p> : null}
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="border-b border-slate-100 py-2 last:border-b-0">
              <p className="text-[11px] font-semibold text-slate-400">
                {line.time !== undefined ? formatTimestamp(line.time) : "--:--"}
                {line.speaker !== undefined ? ` · Speaker ${line.speaker}` : ""}
              </p>
              <p className="mt-1 text-sm text-slate-700">{line.text}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
