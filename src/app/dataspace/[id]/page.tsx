import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { DataspaceJoinLeave } from "@/app/dataspace/[id]/DataspaceJoinLeave";

export default async function DataspaceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const dataspace = await prisma.dataspace.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { email: true } },
      members: { include: { user: { select: { email: true } } } },
      meetings: { orderBy: { createdAt: "desc" } },
      plans: { orderBy: { startAt: "desc" } }
    }
  });

  if (!dataspace) {
    return <p className="text-sm text-slate-600">Dataspace not found.</p>;
  }

  const isMember = dataspace.members.some((member) => member.userId === session.user.id);
  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    dataspace.personalOwnerId === session.user.id || dataspace.createdById === session.user.id;

  if (!isAdmin && !isMember) {
    return <p className="text-sm text-slate-600">Access denied.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {dataspace.name}
          </h1>
          <p className="text-sm text-slate-600">{dataspace.description || "No description"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Created by {dataspace.createdBy.email} · {formatDateTime(dataspace.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DataspaceJoinLeave
            dataspaceId={dataspace.id}
            isMember={isMember}
            isAdmin={isAdmin}
            isPrivate={dataspace.isPrivate}
            isOwner={isOwner}
          />
          <Link href="/dataspace" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to dataspaces
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="dr-card p-6">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Meetings</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {dataspace.meetings.length === 0 ? (
              <p className="text-slate-500">No meetings yet.</p>
            ) : (
              dataspace.meetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-900">{meeting.title}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(meeting.createdAt)}</p>
                  </div>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="text-xs font-semibold text-slate-700 hover:underline"
                  >
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="dr-card p-6">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Members</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
              {dataspace.members.length === 0 ? (
                <span className="text-slate-500">No members yet.</span>
              ) : (
                dataspace.members.map((member) => (
                  <span key={member.id} className="rounded-full bg-white px-3 py-1">
                    {member.user.email}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="dr-card p-6">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Plans</h2>
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              {dataspace.plans.length === 0 ? (
                <p className="text-slate-500">No plans yet.</p>
              ) : (
                dataspace.plans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-900">{plan.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(plan.startAt)}</p>
                    </div>
                    <Link
                      href={`/plans/${plan.id}`}
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
