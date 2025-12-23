import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MeetingsTable } from "@/app/dashboard/MeetingsTable";
import { formatDateTime, isMeetingActive } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { createdById: session.user.id },
        { members: { some: { userId: session.user.id } } }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  const rows = meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    statusLabel: isMeetingActive(meeting) ? "Active" : "Expired",
    expiresLabel: formatDateTime(meeting.expiresAt),
    canDelete: session.user.role === "ADMIN" || meeting.createdById === session.user.id
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <MeetingsTable initialMeetings={rows} />
    </div>
  );
}
