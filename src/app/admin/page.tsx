import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegistrationSettings } from "@/app/admin/RegistrationSettings";
import { TranscriptionJobsTable } from "@/app/admin/TranscriptionJobsTable";
import { AdminInbox } from "@/app/admin/AdminInbox";
import { AdminFeedbackList } from "@/app/admin/AdminFeedbackList";

type ServiceStatus = {
  label: string;
  baseUrl: string;
  status: "online" | "offline" | "unknown";
  detail: string;
};

async function checkService(label: string, baseUrl: string | undefined): Promise<ServiceStatus> {
  if (!baseUrl) {
    return { label, baseUrl: "", status: "unknown", detail: "Not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/rounds`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      return { label, baseUrl, status: "online", detail: "OK" };
    }
    return { label, baseUrl, status: "offline", detail: `HTTP ${response.status}` };
  } catch (error) {
    clearTimeout(timeout);
    return { label, baseUrl, status: "offline", detail: "Unreachable" };
  }
}

export default async function AdminHomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-slate-500">Access denied.</p>;
  }

  const [usersCount, meetingsCount, deepgramStatus, voskStatus, jobs] = await Promise.all([
    prisma.user.count(),
    prisma.meeting.count({ where: { isHidden: false } }),
    checkService("Deepgram-modular", process.env.DEEPGRAM_BASE_URL),
    checkService("Vosk-modular", process.env.VOSK_BASE_URL),
    prisma.transcriptionJob.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        meeting: { select: { id: true, title: true } },
        plan: { select: { id: true, title: true } },
        user: { select: { email: true } }
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Admin
        </h1>
        <p className="text-sm text-slate-600">Quick overview and shortcuts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{usersCount}</p>
          <Link href="/admin/users" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">
            Manage users
          </Link>
        </div>
        <div className="dr-card p-6">
          <p className="text-xs font-semibold uppercase text-slate-500">Meetings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{meetingsCount}</p>
          <Link
            href="/admin/global-dashboard"
            className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline"
          >
            View global dashboard
          </Link>
        </div>
      </div>

      <div className="dr-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Admin shortcuts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link href="/admin/users" className="dr-button-outline px-4 py-2 text-sm text-center">
            Users
          </Link>
          <Link href="/admin/global-dashboard" className="dr-button-outline px-4 py-2 text-sm text-center">
            Global dashboard
          </Link>
          <Link href="/plans/new" className="dr-button-outline px-4 py-2 text-sm text-center">
            Create plan
          </Link>
        </div>
      </div>

      <div className="dr-card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Transcription services</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[deepgramStatus, voskStatus].map((service) => (
            <div
              key={service.label}
              className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{service.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {service.baseUrl || "No base URL set"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    service.status === "online"
                      ? "bg-emerald-100 text-emerald-700"
                      : service.status === "offline"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {service.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-600">Status: {service.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <TranscriptionJobsTable
        initialJobs={jobs.map((job) => ({
          id: job.id,
          kind: job.kind,
          status: job.status,
          provider: job.provider,
          roundId: job.roundId,
          meditationIndex: job.meditationIndex,
          attempts: job.attempts,
          lastError: job.lastError,
          lastAttemptAt: job.lastAttemptAt ? job.lastAttemptAt.toISOString() : null,
          updatedAt: job.updatedAt.toISOString(),
          meeting: job.meeting,
          plan: job.plan,
          userEmail: job.user?.email ?? null
        }))}
      />

      <AdminInbox />

      <AdminFeedbackList />

      <RegistrationSettings />
    </div>
  );
}
