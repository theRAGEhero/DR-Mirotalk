import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { formatDateTime, isMeetingActive } from "@/lib/utils";

export default async function GlobalDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const [meetings, dataspaces] = await Promise.all([
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { email: true } },
        dataspace: { select: { id: true, name: true, personalOwnerId: true } }
      }
    }),
    prisma.dataspace.findMany({
      where: { isPrivate: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
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
    createdByEmail: meeting.createdBy.email,
    canDelete: true
  }));

  const dataspaceOptions = [
    { key: "personal", label: "My Data Space" },
    { key: "none", label: "No dataspace" },
    ...dataspaces.map((dataspace) => ({ key: dataspace.id, label: dataspace.name }))
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Global dashboard
        </h1>
        <p className="text-sm text-slate-600">All meetings across the platform.</p>
      </div>
      <MeetingsTable initialMeetings={rows} dataspaceOptions={dataspaceOptions} showCreatedBy />
    </div>
  );
}
