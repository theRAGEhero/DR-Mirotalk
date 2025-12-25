"use client";

import { useState } from "react";

type UserOption = {
  id: string;
  email: string;
};

type DataspaceOption = {
  id: string;
  name: string;
};

type Props = {
  users: UserOption[];
  dataspaces: DataspaceOption[];
};

export function PlanBuilderClient({ users, dataspaces }: Props) {
  const [title, setTitle] = useState("1v1 Rotation");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [roundDurationMinutes, setRoundDurationMinutes] = useState(10);
  const [roundsCount, setRoundsCount] = useState(6);
  const [syncMode, setSyncMode] = useState<"SERVER" | "CLIENT">("SERVER");
  const [maxParticipantsPerRoom, setMaxParticipantsPerRoom] = useState(2);
  const [dataspaceId, setDataspaceId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  function toggleUser(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!startDate || !startTime) {
      setLoading(false);
      setError("Select both date and time.");
      return;
    }

    const startAt = `${startDate}T${startTime}`;

    const response = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        startAt,
        roundDurationMinutes,
        roundsCount,
        participantIds: selected,
        syncMode,
        maxParticipantsPerRoom,
        dataspaceId: dataspaceId || null
      })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      const message = payload?.error?.formErrors?.[0] ?? payload?.error ?? "Unable to create plan";
      setError(message);
      return;
    }

    setPlanId(payload.id);
  }

  return (
    <div className="dr-card p-6">
      <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
        Plan Builder
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Create a rotation plan and share the participant link.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Plan title</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Minutes per round</label>
            <input
              type="number"
              min={1}
              max={240}
              value={roundDurationMinutes}
              onChange={(event) => setRoundDurationMinutes(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rounds</label>
            <input
              type="number"
              min={1}
              max={100}
              value={roundsCount}
              onChange={(event) => setRoundsCount(Number(event.target.value))}
              className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Max participants per room</label>
          <select
            value={maxParticipantsPerRoom}
            onChange={(event) => setMaxParticipantsPerRoom(Number(event.target.value))}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          >
            {Array.from({ length: 11 }, (_, index) => {
              const value = index + 2;
              return (
                <option key={value} value={value}>
                  {value}
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Dataspace (optional)</label>
          <select
            value={dataspaceId}
            onChange={(event) => setDataspaceId(event.target.value)}
            className="dr-input mt-1 w-full rounded px-3 py-2 text-sm"
          >
            <option value="">No dataspace</option>
            {dataspaces.map((dataspace) => (
              <option key={dataspace.id} value={dataspace.id}>
                {dataspace.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium">Switching mode</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="syncMode"
                value="SERVER"
                checked={syncMode === "SERVER"}
                onChange={() => setSyncMode("SERVER")}
              />
              Server-driven (recommended)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="syncMode"
                value="CLIENT"
                checked={syncMode === "CLIENT"}
                onChange={() => setSyncMode("CLIENT")}
              />
              Client-driven
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Participants</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selected.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                  className="h-4 w-4"
                />
                {user.email}
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={loading}>
          {loading ? "Creating..." : "Create plan"}
        </button>

        {planId ? (
          <div className="mt-4 rounded border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
            Plan created. Share this link with participants:
            <div className="mt-2 font-semibold">/plans/{planId}</div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
