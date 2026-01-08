import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isMeetingActive } from "@/lib/utils";

export default async function GuestMeetingPage({
  params
}: {
  params: { token: string };
}) {
  const invite = await prisma.meetingGuestInvite.findUnique({
    where: { token: params.token },
    include: {
      meeting: true
    }
  });

  if (!invite) {
    return (
      <div className="dr-card mx-auto mt-16 w-full max-w-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900">Invite not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invite link is invalid or expired.
        </p>
        <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-slate-700 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  const meeting = invite.meeting;
  const active = isMeetingActive(meeting);
  const baseUrl = process.env.MIROTALK_BASE_URL || "";
  const langCode = meeting.language === "IT" ? "it" : "en";
  const providerCode = meeting.transcriptionProvider === "VOSK" ? "vosk" : "deepgram";
  const joinUrl = `${baseUrl}/join/${meeting.roomId}?name=${encodeURIComponent(
    invite.email
  )}&notify=0&lang=${langCode}&transcriber=${providerCode}`;

  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Guest invite
        </p>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          {meeting.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You are invited as <span className="font-semibold">{invite.email}</span>.
        </p>
      </div>

      <div className="dr-card p-6">
        {active ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Join the call without registration.
            </p>
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="dr-button inline-flex px-4 py-2 text-sm"
            >
              Join on MiroTalk
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            This meeting is no longer active.
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Prefer to register? <Link href="/register" className="font-semibold text-slate-700 hover:underline">Create an account</Link>
      </p>
    </div>
  );
}
