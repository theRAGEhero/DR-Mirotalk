import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { UpcomingInvites } from "@/app/dashboard/UpcomingInvites";
import { formatDateTime, isMeetingActive } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const [meetings, dataspaces, invites] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        OR: [
          { createdById: session.user.id },
          { members: { some: { userId: session.user.id } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: { dataspace: { select: { id: true, name: true, personalOwnerId: true } } }
    }),
    prisma.dataspace.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { personalOwnerId: session.user.id },
          { members: { some: { userId: session.user.id } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, personalOwnerId: true }
    }),
    prisma.meetingInvite.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      include: {
        meeting: {
          include: { createdBy: { select: { email: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const rows = meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    statusLabel: isMeetingActive(meeting) ? "Active" : "Expired",
    expiresLabel: formatDateTime(meeting.expiresAt),
    language: meeting.language,
    providerLabel: meeting.transcriptionProvider === "VOSK" ? "Vosk" : "Deepgram",
    dataspaceLabel:
      meeting.dataspace?.personalOwnerId === session.user.id
        ? "My Data Space"
        : meeting.dataspace?.name ?? "No dataspace",
    dataspaceKey:
      meeting.dataspace?.personalOwnerId === session.user.id
        ? "personal"
        : meeting.dataspace?.id ?? "none",
    canDelete: session.user.role === "ADMIN" || meeting.createdById === session.user.id
  }));

  const now = new Date();
  const upcomingMeetings = meetings
    .filter((meeting) => meeting.scheduledStartAt && meeting.scheduledStartAt > now)
    .sort((a, b) => (a.scheduledStartAt?.getTime() ?? 0) - (b.scheduledStartAt?.getTime() ?? 0))
    .slice(0, 5);

  const upcomingInvites = invites
    .filter((invite) => {
      const startAt = invite.meeting.scheduledStartAt;
      return !startAt || startAt > now;
    })
    .slice(0, 5)
    .map((invite) => ({
      id: invite.id,
      meetingId: invite.meetingId,
      title: invite.meeting.title,
      hostEmail: invite.meeting.createdBy.email,
      scheduledStartAt: invite.meeting.scheduledStartAt
        ? invite.meeting.scheduledStartAt.toISOString()
        : null
    }));

  const dataspaceOptions = [
    { key: "personal", label: "My Data Space" },
    { key: "none", label: "No dataspace" },
    ...dataspaces
      .filter((dataspace) => !dataspace.personalOwnerId)
      .map((dataspace) => ({ key: dataspace.id, label: dataspace.name }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">Your upcoming MiroTalk meetings.</p>
        </div>
        <Link href="/meetings/new" className="dr-button px-4 py-2 text-sm">
          New meeting
        </Link>
      </div>

      <div className="dr-card p-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Upcoming calls</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          {upcomingMeetings.length === 0 ? (
            <p className="text-slate-500">No upcoming calls scheduled.</p>
          ) : (
            upcomingMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-white/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-900">{meeting.title}</p>
                  <p className="text-xs text-slate-500">
                    {meeting.scheduledStartAt ? formatDateTime(meeting.scheduledStartAt) : "-"}
                  </p>
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

      <UpcomingInvites
        invites={upcomingInvites}
      />

      <MeetingsTable initialMeetings={rows} dataspaceOptions={dataspaceOptions} />
    </div>
  );
}
