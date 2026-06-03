"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VIDEO_MODEL,
} from "@/config/models";
import { api } from "@/lib/api";

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
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-left transition duration-200 ease-spring hover:-translate-y-1 hover:shadow-lift disabled:opacity-70"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />
      <span
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
        style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
      >
        ▦
      </span>
      <h2 className="text-lg font-semibold">Storyboard</h2>
      <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">
        Design shot-by-shot with AI image generation.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
        Lock a style and characters with generated keyframes, then animate each into
        a video clip — continuity built in.
      </p>
      <span className="mt-4 text-sm font-medium" style={{ color: accent }}>
        {busy ? "Creating…" : "Start →"}
      </span>
      {error ? <span className="mt-2 text-xs text-[var(--color-danger)]">{error}</span> : null}
    </button>
  );
}
