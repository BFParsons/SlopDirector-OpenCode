"use client";

import { useState } from "react";
import { EFFECTS, type EffectParamDef, newEffect } from "@/config/effects";
import { asEffects, EFFECT_KINDS, type EffectKind, type EffectSpec } from "@/lib/render/effects";
import { asPip, DEFAULT_PIP, type PipPlacement } from "@/lib/render/pip";
import {
  asTransform,
  type ClipTransform,
  type Keyframe,
  emptyTransform,
  isIdentityTransform,
  sampleTransform,
} from "@/lib/render/transform";
import type { PanelProps } from "@/types/panel";
import PanelChrome from "../PanelChrome";
import { useProjectEditor } from "../ProjectEditorProvider";

type TrackName = "scale" | "posX" | "posY";

const KEY_EPS = 0.02; // keyframes within 2% of clip progress are the "same" key

function upsertKeyframe(track: Keyframe[], t: number, v: number): Keyframe[] {
  const next = track.filter((k) => Math.abs(k.t - t) > KEY_EPS);
  next.push({ t, v: Math.round(v * 1000) / 1000 });
  next.sort((a, b) => a.t - b.t);
  return next;
}

export default function EffectControlsPanel({ windowControls }: PanelProps) {
  const { draft, selectedSegmentId, onSegmentChange, engine } = useProjectEditor();
  const [addOpen, setAddOpen] = useState(false);

  const segs = draft.segments;
  const idx = segs.findIndex((s) => s.id === selectedSegmentId);
  const seg = idx >= 0 ? segs[idx] : null;

  // The selected clip's timeline start: V2 clips sit at their offset; V1 clips
  // are the cumulative sum of the V1 (track-0) clips before them.
  const isOverlay = (seg?.track ?? 0) === 1;
  let start = 0;
  if (seg) {
    if (isOverlay) {
      start = seg.offsetS ?? 0;
    } else {
      for (const s2 of segs) {
        if (s2.id === seg.id) break;
        if ((s2.track ?? 0) === 0) start += s2.durationS;
      }
    }
  }
  const dur = seg ? Math.max(0.1, seg.durationS) : 1;

  const pip = asPip(seg?.pip);
  function setPip(patch: Partial<PipPlacement>) {
    if (seg) onSegmentChange(seg.id, { pip: { ...pip, ...patch } });
  }
  function toggleTrack() {
    if (!seg) return;
    if (isOverlay) onSegmentChange(seg.id, { track: 0 });
    else onSegmentChange(seg.id, { track: 1, offsetS: Math.round(start * 10) / 10, pip: { ...DEFAULT_PIP } });
  }

  // Per-clip effect stack.
  const effects = asEffects(seg?.effects);
  const setEffects = (next: EffectSpec[]) => {
    if (seg) onSegmentChange(seg.id, { effects: next });
  };
  const addEffect = (kind: EffectKind) => setEffects([...effects, newEffect(kind)]);
  const updateParam = (i: number, key: string, value: number | string) =>
    setEffects(effects.map((e, j) => (j === i ? { ...e, params: { ...e.params, [key]: value } } : e)));
  const setEffectEnabled = (i: number, v: boolean) =>
    setEffects(effects.map((e, j) => (j === i ? { ...e, enabled: v } : e)));
  const removeEffect = (i: number) => setEffects(effects.filter((_, j) => j !== i));
  // Normalized playhead position within the clip (0..1).
  const p = seg ? Math.min(1, Math.max(0, (engine.time - start) / dur)) : 0;
  const inClip = seg != null && engine.time >= start - 0.001 && engine.time <= start + dur + 0.001;

  const transform = seg ? asTransform(seg.transform) : null;
  const sampled = sampleTransform(transform, p);

  function setValue(track: TrackName, v: number) {
    if (!seg) return;
    const base: ClipTransform = asTransform(seg.transform) ?? emptyTransform();
    const next: ClipTransform = { ...base, [track]: upsertKeyframe(base[track], p, v) };
    onSegmentChange(seg.id, { transform: isIdentityTransform(next) ? null : next });
  }

  function reset() {
    if (seg) onSegmentChange(seg.id, { transform: null });
  }

  const counts = transform
    ? { scale: transform.scale.length, posX: transform.posX.length, posY: transform.posY.length }
    : { scale: 0, posX: 0, posY: 0 };
  const totalKeys = counts.scale + counts.posX + counts.posY;

  return (
    <PanelChrome title="Effects" icon="◆" {...windowControls}>
      <div className="space-y-2 p-2">
        {!seg ? (
          <p className="text-[11px] leading-snug text-[var(--color-muted)]">
            Select a clip in the Timeline to add Motion (zoom &amp; pan) keyframes.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">Clip {idx + 1}</p>
                <p className="text-[9px] text-[var(--color-muted)]">
                  Motion · {totalKeys} key{totalKeys === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={totalKeys === 0}
                className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-40"
              >
                Reset
              </button>
            </div>

            {/* Track placement: main sequence vs overlay (picture-in-picture). */}
            <div className="flex flex-wrap items-center justify-between gap-1 rounded bg-white/5 px-2 py-1 text-[10px]">
              <span className="text-[var(--color-muted)]">{isOverlay ? "Overlay (V2)" : "Main (V1)"}</span>
              <button type="button" className="text-[var(--color-accent)] hover:underline" onClick={toggleTrack}>
                {isOverlay ? "⤵ To main" : "⤴ To overlay"}
              </button>
            </div>

            {isOverlay ? (
              <div className="space-y-1.5 rounded border border-[var(--color-border)] p-2">
                <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Picture-in-picture <span className="normal-case opacity-70">· precise placement</span>
                </p>
                <TrackRow label="Size" hint="" numeric suffix="×" min={0.02} max={4} step={0.01} value={pip.scale} disabled={false} onChange={(v) => setPip({ scale: v })} />
                <TrackRow label="Pos X" hint="" numeric min={-0.5} max={1.5} step={0.01} value={pip.posX} disabled={false} onChange={(v) => setPip({ posX: v })} />
                <TrackRow label="Pos Y" hint="" numeric min={-0.5} max={1.5} step={0.01} value={pip.posY} disabled={false} onChange={(v) => setPip({ posY: v })} />
                <TrackRow label="Opacity" hint="" numeric min={0} max={1} step={0.01} value={pip.opacity} disabled={false} onChange={(v) => setPip({ opacity: v })} />
              </div>
            ) : null}

            {!inClip ? (
              <p className="rounded bg-[var(--color-warning)]/10 px-2 py-1 text-[10px] leading-snug text-[var(--color-warning)]">
                Move the playhead over this clip to set a keyframe.
              </p>
            ) : (
              <p className="text-[10px] leading-snug text-[var(--color-muted)]">
                Playhead at {Math.round(p * 100)}% — changing a value sets a keyframe here.
              </p>
            )}

            <TrackRow label="Scale" hint={`${sampled.scale.toFixed(2)}× · ${counts.scale}k`} min={0.1} max={4} step={0.01} value={sampled.scale} disabled={!inClip} onChange={(v) => setValue("scale", v)} />
            <TrackRow label="Pos X" hint={`${sampled.posX >= 0 ? "+" : ""}${sampled.posX.toFixed(2)} · ${counts.posX}k`} min={-1} max={1} step={0.01} value={sampled.posX} disabled={!inClip} onChange={(v) => setValue("posX", v)} />
            <TrackRow label="Pos Y" hint={`${sampled.posY >= 0 ? "+" : ""}${sampled.posY.toFixed(2)} · ${counts.posY}k`} min={-1} max={1} step={0.01} value={sampled.posY} disabled={!inClip} onChange={(v) => setValue("posY", v)} />

            <p className="text-[9px] leading-snug text-[var(--color-muted)]">
              Same value at two playhead positions animates between them. One keyframe = static.
            </p>

            {/* Per-clip effect stack */}
            <div className="space-y-1.5 rounded border border-[var(--color-border)] p-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">Effects</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAddOpen((o) => !o)}
                    className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)] hover:border-[#39414f]"
                  >
                    + Add
                  </button>
                  {addOpen ? (
                    <div className="absolute right-0 z-30 mt-1 w-44 rounded border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-lift">
                      {EFFECT_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            addEffect(k);
                            setAddOpen(false);
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] hover:bg-white/5"
                        >
                          <span>{EFFECTS[k].icon}</span>
                          <span className="flex-1">{EFFECTS[k].label}</span>
                          {EFFECTS[k].preview === "export" ? (
                            <span className="text-[8px] text-[var(--color-muted)]">export</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {effects.length === 0 ? (
                <p className="text-[10px] leading-snug text-[var(--color-muted)]">
                  None yet. Add blur, chroma key, crop, mirror, rotate, pixelate or sharpen.
                </p>
              ) : (
                effects.map((fx, i) => (
                  <EffectRow
                    key={fx.id}
                    fx={fx}
                    onParam={(key, v) => updateParam(i, key, v)}
                    onToggle={(v) => setEffectEnabled(i, v)}
                    onRemove={() => removeEffect(i)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PanelChrome>
  );
}

function EffectRow({
  fx,
  onParam,
  onToggle,
  onRemove,
}: {
  fx: EffectSpec;
  onParam: (key: string, v: number | string) => void;
  onToggle: (v: boolean) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const def = EFFECTS[fx.kind];
  if (!def) return null;
  return (
    <div className={`rounded border border-[var(--color-border)] ${fx.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-1.5 px-1.5 py-1">
        <input
          type="checkbox"
          checked={fx.enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="accent-[var(--color-accent)]"
          title={fx.enabled ? "Disable" : "Enable"}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 text-left text-[10px] font-medium"
        >
          <span>{def.icon}</span> {def.label}
          {def.preview === "export" ? (
            <span className="ml-1 rounded bg-white/10 px-1 text-[8px] text-[var(--color-muted)]">on export</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove effect"
          className="px-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
        >
          ✕
        </button>
      </div>
      {open ? (
        <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1.5">
          {def.params.map((pdef) => (
            <EffectParam
              key={pdef.key}
              pdef={pdef}
              value={fx.params[pdef.key] ?? pdef.default}
              onChange={(v) => onParam(pdef.key, v)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EffectParam({
  pdef,
  value,
  onChange,
}: {
  pdef: EffectParamDef;
  value: number | string | boolean;
  onChange: (v: number | string) => void;
}) {
  if (pdef.type === "color") {
    return (
      <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
        <span>{pdef.label}</span>
        <input
          type="color"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-8 rounded border border-[var(--color-border)] bg-transparent"
        />
      </div>
    );
  }
  if (pdef.type === "select") {
    return (
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
        <span>{pdef.label}</span>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[10px] text-[var(--color-fg)]"
        >
          {pdef.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const n = typeof value === "number" ? value : Number(value) || 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
        <span>{pdef.label}</span>
        <span className="tnum">
          {n}
          {pdef.suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={pdef.min}
        max={pdef.max}
        step={pdef.step}
        value={n}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full accent-[var(--color-accent)]"
      />
    </div>
  );
}

function TrackRow({
  label,
  hint,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
  numeric = false,
  suffix,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  /** Show a precise, type-able number box (Premiere-style) instead of the hint. */
  numeric?: boolean;
  suffix?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
        <span>{label}</span>
        {numeric ? (
          <span className="flex items-center gap-0.5">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={Number(value.toFixed(3))}
              disabled={disabled}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onChange(n);
              }}
              className="w-14 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-right text-[10px] tnum text-[var(--color-fg)] disabled:opacity-40"
            />
            {suffix ? <span>{suffix}</span> : null}
          </span>
        ) : (
          <span className="tnum">{hint}</span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="h-1 w-full accent-[var(--color-accent)] disabled:opacity-40"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
