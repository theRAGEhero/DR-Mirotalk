import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createPlanSchema } from "@/lib/validators";
import crypto from "crypto";

function generateRoomId() {
  return crypto.randomBytes(16).toString("base64url");
}

function makeGroups(userIds: string[], maxParticipantsPerRoom: number) {
  const list = [...userIds];
  if (maxParticipantsPerRoom === 2 && list.length % 2 === 1) {
    list.push("__break__");
  }

  const groups: Array<string[]> = [];
  for (let i = 0; i < list.length; i += maxParticipantsPerRoom) {
    groups.push(list.slice(i, i + maxParticipantsPerRoom));
  }
  return groups;
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

  if (parsed.data.dataspaceId) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: parsed.data.dataspaceId },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
    }
  }

  const maxParticipantsPerRoom = parsed.data.maxParticipantsPerRoom;
  let rotation = users.map((user) => user.id);
  const roundsData = [] as Array<{
    roundNumber: number;
    pairs: Array<{ userAId: string; userBId: string | null; roomId: string }>;
  }>;

  for (let i = 0; i < parsed.data.roundsCount; i += 1) {
    const groups = makeGroups(rotation, maxParticipantsPerRoom);
    const pairs = groups.flatMap((group) => {
      const roomId = generateRoomId();
      const roomPairs: Array<{ userAId: string; userBId: string | null; roomId: string }> = [];

      for (let index = 0; index < group.length; index += 2) {
        const userAId = group[index];
        if (userAId === "__break__") continue;
        const userBId = group[index + 1] ?? null;
        roomPairs.push({
          userAId,
          userBId: userBId === "__break__" ? null : userBId,
          roomId
        });
      }

      return roomPairs;
    });
    roundsData.push({ roundNumber: i + 1, pairs });
    rotation = rotate(rotation);
  }

  const plan = await prisma.plan.create({
    data: {
      title: parsed.data.title,
      createdById: session.user.id,
      dataspaceId: parsed.data.dataspaceId ?? null,
      startAt,
      roundDurationMinutes: parsed.data.roundDurationMinutes,
      roundsCount: parsed.data.roundsCount,
      syncMode: parsed.data.syncMode,
      maxParticipantsPerRoom,
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
