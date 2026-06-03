"use client";

import { Input, Label, Select } from "@/components/ui";
import type { Draft } from "@/lib/projects/draft";
import { WatermarkControl } from "./WatermarkControl";

const COLOR_LOOKS: { value: string; label: string }[] = [
  { value: "NONE", label: "None (as shot)" },
  { value: "WARM", label: "Warm" },
  { value: "COOL", label: "Cool" },
  { value: "BW", label: "Black & white" },
  { value: "VINTAGE", label: "Vintage" },
  { value: "PUNCH", label: "Punch (high contrast)" },
  { value: "TEAL_ORANGE", label: "Teal & orange (cinematic)" },
  { value: "NOIR", label: "Noir (hard B&W)" },
  { value: "CAMPAIGN", label: "Campaign (warm patriotic)" },
  { value: "BLEACH", label: "Bleach bypass (gritty)" },
];

const FILL_MODES: { value: string; label: string }[] = [
  { value: "LETTERBOX", label: "Letterbox (black bars)" },
  { value: "BLUR_FILL", label: "Blur fill (no bars)" },
];

const TRANSITIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "Hard cut (none)" },
  { value: "CROSSFADE", label: "Crossfade" },
  { value: "DISSOLVE", label: "Dissolve" },
  { value: "FADE_BLACK", label: "Fade through black" },
  { value: "WIPE", label: "Wipe" },
  { value: "SLIDE", label: "Slide" },
];

export function PolishSection({
  draft,
  readOnly,
  setPolish,
  projectId,
  watermarkAssetId,
  save,
  refetch,
}: {
  draft: Draft;
  readOnly: boolean;
  setPolish: (patch: Partial<Draft>) => void;
  projectId: string;
  watermarkAssetId: string | null;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label hint="applied between every segment">Transition</Label>
          <Select
            value={draft.transition}
            disabled={readOnly}
            onChange={(e) => setPolish({ transition: e.target.value })}
          >
            {TRANSITIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        {draft.transition !== "NONE" ? (
          <div>
            <Label hint="100–3000 ms">Transition length</Label>
            <Input
              type="number"
              min={100}
              max={3000}
              step={50}
              value={draft.transitionMs}
              disabled={readOnly}
              onChange={(e) =>
                setPolish({
                  transitionMs: Math.min(3000, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label hint="color grade applied to the whole video">Color look</Label>
          <Select
            value={draft.colorLook}
            disabled={readOnly}
            onChange={(e) => setPolish({ colorLook: e.target.value })}
          >
            {COLOR_LOOKS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label hint="off-aspect media: bars vs blurred fill">Frame fill</Label>
          <Select
            value={draft.fillMode}
            disabled={readOnly}
            onChange={(e) => setPolish({ fillMode: e.target.value })}
          >
            {FILL_MODES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.vignette}
            disabled={readOnly}
            className="accent-[var(--color-accent)]"
            onChange={(e) => setPolish({ vignette: e.target.checked })}
          />
          Vignette (darken edges)
        </label>
        <div>
          <Label hint={draft.grain === 0 ? "off" : `${draft.grain}%`}>Film grain</Label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draft.grain}
            disabled={readOnly}
            className="w-full accent-[var(--color-accent)]"
            onChange={(e) => setPolish({ grain: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label>Logo / watermark</Label>
        <WatermarkControl
          projectId={projectId}
          watermarkAssetId={watermarkAssetId}
          draft={draft}
          readOnly={readOnly}
          onChange={setPolish}
          save={save}
          refetch={refetch}
        />
      </div>

      <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.audioNormalize}
            disabled={readOnly}
            className="accent-[var(--color-accent)]"
            onChange={(e) => setPolish({ audioNormalize: e.target.checked })}
          />
          Normalize loudness to broadcast level (−14 LUFS)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label hint="seconds, 0 = off">Audio fade in</Label>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={draft.audioFadeInS}
              disabled={readOnly}
              onChange={(e) =>
                setPolish({ audioFadeInS: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })
              }
            />
          </div>
          <div>
            <Label hint="seconds, 0 = off">Audio fade out</Label>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={draft.audioFadeOutS}
              disabled={readOnly}
              onChange={(e) =>
                setPolish({ audioFadeOutS: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
