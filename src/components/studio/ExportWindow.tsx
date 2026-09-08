"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { describeFrame, frameSize } from "@/config/frame-sizes";

/**
 * The "Export" experience: a floating, borderless white window. It fires the real
 * render in the background and entertains the user with cycling status text until
 * it's ready, then reveals the finished video (sloppyexport.mp4) + a save link.
 *
 * The status lines are mostly the everyday pool; every so often a rarer "surprise"
 * line slips in (SURPRISE_CHANCE) so the wait keeps producing little gems.
 */
const RENDER_LINES = [
  "Warming up the render farm…",
  "Reticulating splines…",
  "Convincing the pixels to line up…",
  "Bribing the GPU with snacks…",
  "Counting frames on our fingers…",
  "Negotiating with ffmpeg…",
  "Untangling the timeline…",
  "Buffing out the rough cuts…",
  "Asking the codec nicely…",
  "Rounding up the stray pixels…",
  "Polishing each frame by hand…",
  "Teaching the bot to edit…",
  "Sweeping up the dropped frames…",
  "Color-grading in the dark…",
  "Rendering at the speed of vibes…",
  "Compressing your masterpiece…",
  "Aligning the keyframes…",
  "Stacking the bits in neat little rows…",
  "Encoding with extra love…",
  "Wrangling the audio waveform…",
  "Double-checking the transitions…",
  "Feeding the render gremlins…",
  "Spinning up the flux capacitor…",
  "Tuning the contrast knobs…",
  "Coaxing the green screen to behave…",
  "Inflating the pixels to full size…",
  "Whispering sweet nothings to the renderer…",
  "Stitching frames together…",
  "Carefully not dropping the video…",
  "Loading the secret sauce…",
  "Smoothing out the jitters…",
  "Stacking 24 frames per second…",
  "Letting the render breathe…",
  "Lining up the ducks (and the frames)…",
  "Defragging the imagination…",
  "Adding a pinch of motion blur…",
  "Rendering responsibly…",
  "Almost there. Probably…",
  "Doing the math so you don't have to…",
  "Gently nudging the bytes along…",
  "Making it look effortless…",
  "Optimizing the chaos…",
  "Squeezing the frames into the file…",
  "Knitting the audio and video together…",
  "Giving the render a little pep talk…",
];

const SURPRISES = [
  "Wow, that's a lot of clips. Respect.",
  "The CinemaBot is judging your color grade.",
  "Found a pixel that wandered off. Returned it home.",
  "This frame is genuinely beautiful. Don't tell the others.",
  "Briefly considered becoming a painter instead.",
  "Okay, who put a 4K clip in here?",
  "Rendering so hard the fans woke up.",
  "The codec has requested a coffee break.",
  "Plot twist: it was the audio sync all along.",
  "Quietly impressed by your editing, ngl.",
  "Reversing the polarity of the neutron flow…",
  "Adding 12% more cinematic to the mix.",
  "Your GPU says hi. And also ow.",
  "Somewhere, a render artist sheds a single proud tear.",
  "This is the one. This is your magnum opus. (Probably.)",
];

const SURPRISE_CHANCE = 0.14;
const TICK_MS = 1900;
const MIN_MS = 8000; // keep the show going at least this long
const MAX_MS = 360000; // …but never hang forever (real renders can take minutes)

function nextLine(prev: string): string {
  const surprise = Math.random() < SURPRISE_CHANCE;
  const pool = surprise ? SURPRISES : RENDER_LINES;
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (line === prev) line = pool[(pool.indexOf(line) + 1) % pool.length];
  return line;
}

interface FormatInfo {
  codec: string;
  label: string;
  container: string;
  ext: string;
  blurb: string;
  available: boolean;
  hardware: string | null;
}

interface RenderPreview {
  cost: { totalCents: number; videoSeconds: number };
  quota: { used: number; limit: number };
  formats: FormatInfo[];
  exportCodec: string;
}

type Phase = "settings" | "rendering" | "done";

export function ExportWindow({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("settings");
  const [line, setLine] = useState("Warming up the render farm…");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [failed, setFailed] = useState(false);

  // --- settings step -------------------------------------------------------
  const [preview, setPreview] = useState<RenderPreview | null>(null);
  const [frame, setFrame] = useState<string>("");
  const [codec, setCodec] = useState<string>("h264");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const ext = preview?.formats.find((f) => f.codec === codec)?.ext ?? "mp4";

  useEffect(() => {
    let alive = true;
    api<RenderPreview>(`/api/projects/${projectId}/render`)
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        const wanted = p.formats.find((f) => f.codec === p.exportCodec);
        setCodec(wanted?.available ? wanted.codec : "h264");
      })
      .catch((e: Error) => {
        if (alive) setSettingsError(e.message);
      });
    api<{
      aspectRatio: "R16_9" | "R9_16" | "R1_1";
      resolution: "R480P" | "R720P" | "R1080P";
      frameWidth: number | null;
      frameHeight: number | null;
      title?: string;
    }>(`/api/projects/${projectId}`)
      .then((snap) => {
        if (!alive) return;
        const f = frameSize(snap);
        setFrame(`${f.w} × ${f.h} · ${describeFrame(f.w, f.h)}`);
        if (snap.title) setTitle(snap.title);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function startExport() {
    if (starting) return;
    setStarting(true);
    setSettingsError(null);
    try {
      if (preview && codec !== preview.exportCodec) {
        await api(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ exportCodec: codec }) });
      }
      setPhase("rendering");
    } catch (e) {
      setSettingsError((e as Error).message);
      setStarting(false);
    }
  }

  // --- rendering step ------------------------------------------------------
  useEffect(() => {
    if (phase !== "rendering") return;
    let alive = true;
    const startedAt = Date.now();
    // Fire the real render. The preview shown on completion is the playful
    // sloppyexport.mp4, but the Save link points at the real rendered file.
    void api(`/api/projects/${projectId}/render`, { method: "POST", body: JSON.stringify({}) }).catch(() => {});

    const tick = window.setInterval(() => {
      if (alive) setLine((p) => nextLine(p));
    }, TICK_MS);

    const poll = window.setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      let finished = false;
      try {
        const proj = await api<{
          status?: string;
          title?: string;
          finalRender?: { status?: string; assetId?: string | null } | null;
        }>(`/api/projects/${projectId}`);
        if (proj?.title) setTitle(proj.title);
        const fr = proj?.finalRender ?? null;
        if (fr?.assetId) setAssetId(fr.assetId);
        const rendered = proj?.status === "DONE" && fr?.status === "READY" && !!fr?.assetId;
        const didFail = proj?.status === "FAILED" || fr?.status === "FAILED";
        if (didFail) setFailed(true);
        finished = rendered || didFail;
      } catch {
        /* keep waiting */
      }
      if (alive && ((finished && elapsed >= MIN_MS) || elapsed >= MAX_MS)) {
        setPhase("done");
        window.clearInterval(tick);
        window.clearInterval(poll);
      }
    }, 2000);

    return () => {
      alive = false;
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [projectId, phase]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white text-neutral-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-xl leading-none text-neutral-300 transition-colors hover:text-neutral-600"
        >
          ✕
        </button>

        {phase === "settings" ? (
          <div className="px-8 py-8">
            <p className="text-lg font-semibold">Export settings</p>
            <p className="mt-1 text-sm text-neutral-500">{frame || "…"}</p>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Format</p>
            {!preview && !settingsError ? (
              <p className="mt-2 text-sm text-neutral-500">Checking the encoders on this machine…</p>
            ) : null}
            <div className="mt-2 max-h-[38dvh] space-y-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Export format">
              {(preview?.formats ?? []).map((f) => {
                const selected = f.codec === codec;
                return (
                  <label
                    key={f.codec}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
                      selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                    } ${f.available ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      value={f.codec}
                      checked={selected}
                      disabled={!f.available}
                      onChange={() => setCodec(f.codec)}
                      className="mt-1 accent-neutral-900"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            !f.available
                              ? "bg-neutral-100 text-neutral-400"
                              : f.hardware
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {!f.available ? "not available" : f.hardware ? `GPU · ${f.hardware}` : "CPU"}
                        </span>
                      </span>
                      <span className="block text-xs text-neutral-500">{f.blurb}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {preview && preview.cost.totalCents > 0 ? (
              <p className="mt-3 text-xs text-neutral-500">
                Estimated AI cost for this render: ${(preview.cost.totalCents / 100).toFixed(2)} · quota {preview.quota.used}/{preview.quota.limit}
              </p>
            ) : null}
            {settingsError ? <p className="mt-3 text-sm text-red-600">{settingsError}</p> : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!preview || starting}
                onClick={startExport}
                className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
              >
                {starting ? "Starting…" : `Export .${ext} →`}
              </button>
            </div>
          </div>
        ) : phase === "rendering" ? (
          <div className="flex flex-col items-center gap-6 px-8 py-14 text-center">
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-neutral-200 border-t-neutral-800" />
            <p className="min-h-[3.5rem] text-lg font-medium leading-snug">{line}</p>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Exporting your video</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-8 py-8 text-center">
            <p className="text-lg font-semibold">Your export is ready 🎬</p>
            <video
              src={withBase("/sloppyexport.mp4")}
              autoPlay
              muted
              loop
              playsInline
              className="w-full rounded-lg bg-black"
            />
            {assetId ? (
              <>
                <a
                  href={withBase(`/api/assets/${assetId}`)}
                  download={`${(title || "export").replace(/[^\w.-]+/g, "_")}.${ext}`}
                  className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
                >
                  ⬇ Save to your computer
                </a>
                <p className="text-xs text-neutral-400">{`${(title || "export").replace(/[^\w.-]+/g, "_")}.${ext}`}</p>
              </>
            ) : (
              <p className="text-sm text-neutral-500">
                {failed
                  ? "The render didn't finish — close this and try Export again."
                  : "Your render is still finishing — reopen Export in a moment to download it."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
