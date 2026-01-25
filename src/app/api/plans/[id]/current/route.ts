import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlanViewer } from "@/lib/planGuests";
import {
  buildLegacySegments,
  buildPlanSegmentsFromBlocks,
  getSegmentAtTime,
  type PlanBlockInput,
  type PlanBlockType
} from "@/lib/planSchedule";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const requestUrl = new URL(_request.url);
  const includeMeetings = requestUrl.searchParams.get("include_meetings") === "1";
  const viewer = await getPlanViewer(_request, params.id);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = viewer.user.role === "ADMIN";
  const plan = isAdmin
    ? await prisma.plan.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          title: true,
          startAt: true,
          roundsCount: true,
          roundDurationMinutes: true,
          createdById: true,
          dataspaceId: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true,
          meditationAtStart: true,
          meditationBetweenRounds: true,
          meditationAtEnd: true,
          meditationDurationMinutes: true,
          blocks: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              durationSeconds: true,
              roundNumber: true,
              posterId: true
            }
          }
        }
      })
    : await prisma.plan.findFirst({
        where: {
          id: params.id,
          OR: [
            {
              rounds: {
                some: {
                  pairs: {
                    some: {
                      OR: [{ userAId: viewer.user.id }, { userBId: viewer.user.id }]
                    }
                  }
                }
              }
            },
            {
              participants: {
                some: {
                  userId: viewer.user.id,
                  status: "APPROVED"
                }
              }
            }
          ]
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          roundsCount: true,
          roundDurationMinutes: true,
          createdById: true,
          dataspaceId: true,
          language: true,
          transcriptionProvider: true,
          meditationEnabled: true,
          meditationAtStart: true,
          meditationBetweenRounds: true,
          meditationAtEnd: true,
          meditationDurationMinutes: true,
          blocks: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              type: true,
              durationSeconds: true,
              roundNumber: true,
              posterId: true
            }
          }
        }
      });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const normalizedBlocks: PlanBlockInput[] = (plan.blocks ?? []).reduce(
    (acc: PlanBlockInput[], block: (typeof plan.blocks)[number]) => {
      const type = block.type as PlanBlockType;
      if (!["ROUND", "MEDITATION", "POSTER", "TEXT"].includes(type)) {
        return acc;
      }
      acc.push({
        id: block.id,
        type,
        durationSeconds: block.durationSeconds,
        roundNumber: block.roundNumber ?? null,
        posterId: block.posterId ?? null
      });
      return acc;
    },
    []
  );

  const now = new Date();
  const schedule =
    normalizedBlocks.length > 0
      ? buildPlanSegmentsFromBlocks(plan.startAt, normalizedBlocks)
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

  const nowMs = now.getTime();
  const elapsed = nowMs - plan.startAt.getTime();
  const currentSegment = getSegmentAtTime(schedule.segments, nowMs);
  const currentRoundIndex =
    currentSegment?.type === "ROUND"
      ? currentSegment?.roundNumber ?? 1
      : currentSegment?.roundAfter ?? 1;

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && nowMs < schedule.totalEndMs) {
    status = "active";
  } else if (nowMs >= schedule.totalEndMs) {
    status = "done";
  }

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), plan.roundsCount);
  let currentRoundMeetings: Array<{ roomId: string; meetingId: string }> = [];

  if (status === "active" && currentSegment?.type === "ROUND") {
    const round = await prisma.planRound.findUnique({
      where: {
        planId_roundNumber: {
          planId: plan.id,
          roundNumber: currentRound
        }
      },
      include: {
        pairs: true
      }
    });

    if (round) {
      const roundStart = new Date(currentSegment.startAtMs);
      const roundEnd = new Date(currentSegment.endAtMs);
      const rooms = new Map<string, Set<string>>();

      round.pairs.forEach((pair: (typeof round.pairs)[number]) => {
        if (!rooms.has(pair.roomId)) {
          rooms.set(pair.roomId, new Set());
        }
        const set = rooms.get(pair.roomId);
        set?.add(pair.userAId);
        if (pair.userBId) {
          set?.add(pair.userBId);
        }
      });

      for (const [roomId, userIds] of rooms.entries()) {
        if (userIds.size < 2) {
          continue;
        }

        let meeting = await prisma.meeting.findUnique({
          where: { roomId }
        });

        if (!meeting) {
          meeting = await prisma.meeting.create({
            data: {
              title: `${plan.title} - Round ${currentRound}`,
              roomId,
              createdById: plan.createdById,
              scheduledStartAt: roundStart,
              expiresAt: roundEnd,
              language: plan.language,
              transcriptionProvider: plan.transcriptionProvider,
              dataspaceId: plan.dataspaceId ?? null,
              isHidden: true,
              members: {
                create: Array.from(userIds).map((userId) => ({
                  userId,
                  role: "GUEST"
                }))
              }
            }
          });
        } else {
          const existingMembers = await prisma.meetingMember.findMany({
            where: {
              meetingId: meeting.id,
              userId: { in: Array.from(userIds) }
            },
            select: { userId: true }
          });
          const existingIds = new Set(
            existingMembers.map(
              (member: (typeof existingMembers)[number]) => member.userId
            )
          );
          for (const userId of userIds) {
            if (existingIds.has(userId)) continue;
            await prisma.meetingMember.create({
              data: {
                meetingId: meeting.id,
                userId,
                role: "GUEST"
              }
            });
          }
        }

        await prisma.planPair.updateMany({
          where: {
            planRoundId: round.id,
            roomId,
            meetingId: null
          },
          data: {
            meetingId: meeting.id
          }
        });

        currentRoundMeetings.push({ roomId, meetingId: meeting.id });
      }
    }
  }

  return NextResponse.json({
    serverNow: now.toISOString(),
    status,
    currentRound,
    segmentType: currentSegment?.type ?? "ROUND",
    meditationIndex: currentSegment?.meditationIndex ?? null,
    roundAfter: currentSegment?.roundAfter ?? null,
    segmentStartsAt: currentSegment?.startAtMs
      ? new Date(currentSegment.startAtMs).toISOString()
      : null,
    segmentEndsAt: currentSegment?.endAtMs
      ? new Date(currentSegment.endAtMs).toISOString()
      : null,
    currentRoundMeetings: includeMeetings ? currentRoundMeetings : undefined
  });
}
