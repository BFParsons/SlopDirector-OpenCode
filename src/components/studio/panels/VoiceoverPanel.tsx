"use client";

import { useState } from "react";
import { DEFAULT_TTS_MODEL, TTS_MODELS, getTtsModel, ttsVoiceLabel, ttsVoices } from "@/config/models";
import { api } from "@/lib/api";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Voiceover — a simplified TTS generator: pick a model + voice, type the words,
 * and Generate. The synthesized speech lands on the audio track as a generic
 * audio clip. Synchronous (TTS returns audio directly).
 */
export default function VoiceoverPanel({ windowControls }: PanelProps) {
  const { snapshot, readOnly, refetch } = useProjectEditor();
  const projectId = snapshot.id;

  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL);
  const [voice, setVoice] = useState(() => getTtsModel(DEFAULT_TTS_MODEL)?.defaultVoice ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const info = getTtsModel(ttsModel);
  const voices = ttsVoices(ttsModel);
  const estUsd = info ? (text.length / 1000) * info.pricePer1kCharsUsd : 0;

  function pickModel(id: string) {
    setTtsModel(id);
    const next = ttsVoices(id);
    if (!next.includes(voice)) setVoice(getTtsModel(id)?.defaultVoice ?? next[0] ?? "");
  }

  async function generate() {
    if (!text.trim() || busy || readOnly) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api(`/api/projects/${projectId}/generate-voiceover`, {
        method: "POST",
        body: JSON.stringify({ ttsModel, voice, text: text.trim() }),
      });
      await refetch();
      setDone(true);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fieldLabel = "text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]";
  const control =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-[11px] text-[var(--color-fg)]";

  return (
    <PanelChrome title="Voiceover" icon="🎙" {...windowControls}>
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
        {/* Model + Voice on one row */}
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <label className={fieldLabel}>Model</label>
            <select className={control} value={ttsModel} onChange={(e) => pickModel(e.target.value)} disabled={readOnly}>
              {TTS_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · ${m.pricePer1kCharsUsd.toFixed(3)}/1k
                </option>
              ))}
            </select>
          </div>
          <div className="w-20 shrink-0 space-y-0.5">
            <label className={fieldLabel}>Voice</label>
            <select className={control} value={voice} onChange={(e) => setVoice(e.target.value)} disabled={readOnly || voices.length <= 1}>
              {voices.map((v) => (
                <option key={v} value={v}>
                  {cap(ttsVoiceLabel(ttsModel, v))}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Script */}
        <div className="flex min-h-0 flex-1 flex-col space-y-0.5">
          <label className={fieldLabel}>Script</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={readOnly}
            placeholder="Type what the voice should say…"
            className="min-h-[88px] w-full flex-1 resize-none rounded border border-[#4b5468] bg-[var(--color-surface)] px-1.5 py-1 text-[11px] leading-snug text-[var(--color-fg)]"
          />
          <p className="text-right text-[9px] text-[var(--color-muted)]">{text.length} chars</p>
        </div>

        <div className="mt-auto space-y-1 pt-0.5">
          {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
          {done && !error ? (
            <p className="text-[10px] text-[var(--color-success)]">Added to the Media Bucket.</p>
          ) : null}
          <button
            type="button"
            onClick={generate}
            disabled={busy || readOnly || !text.trim()}
            className="w-full rounded bg-[var(--color-control)] px-2 py-1.5 text-xs font-medium text-[var(--color-accent-fg)] transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Generating…" : `🎙 Generate voiceover · ≈$${estUsd.toFixed(2)}`}
          </button>
        </div>
      </div>
    </PanelChrome>
  );
}
