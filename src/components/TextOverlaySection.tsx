"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FONTS } from "@/lib/typography/fonts";
import { applyPreset, presetById } from "@/lib/typography/presets";
import { roleOf } from "@/lib/typography/styleType";

export interface TextOverlayView {
  id: string;
  index: number;
  text: string;
  position: string;
  sizePct: number;
  color: string;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  marginPx: number;
  startS: number;
  endS: number | null;
  animation: string;
  font: string;
  outlineW: number;
  shadow: number;
  preset?: string | null;
}

export const OVERLAY_POSITIONS: { value: string; label: string }[] = [
  { value: "TOP_LEFT", label: "Top left" },
  { value: "TOP_CENTER", label: "Top center" },
  { value: "TOP_RIGHT", label: "Top right" },
  { value: "MIDDLE_LEFT", label: "Middle left" },
  { value: "CENTER", label: "Center" },
  { value: "MIDDLE_RIGHT", label: "Middle right" },
  { value: "BOTTOM_LEFT", label: "Bottom left" },
  { value: "BOTTOM_CENTER", label: "Bottom center" },
  { value: "BOTTOM_RIGHT", label: "Bottom right" },
];

const ANIMATIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "Hard on/off" },
  { value: "FADE", label: "Fade in/out" },
];

const lbl = "text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]";
const ctl =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[11px] text-[var(--color-fg)] disabled:opacity-40";

export function TextOverlaySection({
  projectId,
  frame,
  overlays,
  readOnly,
  onChange,
  save,
  refetch,
}: {
  projectId: string;
  frame: { w: number; h: number };
  overlays: TextOverlayView[];
  readOnly: boolean;
  onChange: (id: string, patch: Partial<TextOverlayView>) => void;
  save: () => Promise<boolean>;
  refetch: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(kind: "title" | "text") {
    setError(null);
    // Persist current field edits first so the keyed remount doesn't drop them.
    if (!(await save())) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/text-overlays`, {
        method: "POST",
        body: JSON.stringify(applyPreset(presetById(kind === "title" ? "title" : "lower-third")!, frame, kind === "title" ? "FILM TITLE" : "Your text", 0)),
      });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    if (!(await save())) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/text-overlays/${id}`, { method: "DELETE" });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-xs font-semibold">Text &amp; titles</h2>
      </div>
      <p className="text-[10px] leading-snug text-[var(--color-muted)]">
        Give the film its own title treatment. Use supporting text for names, facts and captions.
      </p>

      {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}

      {(["title", "text"] as const).map((kind) => (
        <section key={kind} aria-label={kind === "title" ? "Film titles" : "Supporting text"} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold">{kind === "title" ? "Film titles" : "Supporting text"}</h3>
            <button type="button" disabled={readOnly || busy} onClick={() => add(kind)} className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] disabled:opacity-40">
              {kind === "title" ? "+ Title" : "+ Text"}
            </button>
          </div>
          <p className="text-[10px] leading-snug text-[var(--color-muted)]">
            {kind === "title" ? "The name of the clip or film. Give it space and time to land." : "Information within the film. Keep its styling consistent and easy to read."}
          </p>
          {overlays.filter((o) => (roleOf(o.preset) === "title") === (kind === "title")).map((o) => (
            <TextOverlayRow
              key={o.id}
              overlay={o}
              readOnly={readOnly || busy}
              onChange={(patch) => onChange(o.id, patch)}
              onRemove={() => remove(o.id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className={lbl}>{label}</span>
        {hint ? <span className="text-[8px] text-[var(--color-muted)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function TextOverlayRow({
  overlay,
  readOnly,
  onChange,
  onRemove,
}: {
  overlay: TextOverlayView;
  readOnly: boolean;
  onChange: (patch: Partial<TextOverlayView>) => void;
  onRemove: () => void;
}) {
  const o = overlay;
  const isTitle = roleOf(o.preset) === "title";
  return (
    <div className="space-y-1.5 rounded border border-[var(--color-border)] p-2">
      <div className="flex items-start gap-1.5">
        <textarea
          rows={2}
          value={o.text}
          disabled={readOnly}
          placeholder="Text (line breaks allowed)"
          onChange={(e) => onChange({ text: e.target.value })}
          className={`${ctl} resize-none leading-snug`}
        />
        <button
          type="button"
          disabled={readOnly}
          title="Remove"
          className="shrink-0 px-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Purpose">
          <select aria-label="Text purpose" className={ctl} value={isTitle ? "title" : "text"} disabled={readOnly} onChange={(e) => onChange({ preset: e.target.value === "title" ? "title" : "card-editorial" })}>
            <option value="title">Film title</option>
            <option value="text">Supporting text</option>
          </select>
        </Field>
        <Field label="Font">
          <select aria-label="Text font" className={ctl} value={o.font} disabled={readOnly} onChange={(e) => onChange({ font: e.target.value })}>
            {FONTS.map((f) => <option key={f.id} value={f.id}>{f.family} · {f.weight}</option>)}
          </select>
        </Field>
        <Field label="Position">
          <select className={ctl} value={o.position} disabled={readOnly} onChange={(e) => onChange({ position: e.target.value })}>
            {OVERLAY_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size" hint="% h">
          <input type="number" min={1} max={40} value={o.sizePct} disabled={readOnly} className={ctl} onChange={(e) => onChange({ sizePct: clampInt(e.target.value, 1, 40, 6) })} />
        </Field>
        <Field label="Reveal">
          <select className={ctl} value={o.animation} disabled={readOnly} onChange={(e) => onChange({ animation: e.target.value })}>
            {ANIMATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Margin" hint="px">
          <input type="number" min={0} max={600} value={o.marginPx} disabled={readOnly} className={ctl} onChange={(e) => onChange({ marginPx: clampInt(e.target.value, 0, 600, 40) })} />
        </Field>
        <Field label="Color">
          <input type="color" value={normalizeHex(o.color)} disabled={readOnly} className="h-6 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)]" onChange={(e) => onChange({ color: e.target.value })} />
        </Field>
        <Field label="Start" hint="s">
          <input type="number" min={0} step={0.1} value={o.startS} disabled={readOnly} className={ctl} onChange={(e) => onChange({ startS: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="End" hint="blank=end">
          <input
            type="number"
            min={0}
            step={0.1}
            value={o.endS ?? ""}
            disabled={readOnly}
            className={ctl}
            onChange={(e) => onChange({ endS: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })}
          />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-1.5 text-[10px]">
            <input type="checkbox" checked={o.boxEnabled} disabled={readOnly} className="accent-[var(--color-accent)]" onChange={(e) => onChange({ boxEnabled: e.target.checked })} />
            Box
          </label>
        </div>
      </div>

      {o.boxEnabled ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Field label="Box color">
            <input type="color" value={normalizeHex(o.boxColor)} disabled={readOnly} className="h-6 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)]" onChange={(e) => onChange({ boxColor: e.target.value })} />
          </Field>
          <Field label="Box opacity" hint={`${Math.round(o.boxOpacity * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={o.boxOpacity} disabled={readOnly} className="h-1 w-full accent-[var(--color-accent)]" onChange={(e) => onChange({ boxOpacity: Number(e.target.value) })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function clampInt(raw: string, lo: number, hi: number, fallback: number): number {
  const n = Math.round(Number(raw));
  if (Number.isNaN(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** <input type=color> needs a #RRGGBB value; tolerate stored values w/o the #. */
function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? "");
  return m ? `#${m[1]}` : "#FFFFFF";
}
