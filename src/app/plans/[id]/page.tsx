import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParticipantViewClient } from "@/app/plans/[id]/ParticipantViewClient";
import { PlanParticipation } from "@/app/plans/[id]/PlanParticipation";
import { buildLegacySegments, buildPlanSegmentsFromBlocks } from "@/lib/planSchedule";
import Link from "next/link";

export default async function PlanParticipantPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: {
        include: {
          members: { select: { userId: true } }
        }
      },
      blocks: {
        orderBy: { orderIndex: "asc" },
        include: {
          poster: { select: { id: true, title: true, content: true } }
        }
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          pairs: {
            include: {
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      },
      participants: {
        include: {
          user: { select: { email: true } }
        }
      }
    }
  });

  if (!plan) {
    return <p className="text-sm text-slate-600">Plan not found.</p>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const isParticipant = plan.rounds.some((round) =>
    round.pairs.some(
      (pair) => pair.userAId === session.user.id || pair.userBId === session.user.id
    )
  );
  const isDataspaceMember = plan.dataspace
    ? plan.dataspace.members.some((member) => member.userId === session.user.id)
    : false;

  if (!isAdmin && !isParticipant && !(plan.isPublic && isDataspaceMember)) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  const schedule =
    plan.blocks.length > 0
      ? buildPlanSegmentsFromBlocks(plan.startAt, plan.blocks)
      : buildLegacySegments({
          startAt: plan.startAt,
          roundsCount: plan.roundsCount,
          roundDurationMinutes: plan.roundDurationMinutes,
          meditationEnabled: plan.meditationEnabled,
          meditationAtStart: plan.meditationAtStart,
          meditationBetweenRounds: plan.meditationBetweenRounds,
          meditationAtEnd: plan.meditationAtEnd,
          meditationDurationMinutes: plan.meditationDurationMinutes
        });
  const { totalEndMs } = schedule;
  const canEdit = (isAdmin || plan.createdById === session.user.id) && Date.now() <= totalEndMs;

  const participantRecord = plan.participants.find(
    (participant) => participant.userId === session.user.id
  );
  const pendingRequests = plan.participants
    .filter((participant) => participant.status === "PENDING")
    .map((participant) => ({
      id: participant.id,
      email: participant.user.email
    }));

  const assignments = plan.rounds.map((round) => {
    const rooms = new Map<string, string[]>();
    const meetingByRoom = new Map<string, string>();
    round.pairs.forEach((pair) => {
      if (!rooms.has(pair.roomId)) {
        rooms.set(pair.roomId, []);
      }
      const list = rooms.get(pair.roomId) ?? [];
      if (pair.userA?.email) list.push(pair.userA.email);
      if (pair.userB?.email) list.push(pair.userB.email);
      rooms.set(pair.roomId, list);
      if (pair.meetingId) {
        meetingByRoom.set(pair.roomId, pair.meetingId);
      }
    });

    const userEmail = session.user.email;
    let assignedRoomId = "";
    let partnerLabel = "Break";
    let isBreak = true;

    for (const [roomId, participants] of rooms.entries()) {
      if (participants.includes(userEmail)) {
        assignedRoomId = roomId;
        const partners = participants.filter((email) => email !== userEmail);
        partnerLabel = partners.length ? partners.join(", ") : "Break";
        isBreak = partners.length === 0;
        break;
      }
    }

    return {
      roundNumber: round.roundNumber,
      roomId: assignedRoomId,
      partnerLabel,
      isBreak,
      meetingId: assignedRoomId ? meetingByRoom.get(assignedRoomId) ?? null : null
    };
  });

  const roundGroups = plan.rounds.map((round) => {
    const rooms = new Map<string, string[]>();
    const meetingByRoom = new Map<string, string>();
    round.pairs.forEach((pair) => {
      if (!rooms.has(pair.roomId)) {
        rooms.set(pair.roomId, []);
      }
      const list = rooms.get(pair.roomId) ?? [];
      if (pair.userA?.email) list.push(pair.userA.email);
      if (pair.userB?.email) list.push(pair.userB.email);
      rooms.set(pair.roomId, list);
      if (pair.meetingId) {
        meetingByRoom.set(pair.roomId, pair.meetingId);
      }
    });
    return {
      roundNumber: round.roundNumber,
      rooms: Array.from(rooms.entries()).map(([roomId, participants]) => ({
        roomId,
        participants,
        meetingId: meetingByRoom.get(roomId) ?? null
      }))
    };
  });

  const meditationBlocks = plan.blocks.filter((block) => block.type === "MEDITATION");
  const meditationTotalMinutes = meditationBlocks.length
    ? Math.max(1, Math.round(meditationBlocks.reduce((sum, block) => sum + block.durationSeconds, 0) / 60))
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Plan Participant View
          </h1>
          <p className="text-sm text-slate-600">Personalized call link and round status.</p>
        </div>
        {canEdit ? (
          <Link href={`/plans/${plan.id}/edit`} className="dr-button-outline px-3 py-1 text-xs">
            Edit plan
          </Link>
        ) : null}
      </div>
      <ParticipantViewClient
        planId={plan.id}
        planTitle={plan.title}
        language={plan.language}
        transcriptionProvider={plan.transcriptionProvider}
        startAt={plan.startAt.toISOString()}
        roundDurationMinutes={plan.roundDurationMinutes}
        roundsCount={plan.roundsCount}
        syncMode={plan.syncMode === "CLIENT" ? "CLIENT" : "SERVER"}
        meditationEnabled={plan.meditationEnabled}
        meditationAtStart={plan.meditationAtStart}
        meditationBetweenRounds={plan.meditationBetweenRounds}
        meditationAtEnd={plan.meditationAtEnd}
        meditationDurationMinutes={plan.meditationDurationMinutes}
        meditationAnimationId={plan.meditationAnimationId}
        meditationAudioUrl={plan.meditationAudioUrl}
        blocks={plan.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          durationSeconds: block.durationSeconds,
          roundNumber: block.roundNumber,
          meditationAnimationId: block.meditationAnimationId ?? null,
          meditationAudioUrl: block.meditationAudioUrl ?? null,
          poster: block.poster
            ? { id: block.poster.id, title: block.poster.title, content: block.poster.content }
            : null
        }))}
        roundGroups={roundGroups}
        assignments={assignments}
        baseUrl={process.env.MIROTALK_BASE_URL || ""}
        userEmail={session.user.email}
      />
      {plan.isPublic ? (
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Plan rules</h2>
          {plan.description ? (
            <p className="mt-2 text-sm text-slate-700">{plan.description}</p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Rounds</p>
              <p>{plan.roundsCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Minutes per round</p>
              <p>{plan.roundDurationMinutes}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Switching mode</p>
              <p>{plan.syncMode === "CLIENT" ? "Client-driven" : "Server-driven"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Max per room</p>
              <p>{plan.maxParticipantsPerRoom}</p>
            </div>
            {plan.capacity ? (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Capacity</p>
                <p>{plan.capacity}</p>
              </div>
            ) : null}
            {meditationBlocks.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Meditation blocks</p>
                <p>
                  {meditationBlocks.length} · {meditationTotalMinutes} min total
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <PlanParticipation
        planId={plan.id}
        isPublic={plan.isPublic}
        requiresApproval={plan.requiresApproval}
        capacity={plan.capacity}
        isDataspaceMember={isDataspaceMember}
        isFixedParticipant={isParticipant}
        participantStatus={participantRecord?.status ?? null}
        pendingRequests={pendingRequests}
        canManageRequests={isAdmin || plan.createdById === session.user.id}
      />
    </div>
  );
}
