/**
 * Mechanical checks from the editing guide (guide/editing-guide.md), stated
 * there as "*Mechanical check:*" under the craft rules. Each tool cites the
 * chapter it enforces so an agent (or a person) can read the rationale.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Segment, type Snapshot, assetInfo, snapshot } from "../client";
import { guarded, text } from "../format";

export const FPS = 30;
const FRAME = 1 / FPS;

export interface Finding {
  severity: "error" | "warn" | "info";
  rule: string;
  message: string;
  segmentId?: string;
  index?: number;
  atS?: number;
  fix?: string;
}

const mainSequence = (s: Snapshot): Segment[] =>
  s.segments.filter((x) => x.track === 0 && !x.audioOnly && !x.library).sort((a, b) => a.index - b.index);

/** Source range a segment shows: [trimStartS, trimStartS + durationS × speed). */
const sourceRange = (s: Segment) => ({ inS: s.trimStartS, outS: s.trimStartS + s.durationS * (s.speed || 1) });

const stats = (xs: number[]) => {
  const n = xs.length;
  if (!n) return { count: 0, totalS: 0, aslS: 0, medianS: 0, stdevS: 0, minS: 0, maxS: 0 };
  const total = xs.reduce((a, b) => a + b, 0);
  const mean = total / n;
  const sorted = [...xs].sort((a, b) => a - b);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const stdev = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const r = (v: number) => +v.toFixed(3);
  return { count: n, totalS: r(total), aslS: r(mean), medianS: r(median), stdevS: r(stdev), minS: r(sorted[0]), maxS: r(sorted[n - 1]) };
};

// Chapter 16 reference points (approximate ASL in seconds).
const GENRE_ASL: Record<string, [number, number]> = {
  classical: [8, 11],
  drama: [4, 6],
  documentary: [4, 8],
  comedy: [3, 5],
  action: [2, 3],
  music_video: [1, 2],
  social: [1, 3],
  commercial: [1.5, 3],
};

export function pacingReport(s: Snapshot, genre?: string) {
  const segs = mainSequence(s);
  const d = segs.map((x) => x.durationS);
  const st = stats(d);
  const buckets = { "<0.33s": 0, "0.33-1s": 0, "1-2s": 0, "2-4s": 0, "4-8s": 0, ">8s": 0 };
  for (const x of d) {
    if (x < 0.33) buckets["<0.33s"]++;
    else if (x < 1) buckets["0.33-1s"]++;
    else if (x < 2) buckets["1-2s"]++;
    else if (x < 4) buckets["2-4s"]++;
    else if (x < 8) buckets["4-8s"]++;
    else buckets[">8s"]++;
  }
  const findings: Finding[] = [];
  segs.forEach((x, i) => {
    if (x.durationS < 10 * FRAME)
      findings.push({ severity: "warn", rule: "ch16 minimum readable duration (8–12 frames)", segmentId: x.id, index: i, message: `shot ${i} is ${x.durationS.toFixed(2)} s (${Math.round(x.durationS * FPS)} frames): felt, not read — keep only if deliberate` });
  });
  if (st.count >= 4 && st.aslS > 0 && st.stdevS / st.aslS < 0.15)
    findings.push({ severity: st.count >= 6 ? "warn" : "info", rule: "ch16 vary shot duration deliberately", message: `${st.count} shots with near-uniform durations (stdev ${st.stdevS}s on ASL ${st.aslS}s): reads as mechanical unless the sameness is the point — break the pattern at least once` });
  let comparison: string | null = null;
  if (genre) {
    const ref = GENRE_ASL[genre];
    if (ref) {
      comparison = st.aslS < ref[0] ? `faster than the ${genre} norm (${ref[0]}–${ref[1]} s)` : st.aslS > ref[1] ? `slower than the ${genre} norm (${ref[0]}–${ref[1]} s)` : `inside the ${genre} norm (${ref[0]}–${ref[1]} s)`;
    }
  }
  return { ...st, histogram: buckets, genre: genre ?? null, comparison, references: GENRE_ASL, findings };
}

type Transcript = { words: { startS: number; endS: number; text: string }[]; segments: { startS: number; endS: number; text: string }[] };

export function midWordCut(words: Transcript["words"], pointS: number, tolS: number) {
  return words.find((w) => w.startS + tolS < pointS && w.endS - tolS > pointS) ?? null;
}

export function checkCuts(s: Snapshot, opts: { transcripts: Map<string, Transcript | null>; silences: Map<string, { startS: number; endS: number; durationS: number }[]> }) {
  const segs = mainSequence(s);
  const findings: Finding[] = [];
  const tol = 0.04;
  let jumpCuts = 0;
  let crossCuts = 0;
  segs.forEach((x, i) => {
    const { inS, outS } = sourceRange(x);
    if (x.durationS < 6 * FRAME) findings.push({ severity: "error", rule: "ch16 / ch32 flash frame", segmentId: x.id, index: i, message: `shot ${i} is ${Math.round(x.durationS * FPS)} frames long`, fix: "delete it or extend durationS" });
    const tr = x.sourceAssetId ? opts.transcripts.get(x.sourceAssetId) : null;
    if (tr && tr.words.length) {
      for (const [label, p] of [["in-point", inS], ["out-point", outS]] as const) {
        const w = midWordCut(tr.words, p, tol);
        if (w) findings.push({ severity: "error", rule: "ch17 removing ums, pauses and stumbles: cut in the pauses, never mid-word", segmentId: x.id, index: i, atS: p, message: `${label} of shot ${i} lands inside the word "${w.text}" (${w.startS}–${w.endS}s of the source)`, fix: label === "in-point" ? `trimStartS ${w.startS <= p ? w.startS.toFixed(3) : w.endS.toFixed(3)} (word boundary)` : `end at ${w.endS.toFixed(3)} (extend) or ${w.startS.toFixed(3)} (shorten)` });
      }
      // Kept dead air inside the shown range (ch17: tighten the gaps between lines first).
      const sil = x.sourceAssetId ? opts.silences.get(x.sourceAssetId) ?? [] : [];
      for (const g of sil) {
        const a = Math.max(g.startS, inS);
        const b = Math.min(g.endS, outS);
        if (b - a >= 0.75) findings.push({ severity: "info", rule: "ch17 tighten the gaps between lines before the lines", segmentId: x.id, index: i, atS: a, message: `shot ${i} keeps ${(b - a).toFixed(2)} s of silence (source ${a.toFixed(2)}–${b.toFixed(2)}s)`, fix: "split at the silence and drop it, unless the pause means something" });
      }
    }
    if (i > 0) {
      const prev = segs[i - 1];
      if (prev.sourceAssetId && prev.sourceAssetId === x.sourceAssetId) {
        const contiguous = Math.abs(sourceRange(prev).outS - inS) < 0.05;
        if (!contiguous) jumpCuts++;
      } else crossCuts++;
    }
  });
  if (jumpCuts > 0 && crossCuts > 0 && jumpCuts <= 2)
    findings.push({ severity: "warn", rule: "ch15 use jump cuts consistently or not at all", message: `${jumpCuts} jump cut(s) among ${crossCuts} conventional cuts: one accidental jump cut reads as an error`, fix: "cover the jump with a different angle / B-roll (overlay track) or commit to jump cuts as the style" });
  // Text overlays straddling a cut (ch31: don't put a lower third over a cut).
  let t = 0;
  const cutTimes: number[] = [];
  for (const x of segs) {
    t += x.durationS;
    cutTimes.push(+t.toFixed(3));
  }
  cutTimes.pop();
  for (const o of s.textOverlays) {
    const endS = o.endS ?? t;
    const crossed = cutTimes.filter((c) => c > o.startS + 0.1 && c < endS - 0.1);
    if (crossed.length) findings.push({ severity: "warn", rule: "ch31 don't put a lower third over a cut", message: `text "${o.text.slice(0, 40)}" (${o.startS}–${endS.toFixed(1)}s) sits across ${crossed.length} cut(s) at ${crossed.map((c) => c.toFixed(1)).join(", ")}s`, fix: "retime it to sit on one shot, or accept it for a title card" });
  }
  // Transition meaning (ch20).
  if (s.transition !== "NONE") {
    const ms = s.transitionMs;
    const meaning = ms <= 400 ? "a softened cut" : ms <= 2000 ? "a time passage" : "a statement";
    findings.push({ severity: "info", rule: "ch20 dissolve duration sets its meaning", message: `every cut uses ${s.transition} at ${ms} ms — reads as ${meaning}; the straight cut is the default and dissolves are punctuation`, fix: "set transition NONE unless you can name the reason" });
  }
  return { cuts: cutTimes, jumpCuts, conventionalCuts: crossCuts, findings };
}

export function beatAlignment(cutTimes: number[], beatsS: number[], toleranceS: number) {
  const rows = cutTimes.map((c) => {
    let best = Infinity;
    let beat = -1;
    beatsS.forEach((b, i) => {
      const d = Math.abs(b - c);
      if (d < best) {
        best = d;
        beat = i;
      }
    });
    const onBar = beat >= 0 && beat % 4 === 0;
    const onPhrase = beat >= 0 && beat % 16 === 0;
    return { cutS: c, nearestBeatS: beat >= 0 ? beatsS[beat] : null, offsetMs: beat >= 0 ? Math.round((c - beatsS[beat]) * 1000) : null, onGrid: best <= toleranceS, onBar, onPhrase };
  });
  const onGrid = rows.filter((r) => r.onGrid).length;
  return { rows, onGrid, total: rows.length, onGridPct: rows.length ? Math.round((onGrid / rows.length) * 100) : null };
}

const LOUDNESS_TARGETS: Record<string, { lufs: number; tolerance: number; truePeakMax: number; note: string }> = {
  web: { lufs: -14, tolerance: 2, truePeakMax: -1, note: "YouTube / social (ch29: web & social −14 to −16 LUFS)" },
  social: { lufs: -14, tolerance: 2, truePeakMax: -1, note: "short-form vertical" },
  streaming: { lufs: -24, tolerance: 3, truePeakMax: -2, note: "streaming services −24 to −27 LUFS; verify the service's spec" },
  broadcast: { lufs: -23, tolerance: 1, truePeakMax: -1, note: "EBU R128" },
  none: { lufs: NaN, tolerance: 0, truePeakMax: -1, note: "no loudness target" },
};

export function registerVerifyTools(server: McpServer) {
  server.registerTool(
    "pacing_report",
    {
      title: "Pacing report",
      description: "Shot count, average/median shot length, spread, min/max and a duration histogram for the main sequence (guide ch.16), with flags for sub-10-frame shots and near-uniform pacing, and a comparison against a genre norm if you name one (classical, drama, documentary, comedy, action, music_video, social, commercial).",
      inputSchema: { projectId: z.string(), genre: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, genre }) => text(pacingReport(await snapshot(projectId), genre))),
  );

  server.registerTool(
    "check_cuts",
    {
      title: "Check the cuts",
      description:
        "Mechanical checks on every cut of the main sequence: in/out points landing inside a spoken word (needs a transcript — pass transcribe=true to make one per source at the given model), kept dead air inside shots, flash frames, lone jump cuts among conventional cuts, text overlays straddling a cut, and transition use. Cites the guide chapter for each finding.",
      inputSchema: { projectId: z.string(), transcribe: z.boolean().default(false), model: z.enum(["tiny", "base", "small", "medium", "large-v3"]).default("base") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, transcribe, model }) => {
      const s = await snapshot(projectId);
      const assets = [...new Set(mainSequence(s).map((x) => x.sourceAssetId).filter((x): x is string => !!x))];
      const transcripts = new Map<string, Transcript | null>();
      const silences = new Map<string, { startS: number; endS: number; durationS: number }[]>();
      for (const id of assets) {
        let tr: Transcript | null = null;
        try {
          tr = await api.get<Transcript>(`/api/assets/${id}/transcribe?model=${model}`);
        } catch {
          if (transcribe) tr = await api.post<Transcript>(`/api/assets/${id}/transcribe`, { model });
        }
        transcripts.set(id, tr);
        try {
          const sil = await api.get<{ silences: { startS: number; endS: number; durationS: number }[] }>(`/api/assets/${id}/silences?noise=-35&min=0.5`);
          silences.set(id, sil.silences);
        } catch {
          silences.set(id, []);
        }
      }
      const r = checkCuts(s, { transcripts, silences });
      const untranscribed = assets.filter((id) => !transcripts.get(id));
      return text({ ...r, transcriptsUsed: assets.length - untranscribed.length, untranscribedSources: untranscribed, hint: untranscribed.length ? "mid-word checks skipped for sources without a transcript — call again with transcribe=true" : undefined });
    }),
  );

  server.registerTool(
    "analyze_audio",
    {
      title: "Analyze audio",
      description: "Integrated loudness (LUFS), true peak and loudness range; silence spans; tempo (BPM) and the beat grid — for any asset (source, music bed, draft, final). Beat grid feeds check_beat_alignment; loudness feeds verify_export (guide ch.28–29).",
      inputSchema: { assetId: z.string(), kinds: z.array(z.enum(["loudness", "silence", "tempo"])).default(["loudness", "silence", "tempo"]) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, kinds }) => {
      const info = await assetInfo(assetId);
      return text(await api.post(`/api/audio/analyze`, { projectId: info.projectId, assetId, kinds }));
    }),
  );

  server.registerTool(
    "check_beat_alignment",
    {
      title: "Check cuts against the beat",
      description: "Where every cut of the main sequence falls relative to the music's beat grid (guide ch.28: land cuts within 1–2 frames of the beat when cutting to it; cut on structure — bars and phrases — before beats). Uses the project's music bed unless musicAssetId names another asset. Transition overlap is ignored.",
      inputSchema: { projectId: z.string(), musicAssetId: z.string().optional(), toleranceFrames: z.number().min(0).max(10).default(2) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, musicAssetId, toleranceFrames }) => {
      const s = await snapshot(projectId);
      const music = musicAssetId ?? s.musicAssetId;
      if (!music) throw new Error("no music: set_music first or pass musicAssetId");
      const tempo = await api.post<{ tempo: { bpm: number | null; beatsS: number[] } | null }>(`/api/audio/analyze`, { projectId, assetId: music, kinds: ["tempo"] });
      const beats = tempo.tempo?.beatsS ?? [];
      if (!beats.length) throw new Error("beat detection returned no beats (needs the Python venv with librosa)");
      let t = 0;
      const cuts: number[] = [];
      for (const x of mainSequence(s)) {
        t += x.durationS;
        cuts.push(+t.toFixed(3));
      }
      cuts.pop();
      const r = beatAlignment(cuts, beats, toleranceFrames * FRAME);
      const off = r.rows.filter((x) => !x.onGrid);
      return text({ bpm: tempo.tempo?.bpm ?? null, beats: beats.length, toleranceMs: Math.round(toleranceFrames * FRAME * 1000), ...r, offGrid: off, hint: off.length ? "nudge durationS of the preceding shot by the offset to land the cut; keep a few cuts off-grid on purpose (ch16: don't cut on every beat)" : undefined });
    }),
  );

  server.registerTool(
    "verify_export",
    {
      title: "Verify an export",
      description:
        "Technical verification of a rendered file (guide ch.32): probe (duration, size, codec), duration/frame against an expected length, black stretches, frozen picture, head/tail silence, integrated loudness and true peak against a platform target (web, social, streaming, broadcast, none). Returns pass/fail with findings. Works on drafts and finals.",
      inputSchema: {
        assetId: z.string(),
        target: z.enum(["web", "social", "streaming", "broadcast", "none"]).default("web"),
        expectedDurationS: z.number().min(0).optional(),
        expectedWidth: z.number().int().optional(),
        expectedHeight: z.number().int().optional(),
        toleranceFrames: z.number().min(0).max(30).default(1),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ assetId, target, expectedDurationS, expectedWidth, expectedHeight, toleranceFrames }) => {
      const info = await assetInfo(assetId);
      const a = await api.get<{ black: { startS: number; endS: number; durationS: number }[] | null; frozen: { startS: number; endS: number; durationS: number }[] | null; loudness: { integratedLufs: number | null; truePeakDb: number | null; loudnessRange: number | null } | { error: string } | null; silences: { startS: number; endS: number; durationS: number }[] | null }>(`/api/assets/${assetId}/analyze`);
      const findings: Finding[] = [];
      const dur = info.durationS;
      if (expectedDurationS != null && Math.abs(dur - expectedDurationS) > toleranceFrames * FRAME)
        findings.push({ severity: "error", rule: "ch32 verify technically: duration to the frame", message: `duration ${dur.toFixed(3)} s vs expected ${expectedDurationS} s (Δ ${((dur - expectedDurationS) * FPS).toFixed(1)} frames)` });
      if (expectedWidth && expectedHeight && info.video && (info.video.width !== expectedWidth || info.video.height !== expectedHeight))
        findings.push({ severity: "error", rule: "ch32 resolution per spec", message: `${info.video.width}x${info.video.height} vs expected ${expectedWidth}x${expectedHeight}` });
      if (!info.video) findings.push({ severity: "error", rule: "ch32", message: "no video stream" });
      for (const b of a.black ?? []) {
        const edge = b.startS < 0.5 || b.endS > dur - 0.5;
        findings.push({ severity: edge ? "info" : "error", rule: "ch32 detect black frames", atS: b.startS, message: `${b.durationS.toFixed(2)} s of black at ${b.startS.toFixed(2)}s${edge ? " (head/tail — a fade?)" : ""}` });
      }
      for (const f of a.frozen ?? []) findings.push({ severity: "warn", rule: "ch32 detect frozen frames", atS: f.startS, message: `picture frozen for ${f.durationS.toFixed(2)} s at ${f.startS.toFixed(2)}s` });
      const sil = a.silences ?? [];
      if (sil.length === 1 && sil[0].durationS >= dur - 0.2) findings.push({ severity: "error", rule: "ch32 silent audio", message: "the whole file is silent" });
      else for (const x of sil) {
        if (x.startS < 0.1 && x.durationS > 0.5) findings.push({ severity: "warn", rule: "ch32 silence at head", atS: 0, message: `${x.durationS.toFixed(2)} s of silence at the head` });
        else if (x.endS > dur - 0.1 && x.durationS > 1) findings.push({ severity: "info", rule: "ch32 silence at tail", atS: x.startS, message: `${x.durationS.toFixed(2)} s of silence at the tail` });
        else if (x.durationS >= 2) findings.push({ severity: "warn", rule: "ch27 never leave true silence in a dialogue track", atS: x.startS, message: `${x.durationS.toFixed(2)} s of silence at ${x.startS.toFixed(2)}s` });
      }
      const tgt = LOUDNESS_TARGETS[target];
      const lo = a.loudness && "integratedLufs" in a.loudness ? a.loudness : null;
      if (lo && Number.isFinite(tgt.lufs) && lo.integratedLufs != null && Math.abs(lo.integratedLufs - tgt.lufs) > tgt.tolerance)
        findings.push({ severity: "error", rule: `ch29 loudness standards by platform (${tgt.note})`, message: `integrated ${lo.integratedLufs.toFixed(1)} LUFS vs target ${tgt.lufs} ±${tgt.tolerance}`, fix: "update_project audioNormalize=true renders to the target; or adjust musicVolume / voVolume" });
      if (lo && lo.truePeakDb != null && lo.truePeakDb > tgt.truePeakMax)
        findings.push({ severity: "warn", rule: "ch29 true peak", message: `true peak ${lo.truePeakDb.toFixed(1)} dBTP above ${tgt.truePeakMax}` });
      const errors = findings.filter((f) => f.severity === "error").length;
      return text({ pass: errors === 0, errors, warnings: findings.filter((f) => f.severity === "warn").length, file: { path: info.path, durationS: dur, sizeBytes: info.sizeBytes, video: info.video }, loudness: lo, target: tgt.note, findings });
    }),
  );

  server.registerTool(
    "compare_versions",
    {
      title: "Compare versions (change list)",
      description: "Change list between a checkpoint and the current project (or between two checkpoints): segments added, removed and changed (trim, duration, speed, mute, position), runtime before/after, and changed project settings (guide ch.24 change list, ch.25 collateral damage).",
      inputSchema: { projectId: z.string(), fromCheckpointId: z.string(), toCheckpointId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, fromCheckpointId, toCheckpointId }) => {
      type CpRow = Record<string, unknown> & { id: string; index: number; durationS: number; trimStartS: number; speed: number; muted: boolean; offsetS: number; track: number; sourceAssetId: string | null };
      type Cp = { id: string; label: string | null; createdAt: string; data: { project: Record<string, unknown>; segments: CpRow[]; textOverlays: unknown[] } };
      const from = await api.get<Cp>(`/api/projects/${projectId}/checkpoints/${fromCheckpointId}`);
      let toSegs: CpRow[];
      let toProject: Record<string, unknown>;
      let toLabel: string;
      if (toCheckpointId) {
        const to = await api.get<Cp>(`/api/projects/${projectId}/checkpoints/${toCheckpointId}`);
        toSegs = to.data.segments;
        toProject = to.data.project;
        toLabel = to.label ?? to.id;
      } else {
        const s = await snapshot(projectId);
        toSegs = s.segments as unknown as CpRow[];
        toProject = { title: s.title, transition: s.transition, transitionMs: s.transitionMs, colorLook: s.colorLook, captionsEnabled: s.captionsEnabled, exportCodec: s.exportCodec, musicAssetId: s.musicAssetId, musicVolume: s.musicVolume };
        toLabel = "now";
      }
      const fields = ["index", "trimStartS", "durationS", "speed", "muted", "offsetS", "track", "sourceAssetId"] as const;
      const a = new Map(from.data.segments.map((x) => [x.id, x]));
      const b = new Map(toSegs.map((x) => [x.id, x]));
      const added = toSegs.filter((x) => !a.has(x.id)).map((x) => ({ id: x.id, index: x.index, durationS: x.durationS, trimStartS: x.trimStartS }));
      const removed = from.data.segments.filter((x) => !b.has(x.id)).map((x) => ({ id: x.id, index: x.index, durationS: x.durationS, trimStartS: x.trimStartS }));
      const changed: { id: string; changes: Record<string, { from: unknown; to: unknown }> }[] = [];
      for (const [id, x] of a) {
        const y = b.get(id);
        if (!y) continue;
        const ch: Record<string, { from: unknown; to: unknown }> = {};
        for (const f of fields) if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) ch[f] = { from: x[f], to: y[f] };
        if (Object.keys(ch).length) changed.push({ id, changes: ch });
      }
      const runtime = (rows: CpRow[]) => +rows.filter((r) => r.track === 0 && !(r as { audioOnly?: boolean }).audioOnly).reduce((s, r) => s + r.durationS, 0).toFixed(3);
      const settings: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of Object.keys(toProject)) {
        if (k in from.data.project && JSON.stringify(from.data.project[k]) !== JSON.stringify(toProject[k])) settings[k] = { from: from.data.project[k], to: toProject[k] };
      }
      return text({ from: { id: from.id, label: from.label, createdAt: from.createdAt, runtimeS: runtime(from.data.segments), segments: from.data.segments.length }, to: { label: toLabel, runtimeS: runtime(toSegs), segments: toSegs.length }, added, removed, changed, settings, untouched: from.data.segments.length - removed.length - changed.length });
    }),
  );
}
