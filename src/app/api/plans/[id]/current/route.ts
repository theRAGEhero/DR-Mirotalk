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
        select: { id: true, startAt: true, roundsCount: true, roundDurationMinutes: true }
      })
    : await prisma.plan.findFirst({
        where: {
          id: params.id,
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
        select: { id: true, startAt: true, roundsCount: true, roundDurationMinutes: true }
      });

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const now = new Date();
  const roundDurationMs = plan.roundDurationMinutes * 60 * 1000;
  const elapsed = now.getTime() - plan.startAt.getTime();
  const currentRoundIndex = Math.floor(elapsed / roundDurationMs) + 1;

  let status: "pending" | "active" | "done" = "pending";
  if (elapsed >= 0 && currentRoundIndex <= plan.roundsCount) {
    status = "active";
  } else if (currentRoundIndex > plan.roundsCount) {
    status = "done";
  }

  const currentRound = Math.min(Math.max(currentRoundIndex, 1), plan.roundsCount);

  return NextResponse.json({
    serverNow: now.toISOString(),
    status,
    currentRound
  });
}
