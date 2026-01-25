"use client";

import { useState } from "react";

const DEFAULT_PROMPT =
  "Analyze the plan recap and highlight key themes, agreements, disagreements, and notable quotes.";

type PlanAnalysisPanelProps = {
  planId: string;
  initialAnalysis?: {
    analysis: string;
    prompt: string;
    provider: string;
    createdAt: string;
  } | null;
};

export function PlanAnalysisPanel({ planId, initialAnalysis }: PlanAnalysisPanelProps) {
  const [prompt, setPrompt] = useState(initialAnalysis?.prompt ?? DEFAULT_PROMPT);
  const [provider, setProvider] = useState<"gemini" | "ollama">(
    (initialAnalysis?.provider as "gemini" | "ollama") ?? "gemini"
  );
  const [analysis, setAnalysis] = useState(initialAnalysis?.analysis ?? "");
  const [createdAt, setCreatedAt] = useState(initialAnalysis?.createdAt ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/plans/${planId}/analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt, provider })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to analyze plan.");
      }

      const payload = await response.json();
      setAnalysis(payload.analysis ?? "");
      setCreatedAt(payload.createdAt ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dr-card space-y-4 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Plan analysis
          </p>
          <h2
            className="text-lg font-semibold text-slate-900"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Analysis Prompt
          </h2>
          <p className="text-sm text-slate-600">
            Shape the AI focus and guide the highlights you want to see.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={provider === "gemini" ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
            onClick={() => setProvider("gemini")}
          >
            Gemini
          </button>
          <button
            type="button"
            className={provider === "ollama" ? "dr-button px-3 py-1 text-xs" : "dr-button-outline px-3 py-1 text-xs"}
            onClick={() => setProvider("ollama")}
          >
            Ollama
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Prompt
        </label>
        <textarea
          className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="dr-button px-4 py-2 text-sm"
          onClick={handleAnalyze}
          disabled={isLoading || prompt.trim().length === 0}
        >
          {isLoading ? "Analyzing..." : "Run analysis"}
        </button>
        {createdAt ? (
          <span className="text-xs text-slate-500">Last run: {new Date(createdAt).toLocaleString()}</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {analysis ? (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {analysis}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No analysis yet.</p>
      )}
    </div>
  );
}
