import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMeetingSchema } from "@/lib/validators";
import { getSession } from "@/lib/session";
import { generateRoomId } from "@/lib/utils";
import { sendMail } from "@/lib/mailer";

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

  const {
    title,
    date,
    startTime,
    durationMinutes,
    inviteEmails,
    language,
    transcriptionProvider,
    dataspaceId
  } = parsed.data;
  const providerLabel = transcriptionProvider === "VOSK" ? "Vosk" : "Deepgram";
  const roomId = `${generateRoomId()}-${language}-${providerLabel}`;
  let scheduledStartAt: Date | null = null;
  let expiresAt: Date | null = null;

  if (startTime && !date) {
    return NextResponse.json({ error: "Select a date for the start/end time." }, { status: 400 });
  }

  if (date && startTime) {
    const start = new Date(`${date}T${startTime}`);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    scheduledStartAt = start;
  }

  if (durationMinutes) {
    if (scheduledStartAt) {
      expiresAt = new Date(scheduledStartAt.getTime() + durationMinutes * 60 * 1000);
    } else {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    }
  }

  if (dataspaceId) {
    const membership = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId,
          userId: session.user.id
        }
      }
    });
    if (!membership) {
      return NextResponse.json({ error: "Invalid dataspace selection" }, { status: 403 });
    }
  }

  const emailList = (inviteEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  const uniqueEmails = Array.from(new Set(emailList)).filter(
    (email) => email !== session.user.email.toLowerCase()
  );

  let invitedUsers: Array<{ id: string; email: string }> = [];

  if (uniqueEmails.length > 0) {
    invitedUsers = await prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: { id: true, email: true }
    });

    if (invitedUsers.length !== uniqueEmails.length) {
      const found = new Set(invitedUsers.map((user) => user.email));
      const missing = uniqueEmails.filter((email) => !found.has(email));
      return NextResponse.json(
        { error: `Users not found: ${missing.join(", ")}` },
        { status: 404 }
      );
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      roomId,
      createdById: session.user.id,
      scheduledStartAt,
      expiresAt,
      language,
      transcriptionProvider,
      dataspaceId: dataspaceId || null,
      members: {
        create: {
          userId: session.user.id,
          role: "HOST"
        }
      }
    }
  });

  if (invitedUsers.length > 0) {
    await prisma.meetingInvite.createMany({
      data: invitedUsers.map((user) => ({
        meetingId: meeting.id,
        userId: user.id,
        status: "PENDING"
      })),
      skipDuplicates: true
    });

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    await Promise.all(
      invitedUsers.map((user) =>
        sendMail({
          to: user.email,
          subject: "You are invited to a meeting",
          html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
            <p>Open the meeting page: <a href="${appBaseUrl}/meetings/${meeting.id}">${appBaseUrl}/meetings/${meeting.id}</a></p>`,
          text: `You have been invited to the meeting ${meeting.title}. Open: ${appBaseUrl}/meetings/${meeting.id}`
        })
      )
    );
  }

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
