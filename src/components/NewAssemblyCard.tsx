"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { desktop } from "@/lib/desktop";
import {
  ASPECT_RATIOS,
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VIDEO_MODEL,
  FRAME_DIMENSIONS,
  RESOLUTIONS,
} from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";

type AspectKey = keyof typeof ASPECT_RATIOS;
type ResKey = keyof typeof RESOLUTIONS;

// Small shape previews for the aspect-ratio picker (px).
const ASPECT_SHAPE: Record<AspectKey, { w: number; h: number }> = {
  R16_9: { w: 40, h: 22 },
  R9_16: { w: 22, h: 40 },
  R1_1: { w: 30, h: 30 },
};

// The Assembly mode entry. Clicking opens a popup to choose the frame size
// (aspect ratio + resolution); creating the project then drops into the Studio
// editing dashboard with an empty timeline.
export function NewAssemblyCard({ accent }: { accent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aspect, setAspect] = useState<AspectKey>("R16_9");
  const [resolution, setResolution] = useState<ResKey>("R720P");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Desktop-only per-project save-folder override (else the default folder).
  const [folder, setFolder] = useState<string | null>(null);
  const [hasPicker, setHasPicker] = useState(false);
  useEffect(() => setHasPicker(desktop() != null), []);

  async function chooseFolder() {
    const picked = await desktop()?.pickFolder({ title: "Save this project in…" });
    if (picked) setFolder(picked);
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled video",
          targetLengthS: 30,
          aspectRatio: aspect,
          resolution,
          shotCount: 5,
          audioMode: "NONE", // manual assembly — add audio as you go
          llmModel: DEFAULT_LLM_MODEL,
          videoModel: DEFAULT_VIDEO_MODEL,
          ttsModel: DEFAULT_TTS_MODEL,
          ...(folder ? { bundleBase: folder } : {}),
        }),
      });
      router.push(`/projects/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="squish-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center"
      >
        <span aria-hidden className="squish-bar pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase("/slop/assembleslop.png")}
          alt=""
          aria-hidden
          className="squish-icon mb-3 h-20 w-auto object-contain drop-shadow"
        />
        <h2 className="squish-title text-lg font-semibold">Assembly</h2>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">New assembly project</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Pick a frame size — you can change it later in Settings.
            </p>

            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Aspect ratio
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(ASPECT_RATIOS) as AspectKey[]).map((k) => {
                  const sh = ASPECT_SHAPE[k];
                  const sel = aspect === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAspect(k)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                        sel ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[#39414f]"
                      }`}
                    >
                      <span className="flex h-11 items-center justify-center">
                        <span className="rounded-sm" style={{ width: sh.w, height: sh.h, background: sel ? accent : "var(--color-border)" }} />
                      </span>
                      <span className="text-xs font-medium">{ASPECT_RATIOS[k]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Resolution
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(Object.keys(RESOLUTIONS) as ResKey[]).map((k) => {
                  const sel = resolution === k;
                  const dim = FRAME_DIMENSIONS[aspect][k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setResolution(k)}
                      className={`rounded-xl border p-3 text-center transition ${
                        sel ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] hover:border-[#39414f]"
                      }`}
                    >
                      <div className="text-sm font-semibold">{RESOLUTIONS[k]}</div>
                      <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                        {dim.w}×{dim.h}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {hasPicker ? (
              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Save location
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
                    {folder ?? "Default folder (from Settings)"}
                  </span>
                  <button
                    type="button"
                    onClick={chooseFolder}
                    className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs hover:border-[#39414f]"
                  >
                    Choose…
                  </button>
                  {folder ? (
                    <button
                      type="button"
                      onClick={() => setFolder(null)}
                      className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-fg)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={create}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition hover:brightness-110 disabled:opacity-60"
                style={{ background: accent }}
              >
                {busy ? "Creating…" : "Create →"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
