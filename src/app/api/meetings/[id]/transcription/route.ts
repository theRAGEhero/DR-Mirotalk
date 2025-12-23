import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { fetchRounds, fetchTranscription } from "@/lib/deepgram";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const canAccess =
    session.user.role === "ADMIN" || meeting.members.length > 0 || meeting.createdById === session.user.id;

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const auto = url.searchParams.get("auto") === "1";
  let roundId = meeting.transcriptionRoundId;
  const provider = meeting.transcriptionProvider === "VOSK" ? "VOSK" : "DEEPGRAM";
  const baseUrl =
    provider === "VOSK"
      ? process.env.VOSK_BASE_URL || ""
      : process.env.DEEPGRAM_BASE_URL || "";

  if (!roundId && auto) {
    const roundsResponse = await fetchRounds(baseUrl);
    const rounds = Array.isArray(roundsResponse?.rounds) ? roundsResponse.rounds : [];
    const matches = rounds.filter((round) => typeof round?.name === "string" && round.name.includes(meeting.roomId));

    const sorted = matches.sort((a, b) => {
      const aDate = new Date(a?.created_at ?? 0).getTime();
      const bDate = new Date(b?.created_at ?? 0).getTime();
      return bDate - aDate;
    });

    const preferred = sorted.find((round) => round.status === "completed") ?? sorted[0];

    if (preferred?.id) {
      roundId = preferred.id;
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { transcriptionRoundId: roundId }
      });
    }
  }

  if (!roundId) {
    return NextResponse.json({ error: "Transcription not linked" }, { status: 404 });
  }

  try {
    const transcription = await fetchTranscription(baseUrl, roundId);
    return NextResponse.json({ transcription, roundId, provider });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch transcription" },
      { status: 502 }
    );
  }
}
