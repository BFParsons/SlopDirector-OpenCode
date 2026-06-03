"use client";

import type { ReactNode } from "react";
import { Input, Label } from "@/components/ui";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

/** One channel strip: name + mute + a gain fader. */
function Channel({
  name,
  sub,
  muted,
  onMute,
  value,
  min,
  max,
  onChange,
  disabled,
  children,
}: {
  name: string;
  sub: string;
  muted: boolean;
  onMute: () => void;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-md border border-[var(--color-border)] p-2.5 ${disabled ? "opacity-50" : ""}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          <p className="truncate text-[11px] text-[var(--color-muted)]">{sub}</p>
        </div>
        <button
          type="button"
          onClick={onMute}
          disabled={disabled}
          className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            muted
              ? "bg-[var(--color-danger)] text-white"
              : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          {muted ? "Muted" : "Mute"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          disabled={disabled || muted}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 accent-[var(--color-accent)] disabled:opacity-40"
        />
        <span className="w-10 shrink-0 text-right font-mono tnum text-[11px] text-[var(--color-muted)]">
          {Math.round(value * 100)}%
        </span>
      </div>
      {children}
    </div>
  );
}

export default function AudioMixerPanel({ windowControls }: PanelProps) {
  const { draft, snapshot, setAudio, setPolish } = useProjectEditor();

  const voActive = draft.audioMode !== "NONE";
  const voReady = snapshot.voiceover?.status === "READY";
  const voSub = !voActive
    ? "off (silent)"
    : voReady
      ? `${(snapshot.voiceover?.durationS ?? 0).toFixed(1)}s · master`
      : "not generated yet";
  const hasMusic = !!snapshot.musicAssetId;

  return (
    <PanelChrome title="Mixer" icon="🎚" {...windowControls}>
      <div className="space-y-2.5 p-3">
        <Channel
          name="Voiceover"
          sub={voSub}
          muted={draft.voMuted}
          onMute={() => setAudio({ voMuted: !draft.voMuted })}
          value={draft.voVolume}
          min={0}
          max={2}
          onChange={(v) => setAudio({ voVolume: v })}
          disabled={!voActive}
        />

        <Channel
          name="Music bed"
          sub={hasMusic ? "loaded · loops to fill" : "no music bed"}
          muted={draft.musicMuted}
          onMute={() => setAudio({ musicMuted: !draft.musicMuted })}
          value={draft.musicVolume}
          min={0}
          max={1}
          onChange={(v) => setAudio({ musicVolume: v })}
          disabled={!hasMusic}
        >
          <label className="mt-1.5 flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={draft.musicDucking}
              disabled={!hasMusic}
              className="accent-[var(--color-accent)]"
              onChange={(e) => setAudio({ musicDucking: e.target.checked })}
            />
            Duck under voiceover
          </label>
        </Channel>

        <div className="space-y-2 rounded-md border border-[var(--color-border)] p-2.5">
          <p className="text-sm font-semibold">Master</p>
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={draft.audioNormalize}
              className="accent-[var(--color-accent)]"
              onChange={(e) => setPolish({ audioNormalize: e.target.checked })}
            />
            Normalize to −14 LUFS (broadcast / social)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label hint="seconds, 0 = off">Fade in</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={draft.audioFadeInS}
                onChange={(e) => setPolish({ audioFadeInS: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </div>
            <div>
              <Label hint="seconds, 0 = off">Fade out</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={draft.audioFadeOutS}
                onChange={(e) => setPolish({ audioFadeOutS: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[var(--color-muted)]">
          Overlay / SFX clip levels are set per clip on the timeline.
        </p>
      </div>
    </PanelChrome>
  );
}
