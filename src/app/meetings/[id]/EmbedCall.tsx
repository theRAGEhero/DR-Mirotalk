"use client";

import { useState } from "react";

type Props = {
  embedUrl: string;
  isActive: boolean;
  hasBaseUrl: boolean;
};

export function EmbedCall({ embedUrl, isActive, hasBaseUrl }: Props) {
  const [showEmbed, setShowEmbed] = useState(false);

  if (!hasBaseUrl) {
    return (
      <p className="mt-3 text-sm text-amber-600">
        MIROTALK_BASE_URL is not configured.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setShowEmbed((prev) => !prev)}
        className="dr-button-outline px-4 py-2 text-sm"
        disabled={!isActive}
      >
        {showEmbed ? "Hide call" : "Show call here"}
      </button>
      {showEmbed && isActive ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <iframe
            title="MiroTalk call"
            src={embedUrl}
            className="h-[520px] w-full"
            allow="camera; microphone; fullscreen"
          />
        </div>
      ) : null}
      {!isActive ? (
        <p className="mt-2 text-sm text-slate-500">Meeting is inactive or expired.</p>
      ) : null}
    </div>
  );
}
