import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, isMeetingActive } from "@/lib/utils";
import { EmbedCall } from "@/app/meetings/[id]/EmbedCall";
import { MeetingActions } from "@/app/meetings/[id]/MeetingActions";
import { TranscriptionPanel } from "@/app/meetings/[id]/TranscriptionPanel";

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
  const canAccess = isAdmin || Boolean(membership);

  if (!canAccess) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
            {meeting.title}
          </h1>
          <p className="text-sm text-slate-500">Meeting room: {meeting.roomId}</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="dr-card p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
            <p className={active ? "text-emerald-600" : "text-slate-400"}>
              {active ? "Active" : "Expired"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Expires</p>
            <p className="text-sm text-slate-700">{formatDateTime(meeting.expiresAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Host</p>
            <p className="text-sm text-slate-700">
              {meeting.members.find((member) => member.role === "HOST")?.user.email ??
                "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Language</p>
            <p className="text-sm text-slate-700">{meeting.language}</p>
            <p className="mt-1 text-xs text-slate-500">
              {meeting.transcriptionProvider === "VOSK"
                ? "Vosk (privacy friendly)"
                : "Deepgram"}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center px-4 py-2 text-sm ${
              active ? "dr-button" : "rounded bg-slate-300 px-4 py-2 text-sm font-semibold text-white"
            }`}
            aria-disabled={!active}
          >
            Join call
          </a>
          <EmbedCall embedUrl={embedUrl} isActive={active} hasBaseUrl={Boolean(baseUrl)} />
        </div>
      </div>

      <MeetingActions meetingId={meeting.id} canManage={canManage} isActive={meeting.isActive} />
      <TranscriptionPanel
        meetingId={meeting.id}
        canManage={canManage}
        initialRoundId={meeting.transcriptionRoundId}
      />
    </div>
  );
}
