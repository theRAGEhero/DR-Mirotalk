import { NewMeetingForm } from "@/app/meetings/new/NewMeetingForm";

export default function NewMeetingPage() {
  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          New meeting
        </h1>
        <p className="text-sm text-slate-500">Create a new MiroTalk room link.</p>
      </div>
      <div className="dr-card p-6">
        <NewMeetingForm />
      </div>
    </div>
  );
}
