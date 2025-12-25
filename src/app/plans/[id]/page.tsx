import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ParticipantViewClient } from "@/app/plans/[id]/ParticipantViewClient";

export default async function PlanParticipantPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: {
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          pairs: {
            include: {
              userA: { select: { email: true } },
              userB: { select: { email: true } }
            }
          }
        }
      }
    }
  });

  if (!plan) {
    return <p className="text-sm text-slate-600">Plan not found.</p>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const isParticipant = plan.rounds.some((round) =>
    round.pairs.some(
      (pair) => pair.userAId === session.user.id || pair.userBId === session.user.id
    )
  );

  if (!isAdmin && !isParticipant) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  const assignments = plan.rounds.map((round) => {
    const rooms = new Map<string, string[]>();
    round.pairs.forEach((pair) => {
      if (!rooms.has(pair.roomId)) {
        rooms.set(pair.roomId, []);
      }
      const list = rooms.get(pair.roomId) ?? [];
      if (pair.userA?.email) list.push(pair.userA.email);
      if (pair.userB?.email) list.push(pair.userB.email);
      rooms.set(pair.roomId, list);
    });

    const userEmail = session.user.email;
    let assignedRoomId = "";
    let partnerLabel = "Break";
    let isBreak = true;

    for (const [roomId, participants] of rooms.entries()) {
      if (participants.includes(userEmail)) {
        assignedRoomId = roomId;
        const partners = participants.filter((email) => email !== userEmail);
        partnerLabel = partners.length ? partners.join(", ") : "Break";
        isBreak = partners.length === 0;
        break;
      }
    }

    return {
      roundNumber: round.roundNumber,
      roomId: assignedRoomId,
      partnerLabel,
      isBreak
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Plan Participant View
        </h1>
        <p className="text-sm text-slate-600">Personalized call link and round status.</p>
      </div>
      <ParticipantViewClient
        planId={plan.id}
        startAt={plan.startAt.toISOString()}
        roundDurationMinutes={plan.roundDurationMinutes}
        roundsCount={plan.roundsCount}
        syncMode={plan.syncMode}
        assignments={assignments}
        baseUrl={process.env.MIROTALK_BASE_URL || ""}
        userEmail={session.user.email}
      />
    </div>
  );
}
