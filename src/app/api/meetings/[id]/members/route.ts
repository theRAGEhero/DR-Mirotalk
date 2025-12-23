import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/validators";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

  if (!isAdmin && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitee = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!invitee) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.meetingMember.findUnique({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: invitee.id
      }
    }
  });

  if (existing) {
    return NextResponse.json({ message: "User already invited" });
  }

  await prisma.meetingMember.create({
    data: {
      meetingId: meeting.id,
      userId: invitee.id,
      role: "GUEST"
    }
  });

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const emailResult = await sendMail({
    to: invitee.email,
    subject: "You are invited to a meeting",
    html: `<p>You have been invited to the meeting <strong>${meeting.title}</strong>.</p>
      <p>Open the meeting page: <a href="${appBaseUrl}/meetings/${meeting.id}">${appBaseUrl}/meetings/${meeting.id}</a></p>`,
    text: `You have been invited to the meeting ${meeting.title}. Open: ${appBaseUrl}/meetings/${meeting.id}`
  });

  return NextResponse.json({
    message: "User invited",
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error
  });
}
