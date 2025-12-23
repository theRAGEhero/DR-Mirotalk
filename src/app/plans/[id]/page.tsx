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
            where: {
              OR: [{ userAId: session.user.id }, { userBId: session.user.id }]
            },
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

  const assignments = plan.rounds.flatMap((round) =>
    round.pairs.map((pair) => {
      const partnerEmail =
        pair.userAId === session.user.id
          ? pair.userB?.email ?? "Break"
          : pair.userA.email;

      return {
        roundNumber: round.roundNumber,
        roomId: pair.roomId,
        partnerLabel: partnerEmail,
        isBreak: !pair.userBId
      };
    })
  );

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
        assignments={assignments}
        baseUrl={process.env.MIROTALK_BASE_URL || ""}
        userEmail={session.user.email}
      />
    </div>
  );
}
