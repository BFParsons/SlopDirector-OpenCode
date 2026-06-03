"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_LLM_MODEL, DEFAULT_TTS_MODEL, DEFAULT_VIDEO_MODEL } from "@/config/models";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

/** Dashboard header actions: start a new video, or a new audio composition.
 *  "New Video" goes to the creation page; "New Audio Composition" creates a
 *  project and opens it straight in the Audio Studio workspace. */
export function DashboardNewButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function newAudio() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled audio composition",
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
      router.push(`/projects/${id}?ws=audio-studio`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Link href="/start">
          <Button>+ New Video</Button>
        </Link>
        <Button variant="ghost" onClick={newAudio} disabled={busy}>
          {busy ? "Creating…" : "+ New Audio Composition"}
        </Button>
      </div>
      {error ? <span className="text-xs text-[var(--color-danger)]">{error}</span> : null}
    </div>
  );
}
