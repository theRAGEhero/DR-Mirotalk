import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function extractTranscriptText(raw: string | null) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const fromTopLevel = parsed?.contributions;
    const fromDeliberation = parsed?.deliberation?.contributions;
    const contributions = Array.isArray(fromTopLevel)
      ? fromTopLevel
      : Array.isArray(fromDeliberation)
        ? fromDeliberation
        : [];
    return contributions
      .map((entry: any) => entry?.text)
      .filter((text: any) => typeof text === "string")
      .join(" ");
  } catch {
    return "";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      dataspace: {
        include: { members: { select: { userId: true } } }
      },
      rounds: {
        include: {
          pairs: {
            select: {
              userAId: true,
              userBId: true,
              meetingId: true,
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [textEntries, meditationSessions] = await Promise.all([
    prisma.planTextEntry.findMany({
      where: { planId: plan.id },
      select: {
        blockId: true,
        content: true,
        user: { select: { email: true } }
      }
    }),
    prisma.planMeditationSession.findMany({
      where: { planId: plan.id },
      select: {
        meditationIndex: true,
        roundAfter: true,
        transcriptText: true,
        createdAt: true,
        user: { select: { email: true } }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const meetingPairs = plan.rounds.flatMap((round) =>
    round.pairs
      .filter((pair) => pair.meetingId)
      .map((pair) => ({
        roundNumber: round.roundNumber,
        meetingId: pair.meetingId as string,
        participants: [pair.userA?.email, pair.userB?.email].filter(Boolean) as string[]
      }))
  );
  const uniqueMeetingIds = Array.from(new Set(meetingPairs.map((pair) => pair.meetingId)));
  const meetingTranscripts = uniqueMeetingIds.length
    ? await prisma.meetingTranscript.findMany({
        where: { meetingId: { in: uniqueMeetingIds } },
        select: {
          meetingId: true,
          transcriptText: true,
          transcriptJson: true
        }
      })
    : [];
  const transcriptByMeeting = new Map(
    meetingTranscripts.map((item) => {
      const text = item.transcriptText && item.transcriptText.trim().length > 0
        ? item.transcriptText
        : extractTranscriptText(item.transcriptJson);
      return [item.meetingId, text ?? ""];
    })
  );

  const participantIds = Array.from(
    new Set(
      plan.rounds.flatMap((round) =>
        round.pairs.flatMap((pair) => [pair.userAId, pair.userBId]).filter(Boolean)
      )
    )
  ).filter((id): id is string => typeof id === "string");
  const participants = participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { email: true }
      })
    : [];

  return NextResponse.json({
    textEntries: textEntries.map((entry) => ({
      blockId: entry.blockId,
      content: entry.content,
      userEmail: entry.user.email
    })),
    meditationSessions: meditationSessions.map((session) => ({
      meditationIndex: session.meditationIndex,
      roundAfter: session.roundAfter,
      transcriptText: session.transcriptText ?? "",
      userEmail: session.user.email,
      createdAt: session.createdAt.toISOString()
    })),
    meetingTranscripts: meetingPairs.map((pair) => ({
      meetingId: pair.meetingId,
      roundNumber: pair.roundNumber,
      participants: pair.participants,
      transcriptText: transcriptByMeeting.get(pair.meetingId) ?? ""
    })),
    participants: participants.map((participant) => participant.email)
  });
}
