"use client";

import { useEffect, useMemo, useState } from "react";

type Pair = {
  a: string;
  b: string | null;
  roomId: string;
};

type RoundPlan = {
  round: number;
  pairs: Pair[];
};

type Props = {
  baseUrl: string;
  defaultDurationMinutes: number;
  initialParticipants?: string[];
};

function randomRoomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes));
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makePairs(participants: string[]) {
  const list = [...participants];
  if (list.length % 2 === 1) list.push("(break)");

  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < list.length; i += 2) {
    pairs.push([list[i], list[i + 1]]);
  }
  return pairs;
}

function rotate(participants: string[]) {
  if (participants.length <= 2) return participants;
  const [first, ...rest] = participants;
  const last = rest.pop();
  if (!last) return participants;
  return [first, last, ...rest];
}

function buildPlan(participants: string[], rounds: number) {
  const clean = participants.filter(Boolean);
  const plan: RoundPlan[] = [];
  let current = [...clean];

  for (let i = 0; i < rounds; i += 1) {
    const pairs = makePairs(current).map(([a, b]) => ({
      a,
      b: b === "(break)" ? null : b,
      roomId: randomRoomId()
    }));
    plan.push({ round: i + 1, pairs });
    current = rotate(current);
  }

  return plan;
}

export function RoundSwitchClient({ baseUrl, defaultDurationMinutes, initialParticipants }: Props) {
  const [rawParticipants, setRawParticipants] = useState(
    initialParticipants && initialParticipants.length > 0
      ? initialParticipants.join("\n")
      : "Alice\nBob\nCarla\nDiego\nElisa\nFabio\nGiulia\nHana\nIvan\nLuca"
  );
  const [rounds, setRounds] = useState(6);
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [plan, setPlan] = useState<RoundPlan[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);

  const participants = useMemo(
    () => rawParticipants.split("\n").map((name) => name.trim()).filter(Boolean),
    [rawParticipants]
  );

  useEffect(() => {
    setSecondsLeft(duration * 60);
  }, [duration]);

  useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, secondsLeft]);

  function handleGenerate() {
    const nextPlan = buildPlan(participants, rounds);
    setPlan(nextPlan);
    setCurrentRound(1);
    setSecondsLeft(duration * 60);
    setIsRunning(false);
  }

  function handleNextRound() {
    setCurrentRound((value) => Math.min(rounds, value + 1));
    setSecondsLeft(duration * 60);
  }

  function handlePrevRound() {
    setCurrentRound((value) => Math.max(1, value - 1));
    setSecondsLeft(duration * 60);
  }

  const roundPlan = plan.find((round) => round.round === currentRound);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = `${secondsLeft % 60}`.padStart(2, "0");

  return (
    <div className="space-y-6">
      <div className="dr-card p-6">
        <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Round Switch Planner
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Generate 1v1 rounds, then switch room links every X minutes.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[2fr,1fr,1fr]">
          <div>
            <label className="text-sm font-medium">Participants (one per line)</label>
            <textarea
              value={rawParticipants}
              onChange={(event) => setRawParticipants(event.target.value)}
              rows={6}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rounds</label>
            <input
              type="number"
              min={1}
              value={rounds}
              onChange={(event) => setRounds(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Minutes per round</label>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button type="button" onClick={handleGenerate} className="dr-button mt-4 px-4 py-2 text-sm">
          Generate plan
        </button>
      </div>

      <div className="dr-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Current round</p>
            <p className="text-2xl font-semibold">Round {currentRound}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase text-slate-500">Countdown</p>
            <p className="text-2xl font-semibold">
              {minutes}:{seconds}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handlePrevRound} className="dr-button-outline px-4 py-2 text-sm">
              Prev
            </button>
            <button
              type="button"
              onClick={() => setIsRunning((value) => !value)}
              className="dr-button px-4 py-2 text-sm"
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button type="button" onClick={handleNextRound} className="dr-button-outline px-4 py-2 text-sm">
              Next
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {roundPlan ? (
            roundPlan.pairs.map((pair, index) => (
              <div key={`${pair.roomId}-${index}`} className="rounded-lg border border-slate-200 bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {pair.a} {pair.b ? `× ${pair.b}` : "(break)"}
                    </p>
                    <p className="text-xs text-slate-500">Room {pair.roomId}</p>
                  </div>
                  {pair.b ? (
                    <a
                      href={`${baseUrl}/join/${pair.roomId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dr-button px-4 py-2 text-sm"
                    >
                      Open room
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Generate a plan to see rooms.</p>
          )}
        </div>
      </div>

      {plan.length > 0 ? (
        <div className="dr-card p-6">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            Full schedule
          </h3>
          <div className="mt-4 space-y-4">
            {plan.map((round) => (
              <div key={round.round} className="rounded-lg border border-slate-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Round {round.round}</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  {round.pairs.map((pair, index) => (
                    <div key={`${pair.roomId}-${index}`}>
                      {pair.a} {pair.b ? `× ${pair.b}` : "(break)"} — {pair.roomId}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
