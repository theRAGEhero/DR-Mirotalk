import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const plan = isAdmin
    ? await prisma.plan.findUnique({
        where: { id: params.id },
        select: { id: true }
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
                      OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
                    }
                  }
                }
              }
            },
            {
              participants: { some: { userId: session.user.id } }
            }
          ]
        },
        select: { id: true }
      });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const sessions = await prisma.planMeditationSession.findMany({
    where: {
      planId: plan.id,
      userId: session.user.id
    },
    orderBy: { meditationIndex: "asc" },
    select: {
      id: true,
      meditationIndex: true,
      roundAfter: true,
      transcriptText: true,
      createdAt: true
    }
  });

  return NextResponse.json({ sessions });
}
