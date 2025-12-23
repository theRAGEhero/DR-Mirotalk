"use client";

import { useEffect, useMemo, useState } from "react";

type RoundAssignment = {
  roundNumber: number;
  roomId: string;
  partnerLabel: string;
  isBreak: boolean;
};

type Props = {
  planId: string;
  startAt: string;
  roundDurationMinutes: number;
  roundsCount: number;
  assignments: RoundAssignment[];
  baseUrl: string;
  userEmail: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ParticipantViewClient({
  planId,
  startAt,
  roundDurationMinutes,
  roundsCount,
  assignments,
  baseUrl,
  userEmail
}: Props) {
  const startTime = useMemo(() => new Date(startAt).getTime(), [startAt]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const roundDurationMs = roundDurationMinutes * 60 * 1000;
  const elapsed = now - startTime;
  const currentRoundIndex = Math.floor(elapsed / roundDurationMs) + 1;

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && currentRoundIndex <= roundsCount) {
    status = "active";
  } else if (currentRoundIndex > roundsCount) {
    status = "done";
  }

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), roundsCount);
  const roundStart = startTime + (currentRound - 1) * roundDurationMs;
  const roundEnd = roundStart + roundDurationMs;
  const secondsLeft = Math.max(0, Math.floor((roundEnd - now) / 1000));

  const assignment = assignments.find((item) => item.roundNumber === currentRound);
  const joinUrl = assignment && !assignment.isBreak
    ? `${baseUrl}/join/${assignment.roomId}?name=${encodeURIComponent(userEmail)}&notify=0`
    : "";

  return (
    <div className="dr-card p-6">
      <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
        Your call link
      </h2>
      <p className="mt-2 text-sm text-slate-600">Plan: {planId}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Phase</p>
          <p className="text-lg font-semibold">
            {status === "pending" && "Not started"}
            {status === "active" && `Round ${currentRound} of ${roundsCount}`}
            {status === "done" && "Finished"}
          </p>
          {status === "pending" ? (
            <p className="text-sm text-slate-600">
              Starts in {formatDuration(Math.max(0, Math.floor((startTime - now) / 1000)))}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Countdown</p>
          <p className="text-lg font-semibold">
            {status === "active" ? formatDuration(secondsLeft) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Partner</p>
          <p className="text-lg font-semibold">
            {assignment ? assignment.partnerLabel : "-"}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {status === "active" && assignment && !assignment.isBreak ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dr-button inline-flex px-4 py-2 text-sm"
          >
            Join current room
          </a>
        ) : assignment?.isBreak ? (
          <p className="text-sm text-slate-600">This round is a break for you.</p>
        ) : (
          <p className="text-sm text-slate-600">Waiting for the plan to start.</p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Your schedule</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {assignments.map((item) => (
            <div key={item.roundNumber} className="rounded border border-slate-200 bg-white/70 px-3 py-2">
              Round {item.roundNumber}: {item.partnerLabel}{" "}
              {item.isBreak ? "(break)" : `— ${item.roomId}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
