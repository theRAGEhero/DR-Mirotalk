import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { EmbedCall } from "@/app/meetings/[id]/EmbedCall";
import { MeetingActions } from "@/app/meetings/[id]/MeetingActions";
import { TranscriptionAutoLink } from "@/app/meetings/[id]/TranscriptionAutoLink";
import { MeetingInviteActions } from "@/app/meetings/[id]/MeetingInviteActions";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { user: true }
      }
    }
  });

  if (!meeting) {
    return <div className="text-sm text-slate-500">Meeting not found.</div>;
  }

  const isAdmin = session.user.role === "ADMIN";
  const membership = meeting.members.find((member) => member.userId === session.user.id);
  const pendingInvite = await prisma.meetingInvite.findUnique({
    where: {
      meetingId_userId: {
        meetingId: params.id,
        userId: session.user.id
      }
    }
  });

  const canAccess = isAdmin || Boolean(membership) || pendingInvite?.status === "ACCEPTED";

  if (!canAccess) {
    if (pendingInvite?.status === "PENDING") {
      return (
        <MeetingInviteActions
          inviteId={pendingInvite.id}
          meetingTitle={meeting.title}
          hostEmail={
            meeting.members.find((member) => member.role === "HOST")?.user.email ?? "Host"
          }
        />
      );
    }
    return <div className="text-sm text-slate-500">You do not have access to this meeting.</div>;
  }

  const canManage = isAdmin || membership?.role === "HOST";
  const active = isMeetingActive(meeting);
  const baseUrl = process.env.MIROTALK_BASE_URL || "";
  const langCode = meeting.language === "IT" ? "it" : "en";
  const providerCode = meeting.transcriptionProvider === "VOSK" ? "vosk" : "deepgram";
  const embedUrl = `${baseUrl}/join/${meeting.roomId}?name=${encodeURIComponent(
    session.user.email
  )}&notify=0&lang=${langCode}&transcriber=${providerCode}`;
  const joinUrl = embedUrl;

  const statusLabel = active ? "Active" : "Expired";
  const languageLabel = meeting.language;
  const providerLabel =
    meeting.transcriptionProvider === "VOSK" ? "Vosk (privacy friendly)" : "Deepgram";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {meeting.title}
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>

      <EmbedCall
        embedUrl={embedUrl}
        isActive={active}
        hasBaseUrl={Boolean(baseUrl)}
        statusLabel={statusLabel}
        languageLabel={languageLabel}
        providerLabel={providerLabel}
        joinUrl={joinUrl}
        meetingId={meeting.id}
        canManage={canManage}
      />

      <div className="dr-card p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Expires</p>
            <p className="text-sm text-slate-700">{formatDateTime(meeting.expiresAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Starts</p>
            <p className="text-sm text-slate-700">
              {meeting.scheduledStartAt ? formatDateTime(meeting.scheduledStartAt) : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Host</p>
            <p className="text-sm text-slate-700">
              {meeting.members.find((member) => member.role === "HOST")?.user.email ??
                "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Room</p>
            <p className="text-sm text-slate-700 break-all">{meeting.roomId}</p>
          </div>
        </div>
      </div>

      <MeetingActions meetingId={meeting.id} canManage={canManage} isActive={meeting.isActive} />
      <TranscriptionAutoLink
        meetingId={meeting.id}
        canManage={canManage}
        initialRoundId={meeting.transcriptionRoundId}
      />
    </div>
  );
}
