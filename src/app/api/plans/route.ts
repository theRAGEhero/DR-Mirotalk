import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createPlanSchema } from "@/lib/validators";
import crypto from "crypto";

function generateRoomId() {
  return crypto.randomBytes(16).toString("base64url");
}

function makePairs(userIds: string[]) {
  const list = [...userIds];
  if (list.length % 2 === 1) list.push("__break__");

  const pairs: Array<[string, string | null]> = [];
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1] ?? null;
    pairs.push([a, b === "__break__" ? null : b]);
  }
  return pairs;
}

function rotate(userIds: string[]) {
  if (userIds.length <= 2) return userIds;
  const [first, ...rest] = userIds;
  const last = rest.pop();
  if (!last) return userIds;
  return [first, last, ...rest];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: parsed.data.participantIds } },
    select: { id: true }
  });

  if (users.length < 2) {
    return NextResponse.json({ error: "Not enough valid participants" }, { status: 400 });
  }

  let rotation = users.map((user) => user.id);
  const roundsData = [] as Array<{ roundNumber: number; pairs: Array<{ userAId: string; userBId: string | null; roomId: string }> }>;

  for (let i = 0; i < parsed.data.roundsCount; i += 1) {
    const pairs = makePairs(rotation).map(([userAId, userBId]) => ({
      userAId,
      userBId,
      roomId: generateRoomId()
    }));
    roundsData.push({ roundNumber: i + 1, pairs });
    rotation = rotate(rotation);
  }

  const plan = await prisma.plan.create({
    data: {
      title: parsed.data.title,
      createdById: session.user.id,
      startAt,
      roundDurationMinutes: parsed.data.roundDurationMinutes,
      roundsCount: parsed.data.roundsCount,
      rounds: {
        create: roundsData.map((round) => ({
          roundNumber: round.roundNumber,
          pairs: {
            create: round.pairs.map((pair) => ({
              roomId: pair.roomId,
              userAId: pair.userAId,
              userBId: pair.userBId
            }))
          }
        }))
      }
    }
  });

  return NextResponse.json({ id: plan.id });
}
