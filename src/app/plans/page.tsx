import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

function getPlanEndTime(startAt: Date, roundsCount: number, roundDurationMinutes: number) {
  return new Date(startAt.getTime() + roundsCount * roundDurationMinutes * 60 * 1000);
}

export default async function PlansPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const plans = await prisma.plan.findMany({
    orderBy: { startAt: "desc" },
    include: { createdBy: { select: { email: true } } }
  });

  const now = new Date();
  const plansWithEnd = plans.map((plan) => ({
    plan,
    endAt: getPlanEndTime(plan.startAt, plan.roundsCount, plan.roundDurationMinutes)
  }));

  const upcomingPlans = plansWithEnd.filter(({ plan }) => plan.startAt > now);
  const activePlans = plansWithEnd.filter(({ plan, endAt }) => plan.startAt <= now && endAt >= now);
  const finishedPlans = plansWithEnd.filter(({ endAt }) => endAt < now);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Plans
          </h1>
          <p className="text-sm text-slate-600">
            Upcoming, active, and finished rotation plans.
          </p>
        </div>
        <Link href="/plans/new" className="dr-button px-4 py-2 text-sm">
          New plan
        </Link>
      </div>

      <div className="space-y-4">
        {[
          { label: "Upcoming", items: upcomingPlans, empty: "No upcoming plans." },
          { label: "Active", items: activePlans, empty: "No active plans right now." },
          { label: "Finished", items: finishedPlans, empty: "No finished plans yet." }
        ].map((section) => (
          <div key={section.label} className="dr-card">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase text-slate-500">{section.label}</h2>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-6 gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                  <span className="col-span-2">Title</span>
                  <span>Starts</span>
                  <span>Ends</span>
                  <span>Rounds</span>
                  <span>Created by</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {section.items.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500">{section.empty}</div>
                  ) : (
                    section.items.map(({ plan, endAt }) => (
                      <div key={plan.id} className="grid grid-cols-6 gap-4 px-4 py-4 text-sm">
                        <div className="col-span-2">
                          <Link
                            href={`/plans/${plan.id}`}
                            className="font-medium text-slate-900 hover:underline"
                          >
                            {plan.title}
                          </Link>
                        </div>
                        <div className="text-slate-600">{formatDateTime(plan.startAt)}</div>
                        <div className="text-slate-600">{formatDateTime(endAt)}</div>
                        <div className="text-slate-600">{plan.roundsCount}</div>
                        <div className="text-slate-600">{plan.createdBy.email}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
