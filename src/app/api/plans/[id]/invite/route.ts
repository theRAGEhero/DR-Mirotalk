import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { inviteMemberSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      rounds: { select: { id: true } }
    }
  });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = plan.createdById === session.user.id;
  let isDataspaceMember = false;

  if (plan.dataspaceId) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: plan.dataspaceId,
          userId: session.user.id
        }
      }
    });
    isDataspaceMember = Boolean(member);
  }

  if (!isAdmin && !isOwner && !(plan.isPublic && isDataspaceMember)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const targetEmail = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (plan.dataspaceId) {
    const member = await prisma.dataspaceMember.findUnique({
      where: {
        dataspaceId_userId: {
          dataspaceId: plan.dataspaceId,
          userId: user.id
        }
      }
    });
    if (!member) {
      return NextResponse.json({ error: "User is not in the dataspace" }, { status: 400 });
    }
  }

  const fixedParticipant = await prisma.planPair.findFirst({
    where: {
      planRound: { planId: plan.id },
      OR: [{ userAId: user.id }, { userBId: user.id }]
    },
    select: { id: true }
  });

  if (fixedParticipant) {
    return NextResponse.json({ message: "User is already assigned to the plan" });
  }

  const existingParticipant = await prisma.planParticipant.findUnique({
    where: {
      planId_userId: {
        planId: plan.id,
        userId: user.id
      }
    }
  });

  if (!existingParticipant) {
    const approvedCount = await prisma.planParticipant.count({
      where: {
        planId: plan.id,
        status: "APPROVED"
      }
    });
    const fixedPairs = await prisma.planPair.findMany({
      where: { planRound: { planId: plan.id } },
      select: { userAId: true, userBId: true }
    });
    const fixedUsers = new Set<string>();
    fixedPairs.forEach((pair: (typeof fixedPairs)[number]) => {
      fixedUsers.add(pair.userAId);
      if (pair.userBId) fixedUsers.add(pair.userBId);
    });

    if (!plan.requiresApproval && plan.capacity && approvedCount + fixedUsers.size >= plan.capacity) {
      return NextResponse.json({ error: "Plan is full" }, { status: 400 });
    }

    await prisma.planParticipant.create({
      data: {
        planId: plan.id,
        userId: user.id,
        status: plan.requiresApproval ? "PENDING" : "APPROVED"
      }
    });
  }

  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3015";
  const emailResult = await sendMail({
    to: user.email,
    subject: "You are invited to a plan",
    html: `<p>You have been invited to the plan <strong>${plan.title}</strong>.</p>
      <p>Open the plan: <a href="${appBaseUrl}/plans/${plan.id}">${appBaseUrl}/plans/${plan.id}</a></p>`,
    text: `You have been invited to the plan ${plan.title}. Open: ${appBaseUrl}/plans/${plan.id}`
  });

  return NextResponse.json({
    message: "Invite sent",
    emailSent: emailResult.ok
  });
}
