import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkflowKey } from "@/app/api/integrations/workflow/utils";

export const dynamic = "force-dynamic";

const participantSchema = z.object({
  type: z.enum(["email", "id"]),
  value: z.string().min(1)
});

const createWorkflowPlanSchema = z.object({
  title: z.string().min(1),
  start_at: z.string().min(1),
  round_duration_minutes: z.number().int().positive().max(240),
  rounds_count: z.number().int().positive().max(100),
  sync_mode: z.enum(["SERVER", "CLIENT"]).default("SERVER"),
  max_participants_per_room: z.number().int().min(2).max(12).default(2),
  timezone: z.string().max(100).optional().nullable(),
  dataspace_id: z.string().optional().nullable(),
  participants: z.array(participantSchema).min(2),
  created_by_email: z.string().email().optional()
});

const listQuerySchema = z.object({
  dataspace_id: z.string().optional(),
  updated_since: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

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

export async function GET(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updatedSince = parsed.data.updated_since
    ? new Date(parsed.data.updated_since)
    : null;
  if (parsed.data.updated_since && (!updatedSince || Number.isNaN(updatedSince.getTime()))) {
    return NextResponse.json({ error: "Invalid updated_since" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (parsed.data.dataspace_id) {
    where.dataspaceId = parsed.data.dataspace_id;
  }
  if (updatedSince) {
    where.updatedAt = { gte: updatedSince };
  }

  const plans = await prisma.plan.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset,
    select: {
      id: true,
      title: true,
      dataspaceId: true,
      startAt: true,
      timezone: true,
      roundsCount: true,
      roundDurationMinutes: true,
      language: true,
      transcriptionProvider: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    plans: plans.map((plan: (typeof plans)[number]) => ({
      id: plan.id,
      title: plan.title,
      dataspaceId: plan.dataspaceId,
      startAt: plan.startAt.toISOString(),
      timezone: plan.timezone ?? null,
      roundsCount: plan.roundsCount,
      roundDurationMinutes: plan.roundDurationMinutes,
      language: plan.language,
      transcriptionProvider: plan.transcriptionProvider,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const authError = requireWorkflowKey(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = createWorkflowPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const startAt = new Date(parsed.data.start_at);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start_at" }, { status: 400 });
  }

  const creator =
    parsed.data.created_by_email
      ? await prisma.user.findUnique({ where: { email: parsed.data.created_by_email } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  if (parsed.data.dataspace_id) {
    const dataspace = await prisma.dataspace.findUnique({
      where: { id: parsed.data.dataspace_id },
      select: { id: true }
    });
    if (!dataspace) {
      return NextResponse.json({ error: "Dataspace not found" }, { status: 404 });
    }
  }

  const emailParticipants = parsed.data.participants
    .filter((participant) => participant.type === "email")
    .map((participant) => participant.value.toLowerCase());
  const idParticipants = parsed.data.participants
    .filter((participant) => participant.type === "id")
    .map((participant) => participant.value);

  const userFilters: Array<{ email?: { in: string[] }; id?: { in: string[] } }> = [];
  if (emailParticipants.length) {
    userFilters.push({ email: { in: emailParticipants } });
  }
  if (idParticipants.length) {
    userFilters.push({ id: { in: idParticipants } });
  }

  const users = await prisma.user.findMany({
    where: { OR: userFilters },
    select: { id: true }
  });

  if (users.length !== emailParticipants.length + idParticipants.length) {
    return NextResponse.json({ error: "Some participants were not found" }, { status: 404 });
  }

  if (users.length < 2) {
    return NextResponse.json({ error: "Not enough valid participants" }, { status: 400 });
  }

  const maxParticipantsPerRoom = parsed.data.max_participants_per_room;
  let rotation = users.map((user: (typeof users)[number]) => user.id);
  const roundsData = [] as Array<{
    roundNumber: number;
    pairs: Array<{ userAId: string; userBId: string | null; roomId: string }>;
  }>;

  for (let i = 0; i < parsed.data.rounds_count; i += 1) {
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
      createdById: creator.id,
      startAt,
      timezone: parsed.data.timezone || null,
      roundDurationMinutes: parsed.data.round_duration_minutes,
      roundsCount: parsed.data.rounds_count,
      syncMode: parsed.data.sync_mode,
      maxParticipantsPerRoom,
      dataspaceId: parsed.data.dataspace_id ?? null,
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

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3015";

  return NextResponse.json({
    plan_id: plan.id,
    plan_url: `${baseUrl}/plans/${plan.id}`
  });
}
