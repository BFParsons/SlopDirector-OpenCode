"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { desktop } from "@/lib/desktop";
import { DEFAULT_LLM_MODEL, DEFAULT_TTS_MODEL, DEFAULT_VIDEO_MODEL } from "@/config/models";
import {
  CUSTOM_FRAME_ID,
  DEFAULT_FRAME_PRESET_ID,
  FRAME_MAX,
  FRAME_MIN,
  FRAME_PRESETS,
  FRAME_PRESET_GROUPS,
  closestAspect,
  closestResolution,
  describeFrame,
  evenize,
  frameSize,
  presetFor,
} from "@/config/frame-sizes";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { StatusBadge } from "@/components/ui";

/** One row of GET /api/projects (the fields this dialog uses). */
interface ProjectRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  aspectRatio: "R16_9" | "R9_16" | "R1_1";
  resolution: "R480P" | "R720P" | "R1080P";
  frameWidth: number | null;
  frameHeight: number | null;
  hasAudioSession: boolean;
}

const DEFAULT_PRESET = FRAME_PRESETS.find((p) => p.id === DEFAULT_FRAME_PRESET_ID) ?? FRAME_PRESETS[0];

const field =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs outline-none transition focus:border-[var(--color-accent)] short:py-1";

/**
 * The Assembly mode entry. Clicking opens a dialog with two tabs:
 *  - **New project** — pick a popular frame size (by medium, up to 4K) or type a
 *    custom width × height, then create and drop into the Studio.
 *  - **Open project** — the user's existing projects (this replaced the
 *    "Open project" card on the start screen).
 */
export function NewAssemblyCard({ accent }: { accent: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "open">("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- New project: frame size -------------------------------------------
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [w, setW] = useState(DEFAULT_PRESET.w);
  const [h, setH] = useState(DEFAULT_PRESET.h);
  // What will actually be created: even numbers within range (yuv420p needs even).
  const ew = evenize(w);
  const eh = evenize(h);
  const needsAdjust = ew !== w || eh !== h;

  function choosePreset(id: string) {
    setPresetId(id);
    const p = FRAME_PRESETS.find((x) => x.id === id);
    if (p) {
      setW(p.w);
      setH(p.h);
    }
  }
  function setSide(which: "w" | "h", raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const nw = which === "w" ? n : w;
    const nh = which === "h" ? n : h;
    if (which === "w") setW(n);
    else setH(n);
    // Typing switches the picker to "Custom" unless it lands exactly on a preset.
    setPresetId(presetFor(nw, nh)?.id ?? CUSTOM_FRAME_ID);
  }
  function normalize() {
    setW(ew);
    setH(eh);
    setPresetId(presetFor(ew, eh)?.id ?? CUSTOM_FRAME_ID);
  }

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
          // Closest provider-facing presets (AI video models think in 16:9 / 9:16 / 1:1)…
          aspectRatio: closestAspect(ew, eh),
          resolution: closestResolution(ew, eh),
          // …and the exact frame the project renders and previews at.
          frameWidth: ew,
          frameHeight: eh,
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

  // --- Open project ---------------------------------------------------------
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open || tab !== "open" || projects !== null) return;
    let alive = true;
    api<ProjectRow[]>("/api/projects")
      .then((rows) => {
        if (alive) setProjects(rows);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [open, tab, projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (projects ?? []).filter((p) => !q || p.title.toLowerCase().includes(q));
    return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [projects, query]);

  function openProject(p: ProjectRow) {
    if (busy) return;
    setBusy(true);
    router.push(`/projects/${p.id}${p.hasAudioSession ? "?ws=audio-studio" : ""}`);
  }

  function openDialog() {
    setError(null);
    setBusy(false);
    setOpen(true);
  }

  const seg = (active: boolean) =>
    `rounded-md px-2.5 py-1 transition ${
      active ? "bg-[var(--color-control)] text-[var(--color-control-fg)]" : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="squish-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center short:p-4"
      >
        <span aria-hidden className="squish-bar pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase("/slop/videoslop.png")}
          alt=""
          aria-hidden
          className="squish-icon mb-3 h-20 w-auto object-contain drop-shadow short:mb-2 short:h-14"
        />
        <h2 className="squish-title text-lg font-semibold short:text-base">Assembly</h2>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-lift short:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold short:text-base">Assembly</h2>
              <div role="tablist" className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs">
                <button type="button" role="tab" aria-selected={tab === "new"} className={seg(tab === "new")} onClick={() => setTab("new")}>
                  New project
                </button>
                <button type="button" role="tab" aria-selected={tab === "open"} className={seg(tab === "open")} onClick={() => setTab("open")}>
                  Open project
                </button>
              </div>
            </div>

            {tab === "new" ? (
              <>
                <div className="mt-4 short:mt-3">
                  <label htmlFor="frame-preset" className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Frame size
                  </label>
                  <select id="frame-preset" value={presetId} onChange={(e) => choosePreset(e.target.value)} className={`mt-1.5 w-full ${field}`}>
                    {FRAME_PRESET_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} — {p.w} × {p.h}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="Custom">
                      <option value={CUSTOM_FRAME_ID}>Custom size…</option>
                    </optgroup>
                  </select>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={FRAME_MIN}
                      max={FRAME_MAX}
                      step={2}
                      value={w}
                      onChange={(e) => setSide("w", e.target.value)}
                      onBlur={normalize}
                      aria-label="Width (px)"
                      className={`${field} tnum w-20 shrink-0`}
                    />
                    <span className="text-xs text-[var(--color-muted)]">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={FRAME_MIN}
                      max={FRAME_MAX}
                      step={2}
                      value={h}
                      onChange={(e) => setSide("h", e.target.value)}
                      onBlur={normalize}
                      aria-label="Height (px)"
                      className={`${field} tnum w-20 shrink-0`}
                    />
                    <span className="text-xs text-[var(--color-muted)]">px</span>
                    <span className="ml-auto whitespace-nowrap text-xs text-[var(--color-muted)]" data-testid="frame-summary">
                      {describeFrame(ew, eh)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                    {needsAdjust
                      ? `Rounded to even pixels: ${ew} × ${eh}.`
                      : `Pick a preset or type any size up to ${FRAME_MAX} px per side.`}
                  </p>
                </div>

                {hasPicker ? (
                  <div className="mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Save location</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] short:py-1.5">
                        {folder ?? "Default folder (from Settings)"}
                      </span>
                      <button
                        type="button"
                        onClick={chooseFolder}
                        className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs hover:border-[#39414f] short:py-1.5"
                      >
                        Choose…
                      </button>
                      {folder ? (
                        <button type="button" onClick={() => setFolder(null)} className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {error ? <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p> : null}

                <div className="mt-5 flex justify-end gap-2 short:mt-4">
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
                    {busy ? "Creating…" : `Create ${ew} × ${eh} →`}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 flex-col short:mt-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects…"
                  aria-label="Search projects"
                  className={`w-full ${field}`}
                />
                <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-[var(--color-border)]" data-testid="project-list">
                  {projects === null ? (
                    <p className="p-3 text-xs text-[var(--color-muted)]">Loading…</p>
                  ) : filtered.length === 0 ? (
                    <p className="p-3 text-xs text-[var(--color-muted)]">
                      {projects.length === 0 ? "No projects yet — create one from the New project tab." : "No projects match."}
                    </p>
                  ) : (
                    filtered.map((p) => {
                      const f = frameSize(p);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={busy}
                          onClick={() => openProject(p)}
                          className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left transition last:border-b-0 hover:bg-white/5 disabled:opacity-60"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium short:text-xs">{p.title}</div>
                            <div className="text-[10px] text-[var(--color-muted)]">
                              {f.w} × {f.h} · {describeFrame(f.w, f.h)} · {new Date(p.updatedAt).toLocaleDateString()}
                              {p.hasAudioSession ? " · Audio Studio" : ""}
                            </div>
                          </div>
                          <StatusBadge status={p.status} />
                        </button>
                      );
                    })
                  )}
                </div>
                {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}
                <div className="mt-3 flex items-center justify-between">
                  <Link href="/dashboard" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]">
                    All projects →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-fg)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
