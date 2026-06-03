"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VIDEO_MODEL,
} from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";

// The Storyboard mode entry. Creates a fresh project on click (not on render, so
// link prefetch can't spawn stray projects) and drops into the storyboard board.
export function NewStoryboardCard({ accent }: { accent: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled storyboard",
          targetLengthS: 30,
          aspectRatio: "R16_9",
          resolution: "R720P",
          shotCount: 5,
          audioMode: "NONE",
          llmModel: DEFAULT_LLM_MODEL,
          videoModel: DEFAULT_VIDEO_MODEL,
          ttsModel: DEFAULT_TTS_MODEL,
        }),
      });
      router.push(`/storyboard/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="squish-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center disabled:opacity-70"
    >
      <span
        aria-hidden
        className="squish-bar pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase("/slop/videoslop.png")}
        alt=""
        aria-hidden
        className="squish-icon mb-3 h-20 w-auto object-contain drop-shadow"
      />
      <h2 className="squish-title text-lg font-semibold">Storyboard</h2>
      {busy ? (
        <span className="mt-4 text-sm font-medium" style={{ color: accent }}>
          Creating…
        </span>
      ) : null}
      {error ? <span className="mt-2 text-xs text-[var(--color-danger)]">{error}</span> : null}
    </button>
  );
}
