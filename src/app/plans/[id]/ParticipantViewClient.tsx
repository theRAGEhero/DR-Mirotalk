"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TranscriptionPanel } from "@/app/meetings/[id]/TranscriptionPanel";
import { MeditationRoundEmbed } from "@/app/plans/[id]/MeditationRoundEmbed";
import { buildLegacySegments, buildPlanSegmentsFromBlocks, getSegmentAtTime } from "@/lib/planSchedule";
import { renderPosterHtml } from "@/lib/poster";

type RoundAssignment = {
  roundNumber: number;
  roomId: string;
  partnerLabel: string;
  isBreak: boolean;
  meetingId?: string | null;
};

type Props = {
  planId: string;
  planTitle?: string | null;
  language: string;
  transcriptionProvider: string;
  startAt: string;
  roundDurationMinutes: number;
  roundsCount: number;
  syncMode: "SERVER" | "CLIENT";
  meditationEnabled: boolean;
  meditationAtStart: boolean;
  meditationBetweenRounds: boolean;
  meditationAtEnd: boolean;
  meditationDurationMinutes: number;
  meditationAnimationId?: string | null;
  meditationAudioUrl?: string | null;
  blocks: Array<{
    id: string;
    type: "ROUND" | "MEDITATION" | "POSTER" | "TEXT";
    durationSeconds: number;
    roundNumber: number | null;
    meditationAnimationId?: string | null;
    meditationAudioUrl?: string | null;
    poster: { id: string; title: string; content: string } | null;
  }>;
  roundGroups: Array<{
    roundNumber: number;
    rooms: Array<{ roomId: string; participants: string[]; meetingId?: string | null }>;
  }>;
  assignments: RoundAssignment[];
  baseUrl: string;
  userEmail: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatCountdownHuman(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export function ParticipantViewClient({
  planId,
  planTitle,
  language,
  transcriptionProvider,
  startAt,
  roundDurationMinutes,
  roundsCount,
  syncMode,
  meditationEnabled,
  meditationAtStart,
  meditationBetweenRounds,
  meditationAtEnd,
  meditationDurationMinutes,
  meditationAnimationId,
  meditationAudioUrl,
  blocks,
  roundGroups,
  assignments,
  baseUrl,
  userEmail
}: Props) {
  const startTime = useMemo(() => new Date(startAt).getTime(), [startAt]);
  const [now, setNow] = useState<number | null>(null);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const [meetingByRound, setMeetingByRound] = useState<Record<number, string>>({});
  const [meditationSessions, setMeditationSessions] = useState<
    Array<{ id: string; meditationIndex: number; roundAfter: number | null; transcriptText: string | null; createdAt: string }>
  >([]);
  const [sendingMeditation, setSendingMeditation] = useState(false);
  const [completedMeditations, setCompletedMeditations] = useState<Set<number>>(
    () => new Set()
  );
  const [textEntry, setTextEntry] = useState("");
  const [textEntryStatus, setTextEntryStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [textBlockId, setTextBlockId] = useState<string | null>(null);
  const [completedTextEntries, setCompletedTextEntries] = useState<Record<string, string>>({});
  const [recapView, setRecapView] = useState<"personal" | "plan">("personal");
  const [planRecapTextEntries, setPlanRecapTextEntries] = useState<
    Array<{ blockId: string; content: string; userEmail: string }>
  >([]);
  const [planRecapMeditations, setPlanRecapMeditations] = useState<
    Array<{ meditationIndex: number; roundAfter: number | null; transcriptText: string; userEmail: string }>
  >([]);
  const [planRecapParticipants, setPlanRecapParticipants] = useState<string[]>([]);
  const [planRecapMeetingTranscripts, setPlanRecapMeetingTranscripts] = useState<
    Array<{ meetingId: string; roundNumber: number; participants: string[]; transcriptText: string }>
  >([]);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);
  const lastSavedTextRef = useRef<string>("");
  const [showModal, setShowModal] = useState(false);
  const [autoOpenedModal, setAutoOpenedModal] = useState(false);
  const [meditationMuted, setMeditationMuted] = useState(false);

  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks]
  );
  const roundGroupsByNumber = useMemo(
    () => new Map(roundGroups.map((round) => [round.roundNumber, round.rooms])),
    [roundGroups]
  );
  const meetingTranscriptById = useMemo(
    () => new Map(planRecapMeetingTranscripts.map((item) => [item.meetingId, item.transcriptText])),
    [planRecapMeetingTranscripts]
  );

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  useEffect(() => {
    let active = true;
    async function loadSessions() {
      const response = await fetch(`/api/plans/${planId}/meditation`);
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (!active) return;
      const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
      setMeditationSessions(sessions);
      setCompletedMeditations(
        new Set(sessions.map((session) => session.meditationIndex))
      );
    }
    loadSessions();
    return () => {
      active = false;
    };
  }, [planId]);

  useEffect(() => {
    if (syncMode !== "SERVER") return;

    let mounted = true;

    async function syncServerTime() {
      try {
        const response = await fetch(`/api/plans/${planId}/current?include_meetings=1`);
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        const serverNow = Date.parse(payload?.serverNow);
        if (Number.isNaN(serverNow)) return;
        if (mounted) {
          setOffsetMs(serverNow - Date.now());
          if (Array.isArray(payload?.currentRoundMeetings)) {
            setMeetingByRound((prev) => {
              const next = { ...prev };
              payload.currentRoundMeetings.forEach((item: { roomId: string; meetingId: string }) => {
                const assignment = assignments.find((entry) => entry.roomId === item.roomId);
                if (assignment) {
                  next[assignment.roundNumber] = item.meetingId;
                }
              });
              return next;
            });
          }
        }
      } catch (error) {
        // keep local timing if server sync fails
      }
    }

    syncServerTime();
    const timer = setInterval(syncServerTime, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [planId, syncMode]);

  const nowValue = now ?? startTime;
  const effectiveNow =
    syncMode === "SERVER" && offsetMs !== null ? nowValue + offsetMs : nowValue;
  const schedule = useMemo(
    () =>
      blocks.length > 0
        ? buildPlanSegmentsFromBlocks(new Date(startAt), blocks)
        : buildLegacySegments({
            startAt: new Date(startAt),
            roundsCount,
            roundDurationMinutes,
            meditationEnabled,
            meditationAtStart,
            meditationBetweenRounds,
            meditationAtEnd,
            meditationDurationMinutes
          }),
    [
      blocks,
      startAt,
      roundsCount,
      roundDurationMinutes,
      meditationEnabled,
      meditationAtStart,
      meditationBetweenRounds,
      meditationAtEnd,
      meditationDurationMinutes
    ]
  );

  const elapsed = effectiveNow - startTime;
  const currentSegment = getSegmentAtTime(schedule.segments, effectiveNow);
  const currentRoundIndex =
    currentSegment?.type === "ROUND"
      ? currentSegment?.roundNumber ?? 1
      : currentSegment?.roundAfter ?? 1;

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && effectiveNow < schedule.totalEndMs) {
    status = "active";
  } else if (effectiveNow >= schedule.totalEndMs) {
    status = "done";
  }

  useEffect(() => {
    if (status === "active") {
      if (!autoOpenedModal) {
        setShowModal(true);
        setAutoOpenedModal(true);
      }
      return;
    }
    if (showModal) {
      setShowModal(false);
    }
  }, [status, autoOpenedModal, showModal]);

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), roundsCount);
  const segmentStart = currentSegment?.startAtMs ?? startTime;
  const segmentEnd = currentSegment?.endAtMs ?? startTime;
  const secondsLeft = Math.max(0, Math.floor((segmentEnd - effectiveNow) / 1000));

  useEffect(() => {
    if (syncMode === "SERVER") return;
    if (status !== "active") return;

    let mounted = true;

    async function ensureMeetings() {
      try {
        const response = await fetch(`/api/plans/${planId}/current?include_meetings=1`);
        if (!response.ok) return;
        const payload = await response.json().catch(() => null);
        if (mounted && Array.isArray(payload?.currentRoundMeetings)) {
          setMeetingByRound((prev) => {
            const next = { ...prev };
            payload.currentRoundMeetings.forEach((item: { roomId: string; meetingId: string }) => {
              const assignment = assignments.find((entry) => entry.roomId === item.roomId);
              if (assignment) {
                next[assignment.roundNumber] = item.meetingId;
              }
            });
            return next;
          });
        }
      } catch (error) {
        // ignore
      }
    }

    ensureMeetings();
    const timer = setInterval(ensureMeetings, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [planId, syncMode, status, assignments]);

  const assignment = assignments.find((item) => item.roundNumber === currentRound);
  const currentMeetingId =
    assignment?.meetingId ?? (assignment ? meetingByRound[assignment.roundNumber] : undefined);
  const joinUrl = assignment && !assignment.isBreak
    ? `${baseUrl}/join/${assignment.roomId}?name=${encodeURIComponent(userEmail)}&notify=0`
    : "";

  const meditationActive = status === "active" && currentSegment?.type === "MEDITATION";
  const meditationIndex = currentSegment?.meditationIndex ?? 0;
  const roundAfter = currentSegment?.roundAfter ?? null;
  const currentBlock = currentSegment?.blockId ? blockById.get(currentSegment.blockId) : null;
  const currentMeditationAnimationId =
    currentSegment?.type === "MEDITATION"
      ? currentBlock?.meditationAnimationId ?? meditationAnimationId
      : meditationAnimationId;
  const currentMeditationAudioUrl =
    currentSegment?.type === "MEDITATION"
      ? currentBlock?.meditationAudioUrl ?? meditationAudioUrl
      : meditationAudioUrl;
  const posterActive = status === "active" && currentSegment?.type === "POSTER";
  const textActive = status === "active" && currentSegment?.type === "TEXT";
  const experienceContainerClass = showModal
    ? "h-full min-h-0"
    : "min-h-[72vh] h-[72vh]";

  useEffect(() => {
    if (meditationActive) {
      setMeditationMuted(false);
    }
  }, [meditationActive, meditationIndex]);

  const experienceBody = posterActive ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d1016] via-[#121a24] to-[#0b0f16] px-6 py-12 ${experienceContainerClass}`}
    >
      <div
        className="prose max-w-3xl text-center text-slate-100"
        style={{ fontFamily: "var(--font-serif)" }}
        data-poster
        dangerouslySetInnerHTML={{
          __html: renderPosterHtml(
            currentBlock?.poster?.content ?? "Poster content missing."
          )
        }}
      />
    </div>
  ) : textActive ? (
    <div
      className={`rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c1b18] via-[#141311] to-[#0f0e0c] px-6 py-8 shadow-[0_30px_70px_rgba(15,23,42,0.35)] ${experienceContainerClass}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200/70">
            Text mode
          </p>
          <p className="mt-1 text-xs text-amber-100/60">
            Write freely. Autosave keeps your draft safe while the block is active.
          </p>
        </div>
        <p className="text-xs text-amber-100/60">
          {textEntryStatus === "saving" && "Saving..."}
          {textEntryStatus === "saved" && "Saved"}
          {textEntryStatus === "error" && "Save failed"}
          {textEntryStatus === "loading" && "Loading..."}
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-amber-100/10 bg-[#f7f2e8] p-5 text-[#2a241d] shadow-inner">
        <textarea
          value={textEntry}
          onChange={(event) => setTextEntry(event.target.value)}
          className="min-h-[360px] w-full resize-none bg-transparent font-serif text-lg leading-relaxed text-[#2a241d] placeholder:text-[#8a7f72] focus:outline-none"
          placeholder="Begin writing..."
          style={{ fontFamily: "var(--font-serif)" }}
        />
      </div>
    </div>
  ) : meditationActive ? (
    <MeditationRoundEmbed
      meditationIndex={meditationIndex}
      roundAfter={roundAfter}
      endsAtMs={segmentEnd}
      animationId={currentMeditationAnimationId}
      audioUrl={currentMeditationAudioUrl}
      isMuted={meditationMuted}
      onComplete={handleMeditationComplete}
      className={experienceContainerClass}
    />
  ) : status === "active" && assignment && !assignment.isBreak ? (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80 ${experienceContainerClass} ${
        showModal ? "flex min-h-0 flex-col" : ""
      }`}
    >
      <iframe
        title="Call"
        src={joinUrl}
        className={`w-full ${showModal ? "flex-1 min-h-0" : "h-[72vh]"}`}
        allow="camera; microphone; fullscreen"
      />
    </div>
  ) : assignment?.isBreak ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <p className="text-lg">This round is a break for you.</p>
    </div>
  ) : status === "done" ? (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <p className="text-lg">Plan finished.</p>
    </div>
  ) : (
    <div
      className={`flex items-center justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-10 text-center text-slate-200 ${experienceContainerClass}`}
    >
      <p className="text-lg">Waiting for the plan to start.</p>
    </div>
  );


  useEffect(() => {
    if (!textActive || !currentSegment?.blockId) {
      setTextEntry("");
      setTextEntryStatus("idle");
      setTextBlockId(null);
      lastSavedTextRef.current = "";
      return;
    }

    let active = true;
    setTextEntryStatus("loading");
    setTextBlockId(currentSegment.blockId);
    async function loadEntry() {
      const response = await fetch(`/api/plans/${planId}/blocks/${currentSegment.blockId}/text`);
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (response.ok) {
        const content = payload?.entry?.content ?? "";
        setTextEntry(content);
        lastSavedTextRef.current = content;
        setTextEntryStatus("saved");
      } else {
        setTextEntryStatus("error");
      }
    }
    loadEntry();
    return () => {
      active = false;
    };
  }, [planId, currentSegment?.blockId, textActive]);

  useEffect(() => {
    if (!textActive || !textBlockId) return;
    if (textEntryStatus === "loading") return;
    if (textEntry === lastSavedTextRef.current) return;
    const timer = setTimeout(async () => {
      setTextEntryStatus("saving");
      const response = await fetch(`/api/plans/${planId}/blocks/${textBlockId}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textEntry })
      });
      if (response.ok) {
        lastSavedTextRef.current = textEntry;
        setTextEntryStatus("saved");
      } else {
        setTextEntryStatus("error");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [textEntry, textActive, textBlockId, planId, textEntryStatus]);

  useEffect(() => {
    if (status !== "done") return;
    const textBlockIds = schedule.segments
      .filter((segment) => segment.type === "TEXT" && segment.blockId)
      .map((segment) => segment.blockId as string);
    if (textBlockIds.length === 0) return;

    let active = true;
    async function loadCompletedTextEntries() {
      const entries = await Promise.all(
        textBlockIds.map(async (blockId) => {
          const response = await fetch(`/api/plans/${planId}/blocks/${blockId}/text`);
          const payload = await response.json().catch(() => null);
          if (!response.ok) return [blockId, ""] as const;
          return [blockId, payload?.entry?.content ?? ""] as const;
        })
      );
      if (!active) return;
      const next: Record<string, string> = {};
      entries.forEach(([blockId, content]) => {
        next[blockId] = content;
      });
      setCompletedTextEntries(next);
    }
    loadCompletedTextEntries();
    return () => {
      active = false;
    };
  }, [status, schedule.segments, planId]);

  async function refreshPlanRecap() {
    setRecapLoading(true);
    setRecapError(null);
    const response = await fetch(`/api/plans/${planId}/recap`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setRecapError("Unable to load plan recap.");
      setRecapLoading(false);
      return;
    }
    setPlanRecapTextEntries(payload?.textEntries ?? []);
    setPlanRecapMeditations(payload?.meditationSessions ?? []);
    setPlanRecapMeetingTranscripts(payload?.meetingTranscripts ?? []);
    setPlanRecapParticipants(payload?.participants ?? []);
    setRecapLoading(false);
  }

  useEffect(() => {
    if (status !== "done") return;
    if (
      planRecapTextEntries.length > 0 ||
      planRecapMeditations.length > 0 ||
      planRecapMeetingTranscripts.length > 0
    ) {
      return;
    }
    refreshPlanRecap();
  }, [
    planId,
    status,
    planRecapTextEntries.length,
    planRecapMeditations.length,
    planRecapMeetingTranscripts.length
  ]);

  async function handleMeditationComplete(
    audio: Blob,
    index: number,
    roundAfterValue: number | null
  ) {
    if (completedMeditations.has(index)) return;
    if (!audio || audio.size === 0) return;
    setSendingMeditation(true);
    const formData = new FormData();
    formData.append("audio", audio, `meditation-${index}.webm`);
    formData.append("meditationIndex", String(index));
    if (roundAfterValue) {
      formData.append("roundAfter", String(roundAfterValue));
    }
    const response = await fetch(`/api/plans/${planId}/meditation/transcribe`, {
      method: "POST",
      body: formData
    });
    const payload = await response.json().catch(() => null);
    setSendingMeditation(false);
    if (!response.ok) return;
    setMeditationSessions((prev) => [
      ...prev,
      {
        id: payload.id,
        meditationIndex: payload.meditationIndex,
        roundAfter: payload.roundAfter ?? null,
        transcriptText: payload.transcriptText ?? null,
        createdAt: new Date().toISOString()
      }
    ]);
    setCompletedMeditations((prev) => new Set([...prev, index]));
  }

  return (
    <div className="dr-card dr-card-no-filter p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
            {planTitle ? planTitle : "Plan"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
              {language}
            </span>
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-600">
              {transcriptionProvider === "VOSK" ? "Vosk" : "Deepgram"}
            </span>
            <span className="uppercase tracking-[0.18em]">Phase</span>
            <span className="font-semibold text-slate-900">
              {status === "pending" && "Not started"}
              {status === "active" && currentSegment?.type === "MEDITATION"
                ? `Meditation ${meditationIndex}`
                : null}
              {status === "active" && currentSegment?.type === "POSTER"
                ? currentBlock?.poster?.title
                  ? `Poster · ${currentBlock.poster.title}`
                  : "Poster"
                : null}
              {status === "active" && currentSegment?.type === "TEXT" ? "Text mode" : null}
              {status === "active" && currentSegment?.type === "ROUND"
                ? `Round ${currentRound} of ${roundsCount}`
                : null}
              {status === "done" && "Finished"}
            </span>
            <span className="uppercase tracking-[0.18em]">Countdown</span>
            <span className="font-semibold text-slate-900">
              {status === "active" ? formatDuration(secondsLeft) : "-"}
            </span>
            <span className="uppercase tracking-[0.18em]">Partner</span>
            <span className="font-semibold text-slate-900">
              {currentSegment?.type === "MEDITATION" ? "Solo" : null}
              {currentSegment?.type === "POSTER" ? "Focus" : null}
              {currentSegment?.type === "TEXT" ? "Your notes" : null}
              {currentSegment?.type === "ROUND" ? (assignment ? assignment.partnerLabel : "-") : null}
            </span>
            {status === "pending" ? (
              <span className="text-slate-500">
                Starts in{" "}
                {formatCountdownHuman(Math.max(0, Math.floor((startTime - effectiveNow) / 1000)))}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {showModal ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="absolute right-6 top-6 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
      ) : null}

      <div
        className={`mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/80 ${
          showModal ? "fixed inset-0 z-[10000] m-4 flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={showModal ? "flex-1 min-h-0 overflow-hidden p-3" : "p-3"}>
          {experienceBody}
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/70 px-4 py-2 text-sm ${
            showModal ? "bg-white/90" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Experience</span>
            <span className="text-slate-700">
              {currentSegment?.type === "ROUND" ? "1:1 call" : currentSegment?.type ?? "Waiting"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">
              {status === "active" ? formatDuration(secondsLeft) : "-"}
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-slate-700">
              {currentSegment?.type === "MEDITATION" ? "Solo" : null}
              {currentSegment?.type === "POSTER" ? "Focus" : null}
              {currentSegment?.type === "TEXT" ? "Your notes" : null}
              {currentSegment?.type === "ROUND" ? (assignment ? assignment.partnerLabel : "-") : null}
            </span>
            {meditationActive ? (
              <button
                type="button"
                onClick={() => setMeditationMuted((prev) => !prev)}
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase text-slate-700 hover:text-slate-900"
              >
                {meditationMuted ? "Unmute music" : "Mute music"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowModal((prev) => !prev)}
              className="dr-button-outline px-3 py-1 text-xs"
            >
              {showModal ? "Exit immersive" : "Open immersive view"}
            </button>
          </div>
        </div>
      </div>

      <div>
        {status === "active" && currentMeetingId ? (
          <TranscriptionPanel meetingId={currentMeetingId} canManage={false} />
        ) : null}

        {meditationEnabled ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Meditation notes</h3>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {meditationSessions.length === 0 ? (
                <p className="text-slate-500">No meditation transcripts yet.</p>
              ) : (
                meditationSessions.map((session) => (
                  <div key={session.id} className="rounded border border-slate-200 bg-white/70 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Meditation {session.meditationIndex}
                      {session.roundAfter ? ` · before round ${session.roundAfter}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {session.transcriptText || "Transcription saved."}
                    </p>
                  </div>
                ))
              )}
              {sendingMeditation ? (
                <p className="text-xs text-slate-500">Saving meditation transcription...</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Your schedule</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            {assignments.map((item) => {
              const meetingId = item.meetingId ?? meetingByRound[item.roundNumber];
              return (
                <div key={item.roundNumber} className="rounded border border-slate-200 bg-white/70 px-3 py-2">
                  <div className="break-all">
                    Round {item.roundNumber}: {item.partnerLabel}{" "}
                    {item.isBreak ? "(break)" : `— ${item.roomId}`}
                  </div>
                  {meetingId ? (
                    <div className="mt-1 text-xs text-slate-600">
                      Meeting record:{" "}
                      <a className="font-semibold text-slate-900 underline" href={`/meetings/${meetingId}`}>
                        /meetings/{meetingId}
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

      {status === "done" ? (
        <div className="mt-10 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Plan recap</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
                Your journey, captured
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Notes, posters, and round highlights from this plan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setRecapView("personal")}
                  className={`rounded-full px-3 py-1 ${
                    recapView === "personal" ? "bg-slate-900 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => setRecapView("plan")}
                  className={`rounded-full px-3 py-1 ${
                    recapView === "plan" ? "bg-slate-900 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Plan view
                </button>
              </div>
              <button
                type="button"
                onClick={refreshPlanRecap}
                className="dr-button-outline px-3 py-1 text-xs"
                disabled={recapLoading}
              >
                {recapLoading ? "Refreshing..." : "Refresh recap"}
              </button>
            </div>
          </div>
          {recapView === "plan" ? (
            <div className="mt-4 text-xs text-slate-500">
              {recapLoading && "Loading plan recap..."}
              {recapError ? recapError : null}
            </div>
          ) : null}
          <div className="mt-6 space-y-4">
            {schedule.segments.map((segment, index) => {
              const durationSeconds = Math.max(
                1,
                Math.floor((segment.endAtMs - segment.startAtMs) / 1000)
              );
              if (segment.type === "ROUND") {
                const roundNumber = segment.roundNumber ?? index + 1;
                const roundAssignment = assignments.find((item) => item.roundNumber === roundNumber);
                const meetingId =
                  roundAssignment?.meetingId ?? (roundAssignment ? meetingByRound[roundAssignment.roundNumber] : undefined);
                const roundRooms = roundGroupsByNumber.get(roundNumber) ?? [];
                return (
                  <div
                    key={`recap-round-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Round {roundNumber}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {recapView === "plan" ? "Multiple pairs" : roundAssignment?.partnerLabel || "Partner"}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "personal" && meetingId ? (
                      <div className="mt-2 text-xs text-slate-600">
                        Meeting record:{" "}
                        <a className="font-semibold text-slate-900 underline" href={`/meetings/${meetingId}`}>
                          /meetings/{meetingId}
                        </a>
                      </div>
                    ) : null}
                    {recapView === "personal" && meetingId ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
                        <p className="text-xs font-semibold uppercase text-slate-500">Transcript</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {meetingTranscriptById.get(meetingId) || "No transcript available yet."}
                        </p>
                      </div>
                    ) : null}
                    {recapView === "plan" ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {roundRooms.length === 0 ? (
                          <p className="text-sm text-slate-500">No pairings available.</p>
                        ) : (
                          roundRooms.map((room) => (
                            <div key={room.roomId} className="rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                              <p className="text-xs font-semibold uppercase text-slate-400">Room</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {room.participants.join(" & ")}
                              </p>
                              <div className="mt-2 text-xs text-slate-600">
                                {room.meetingId
                                  ? meetingTranscriptById.get(room.meetingId) || "No transcript yet."
                                  : "No transcript yet."}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (segment.type === "MEDITATION") {
                const sessions =
                  recapView === "plan"
                    ? planRecapMeditations.filter(
                        (item) => item.meditationIndex === segment.meditationIndex
                      )
                    : meditationSessions
                        .filter((item) => item.meditationIndex === segment.meditationIndex)
                        .map((item) => ({
                          meditationIndex: item.meditationIndex,
                          roundAfter: item.roundAfter,
                          transcriptText: item.transcriptText ?? "",
                          userEmail: userEmail
                        }));
                return (
                  <div
                    key={`recap-meditation-${index}`}
                    className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        Meditation {segment.meditationIndex}
                      </p>
                      <p className="text-xs text-emerald-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "plan" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-emerald-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entry = sessions.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.meditationIndex}`}
                                className="rounded border border-emerald-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-emerald-600">
                                  {participant}
                                </p>
                                <p className="mt-1 text-sm text-emerald-900">
                                  {entry?.transcriptText
                                    ? entry.transcriptText
                                    : "No meditation transcript."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="mt-2 text-sm text-emerald-900">Transcription saved.</p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-emerald-900">
                        {sessions.map((session, sessionIndex) => (
                          <div key={`${session.userEmail}-${sessionIndex}`} className="rounded border border-emerald-200/60 bg-white/70 px-3 py-2">
                            <p className="mt-1 text-sm text-emerald-900">
                              {session.transcriptText || "Transcription saved."}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

                if (segment.type === "POSTER") {
                  const poster = segment.blockId ? blockById.get(segment.blockId)?.poster : null;
                  return (
                    <div
                      key={`recap-poster-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Poster{poster?.title ? ` · ${poster.title}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Duration {formatDuration(durationSeconds)}
                        </p>
                      </div>
                      <div
                        className="prose prose-sm mt-3 max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{
                          __html: renderPosterHtml(poster?.content ?? "Poster content missing.")
                        }}
                      />
                    </div>
                  );
                }

              if (segment.type === "TEXT") {
                const entry = segment.blockId ? completedTextEntries[segment.blockId] : "";
                const blockEntries =
                  recapView === "plan" && segment.blockId
                    ? planRecapTextEntries.filter((item) => item.blockId === segment.blockId)
                    : [];
                return (
                  <div
                    key={`recap-text-${index}`}
                    className="rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-amber-700">Text mode</p>
                      <p className="text-xs text-amber-700/70">
                        Duration {formatDuration(durationSeconds)}
                      </p>
                    </div>
                    {recapView === "personal" ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">
                        {entry || "No text captured for this block."}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-amber-900">
                        {(planRecapParticipants.length ? planRecapParticipants : [userEmail]).map(
                          (participant) => {
                            const entryItem = blockEntries.find(
                              (item) => item.userEmail === participant
                            );
                            return (
                              <div
                                key={`${participant}-${segment.blockId}`}
                                className="rounded border border-amber-200/60 bg-white/70 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase text-amber-700">
                                  {participant}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">
                                  {entryItem?.content
                                    ? entryItem.content
                                    : "No text submitted."}
                                </p>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }

                return null;
              })}
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
