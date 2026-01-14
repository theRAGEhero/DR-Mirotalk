import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createMeetingSchema } from "@/lib/validators";
import { sendMail } from "@/lib/mailer";

export async function DELETE(
  _request: Request,
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

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some((member) => member.role === "HOST");
  const isCreator = meeting.createdById === session.user.id;

  if (!isAdmin && !isHost && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.meeting.delete({
    where: { id: meeting.id }
  });

  return NextResponse.json({ message: "Meeting deleted" });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const isAdmin = session.user.role === "ADMIN";
  const isHost = meeting.members.some((member) => member.role === "HOST");
  const isCreator = meeting.createdById === session.user.id;

  if (!isAdmin && !isHost && !isCreator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isConcluded =
    !meeting.isActive || (meeting.expiresAt ? meeting.expiresAt.getTime() < Date.now() : false);
  if (isConcluded) {
    return NextResponse.json({ error: "Meeting already concluded." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    title,
    description,
    date,
    startTime,
    durationMinutes,
    inviteEmails,
    language,
    transcriptionProvider,
    dataspaceId,
    isPublic,
    requiresApproval,
    capacity
  } = parsed.data;

  if (startTime && !date) {
    return NextResponse.json({ error: "Select a date for the start/end time." }, { status: 400 });
  }

  let scheduledStartAt: Date | null = null;
  let expiresAt: Date | null = null;

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
  if (isPublic && !dataspaceId) {
    return NextResponse.json({ error: "Public meetings require a dataspace." }, { status: 400 });
  }

  const emailList = (inviteEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  const uniqueEmails = Array.from(new Set(emailList)).filter(
    (email) => email !== session.user.email.toLowerCase()
  );

  let invitedUsers: Array<{ id: string; email: string }> = [];
  let missingUsers: string[] = [];

  if (uniqueEmails.length > 0) {
    invitedUsers = await prisma.user.findMany({
      where: { email: { in: uniqueEmails } },
      select: { id: true, email: true }
    });

    if (invitedUsers.length !== uniqueEmails.length) {
      const found = new Set(invitedUsers.map((user) => user.email));
      missingUsers = uniqueEmails.filter((email) => !found.has(email));
    }
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      title,
      description: description || null,
      scheduledStartAt,
      expiresAt,
      language,
      transcriptionProvider,
      dataspaceId: dataspaceId || null,
      isPublic: Boolean(isPublic),
      requiresApproval: Boolean(requiresApproval),
      capacity: capacity ?? null
    }
  });

  if (invitedUsers.length > 0) {
    for (const user of invitedUsers) {
      await prisma.meetingInvite.upsert({
        where: {
          meetingId_userId: {
            meetingId: meeting.id,
            userId: user.id
          }
        },
        update: { status: "PENDING" },
        create: {
          meetingId: meeting.id,
          userId: user.id,
          status: "PENDING"
        }
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    await Promise.all(
      invitedUsers.map((user) =>
        sendMail({
          to: user.email,
          subject: "You are invited to a meeting",
          html: `<p>You have been invited to the meeting <strong>${updated.title}</strong>.</p>
            <p>Open the meeting page: <a href="${appBaseUrl}/meetings/${updated.id}">${appBaseUrl}/meetings/${updated.id}</a></p>`,
          text: `You have been invited to the meeting ${updated.title}. Open: ${appBaseUrl}/meetings/${updated.id}`
        })
      )
    );
  }

  return NextResponse.json({ id: updated.id, missingUsers });
}
