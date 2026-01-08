import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlanBuilderClient } from "@/app/plans/new/PlanBuilderClient";
import { buildPlanSegmentsFromBlocks, buildLegacySegments } from "@/lib/planSchedule";

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          durationSeconds: true,
          roundNumber: true,
          posterId: true,
          meditationAnimationId: true,
          meditationAudioUrl: true
        }
      },
      rounds: {
        include: {
          pairs: { select: { userAId: true, userBId: true } }
        }
      }
    }
  });

  if (!plan) {
    return <p className="text-sm text-slate-500">Plan not found.</p>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const canEdit = isAdmin || plan.createdById === session.user.id;

  if (!canEdit) {
    return <p className="text-sm text-slate-500">Access denied.</p>;
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

  if (Date.now() > totalEndMs) {
    return <p className="text-sm text-slate-500">This plan is already concluded.</p>;
  }

  const participantIds = Array.from(
    new Set(
      plan.rounds.flatMap((round) =>
        round.pairs.flatMap((pair) => [pair.userAId, pair.userBId].filter(Boolean))
      )
    )
  ) as string[];

  const [users, dataspaces] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true }
    }),
    prisma.dataspace.findMany({
      where: { members: { some: { userId: session.user.id } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Edit plan
        </h1>
        <p className="text-sm text-slate-600">Update details before the plan concludes.</p>
      </div>
      <PlanBuilderClient
        users={users}
        dataspaces={dataspaces}
        mode="edit"
        initialPlan={{
          id: plan.id,
          title: plan.title,
          description: plan.description,
          startAt: plan.startAt.toISOString(),
          roundDurationMinutes: plan.roundDurationMinutes,
          roundsCount: plan.roundsCount,
          syncMode: plan.syncMode === "CLIENT" ? "CLIENT" : "SERVER",
          maxParticipantsPerRoom: plan.maxParticipantsPerRoom,
          language: plan.language,
          transcriptionProvider: plan.transcriptionProvider,
          meditationEnabled: plan.meditationEnabled,
          meditationAtStart: plan.meditationAtStart,
          meditationBetweenRounds: plan.meditationBetweenRounds,
          meditationAtEnd: plan.meditationAtEnd,
          meditationDurationMinutes: plan.meditationDurationMinutes,
          meditationAnimationId: plan.meditationAnimationId,
          meditationAudioUrl: plan.meditationAudioUrl,
          dataspaceId: plan.dataspaceId,
          isPublic: plan.isPublic,
          requiresApproval: plan.requiresApproval,
          capacity: plan.capacity,
          participantIds,
          blocks: plan.blocks.map((block) => ({
            id: block.id,
            type: block.type,
            durationSeconds: block.durationSeconds,
            roundNumber: block.roundNumber,
            posterId: block.posterId,
            meditationAnimationId: block.meditationAnimationId ?? null,
            meditationAudioUrl: block.meditationAudioUrl ?? null
          }))
        }}
      />
    </div>
  );
}
