"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  const pagePath = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setStatus("idle");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, pagePath })
    });
    setSending(false);
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setStatus("sent");
    setMessage("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
      >
        Leave feedback
      </button>
      {open ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_30px_70px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Feedback</p>
                <p className="text-lg font-semibold text-slate-900">Share your thoughts</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Page: {pagePath}</p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="dr-input min-h-[140px] w-full rounded px-3 py-2 text-sm"
                placeholder="What should we improve or fix?"
                required
              />
              {status === "sent" ? (
                <p className="text-sm text-emerald-600">Thanks! Feedback sent.</p>
              ) : null}
              {status === "error" ? (
                <p className="text-sm text-red-600">Unable to send feedback.</p>
              ) : null}
              <div className="flex items-center justify-between">
                <button type="submit" className="dr-button px-4 py-2 text-sm" disabled={sending}>
                  {sending ? "Sending..." : "Send feedback"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
