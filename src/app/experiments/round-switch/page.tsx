import { RoundSwitchClient } from "@/app/experiments/round-switch/RoundSwitchClient";
import { prisma } from "@/lib/prisma";

export default async function RoundSwitchPage() {
  const baseUrl = process.env.MIROTALK_BASE_URL || "";
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { email: true }
  });
  const participants = users.map((user) => user.email);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Room Switch Experiment
        </h1>
        <p className="text-sm text-slate-600">
          Prototype for timed 1v1 rounds with rotating room links.
        </p>
      </div>
      <RoundSwitchClient
        baseUrl={baseUrl}
        defaultDurationMinutes={10}
        initialParticipants={participants}
      />
    </div>
  );
}
