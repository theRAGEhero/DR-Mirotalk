import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMeetingSchema } from "@/lib/validators";
import { getSession } from "@/lib/session";
import { generateRoomId } from "@/lib/utils";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, hasExpiry, expiresInHours, language, transcriptionProvider } = parsed.data;
  const providerLabel = transcriptionProvider === "VOSK" ? "Vosk" : "Deepgram";
  const roomId = `${generateRoomId()}-${language}-${providerLabel}`;
  const expiresAt = hasExpiry
    ? new Date(Date.now() + (expiresInHours ?? 4) * 60 * 60 * 1000)
    : null;

  const meeting = await prisma.meeting.create({
    data: {
      title,
      roomId,
      createdById: session.user.id,
      expiresAt,
      language,
      transcriptionProvider,
      members: {
        create: {
          userId: session.user.id,
          role: "HOST"
        }
      }
    }
  });

  return NextResponse.json({ id: meeting.id });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { createdById: session.user.id },
        { members: { some: { userId: session.user.id } } }
      ]
    },
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        where: { userId: session.user.id }
      }
    }
  });

  return NextResponse.json({ meetings });
}
