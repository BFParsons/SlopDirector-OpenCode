/**
 * Mechanical checks from the editing guide (guide/editing-guide.md), stated
 * there as "*Mechanical check:*" under the craft rules. Each tool cites the
 * chapter it enforces so an agent (or a person) can read the rationale.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Segment, type Snapshot, assetInfo, snapshot, frameOf } from "../client";
import { guarded, text } from "../format";
import { styleById } from "../../src/lib/styles";
import { sourceAudioCovers, sourceMusicFinding } from "../../src/lib/audio/source-music";
import { planSchema } from "../../src/lib/validation/brief";
import { checkText, typeSystemFor } from "../../src/lib/typography";

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

export function pacingReport(s: Snapshot, genre?: string, styleId?: string) {
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
  const style = styleById(styleId);
  if (style) {
    const [lo, hi] = style.params.aslS;
    comparison = st.aslS < lo ? `faster than ${style.name}'s starting range (${lo}–${hi} s)` : st.aslS > hi ? `slower than ${style.name}'s starting range (${lo}–${hi} s)` : `inside ${style.name}'s starting range (${lo}–${hi} s)`;
    const floor = style.params.minShotS;
    segs.forEach((x, i) => {
      if (x.durationS < floor && x.durationS >= 10 * FRAME) findings.push({ severity: "warn", rule: `style: ${style.name} shot floor`, segmentId: x.id, index: i, message: `shot ${i} is ${x.durationS.toFixed(2)} s; below the ${floor} s starting preference; review the intended effect and selected reference` });
    });
  } else if (genre) {
    const ref = GENRE_ASL[genre];
    if (ref) {
      comparison = st.aslS < ref[0] ? `faster than the ${genre} norm (${ref[0]}–${ref[1]} s)` : st.aslS > ref[1] ? `slower than the ${genre} norm (${ref[0]}–${ref[1]} s)` : `inside the ${genre} norm (${ref[0]}–${ref[1]} s)`;
    }
  }
  return { ...st, histogram: buckets, genre: genre ?? null, style: style ? { id: style.id, name: style.name, aslS: style.params.aslS, minShotS: style.params.minShotS } : null, comparison, references: GENRE_ASL, findings };
}

type Transcript = { words: { startS: number; endS: number; text: string }[]; segments: { startS: number; endS: number; text: string }[] };

/** Whisper emits non-words on music and noise ("ʔʔʔ", "♪"); only lexical words count. */
const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t);

export function midWordCut(words: Transcript["words"], pointS: number, tolS: number) {
  return words.find((w) => isWord(w.text) && w.startS + tolS < pointS && w.endS - tolS > pointS) ?? null;
}

export function checkCuts(
  s: Snapshot,
  opts: { transcripts: Map<string, Transcript | null>; silences: Map<string, { startS: number; endS: number; durationS: number }[]>; sceneCuts?: Map<string, number[]> },
) {
  const segs = mainSequence(s);
  const findings: Finding[] = [];
  const tol = 0.04;
  let jumpCuts = 0;
  let crossCuts = 0;
  const jumpCutAt: { afterShot: number; atS: number; skippedS: number }[] = [];
  // Narration / unlinked audio clips: their in/out points must sit in pauses too (ch17).
  for (const x of s.segments.filter((a) => a.audioOnly && !a.library)) {
    const tr = x.sourceAssetId ? opts.transcripts.get(x.sourceAssetId) : null;
    if (!tr?.words.length) continue;
    const { inS, outS } = sourceRange(x);
    for (const [label, p] of [["in-point", inS], ["out-point", outS]] as const) {
      const w = midWordCut(tr.words, p, tol);
      if (w) findings.push({ severity: "error", rule: "ch17 cut in the pauses, never inside a word (audio clip)", segmentId: x.id, atS: x.offsetS, message: `${label} of the audio clip at ${x.offsetS}s lands inside the word "${w.text}" (${w.startS}–${w.endS}s of the source)`, fix: label === "in-point" ? `trimStartS ${w.startS.toFixed(3)}` : `end at ${w.endS.toFixed(3)} (extend) or ${w.startS.toFixed(3)} (shorten)` });
    }
  }
  segs.forEach((x, i) => {
    const { inS, outS } = sourceRange(x);
    if (x.durationS < 6 * FRAME) findings.push({ severity: "error", rule: "ch16 / ch32 flash frame", segmentId: x.id, index: i, message: `shot ${i} is ${Math.round(x.durationS * FPS)} frames long`, fix: "delete it or extend durationS" });
    // Speech matters only when this clip's own audio is heard (muted=false).
    const tr = x.sourceAssetId && x.muted === false ? opts.transcripts.get(x.sourceAssetId) : null;
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
        const prevOut = sourceRange(prev).outS;
        const contiguous = Math.abs(prevOut - inS) < 0.05;
        // A cut between two different shots of a multi-shot source is a
        // conventional cut; a jump cut is a skip within ONE shot.
        const scenes = opts.sceneCuts?.get(x.sourceAssetId) ?? [];
        const lo = Math.min(prevOut, inS);
        const hi = Math.max(prevOut, inS);
        const sameShot = !scenes.some((c) => c > lo && c < hi);
        if (!contiguous && sameShot) {
          jumpCuts++;
          jumpCutAt.push({ afterShot: i - 1, atS: +segs.slice(0, i).reduce((a, b) => a + b.durationS, 0).toFixed(3), skippedS: +(inS - prevOut).toFixed(3) });
        } else crossCuts++;
      } else crossCuts++;
    }
  });
  if (jumpCuts > 0 && crossCuts > 0 && jumpCuts <= 2)
    findings.push({ severity: "warn", rule: "ch15 use jump cuts consistently or not at all", message: `${jumpCuts} jump cut(s) among ${crossCuts} conventional cuts: ${jumpCutAt.map((j) => `at ${j.atS}s (shot ${j.afterShot} → ${j.afterShot + 1}, same source shot, ${j.skippedS > 0 ? `${j.skippedS}s skipped` : `${-j.skippedS}s repeated`})`).join("; ")} — one accidental jump cut reads as an error`, fix: "cover the jump with a different angle / B-roll (overlay track), make the two shots contiguous, or commit to jump cuts as the style" });
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
  return { cuts: cutTimes, jumpCuts, jumpCutAt, conventionalCuts: crossCuts, findings };
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
      inputSchema: { projectId: z.string(), genre: z.string().optional(), style: z.string().optional().describe("a directing style id (list_styles); its pacing norm replaces the genre's. Default: the brief's style, if any") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, genre, style }) => text(pacingReport(await snapshot(projectId), genre, style ?? (await briefInfo(projectId)).styleId ?? undefined))),
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
      const videoAssets = [...new Set(mainSequence(s).map((x) => x.sourceAssetId).filter((x): x is string => !!x))];
      const audioAssets = [...new Set(s.segments.filter((x) => x.audioOnly && !x.library).map((x) => x.sourceAssetId).filter((x): x is string => !!x))];
      const assets = [...new Set([...videoAssets, ...audioAssets])];
      const transcripts = new Map<string, Transcript | null>();
      const silences = new Map<string, { startS: number; endS: number; durationS: number }[]>();
      const sceneCuts = new Map<string, number[]>();
      // Per-asset lookups run in parallel (each is an ffmpeg pass on the server).
      await Promise.all(
        assets.map(async (id) => {
          const [tr, sc, sil] = await Promise.all([
            (async () => {
              for (const m of [model, "small", "base", "medium", "tiny", "large-v3"].filter((v, i, a) => a.indexOf(v) === i)) {
                try {
                  return await api.get<Transcript>(`/api/assets/${id}/transcribe?model=${m}`);
                } catch {
                  /* not cached for this model */
                }
              }
              return transcribe ? api.post<Transcript>(`/api/assets/${id}/transcribe`, { model }) : null;
            })(),
            videoAssets.includes(id) ? api.get<{ cuts: number[] }>(`/api/assets/${id}/scenes?threshold=0.35`).then((r) => r.cuts).catch(() => [] as number[]) : Promise.resolve([] as number[]),
            api.get<{ silences: { startS: number; endS: number; durationS: number }[] }>(`/api/assets/${id}/silences?noise=-35&min=0.5`).then((r) => r.silences).catch(() => []),
          ]);
          transcripts.set(id, tr);
          if (videoAssets.includes(id)) sceneCuts.set(id, sc);
          silences.set(id, sil);
        }),
      );
      const r = checkCuts(s, { transcripts, silences, sceneCuts });
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
        "Technical verification of a rendered file (guide ch.32): probe (duration, size, codec), duration/frame against an expected length, black stretches, frozen picture, head/tail silence, and — for a project render — whether the music bed the project (and the brief) asks for is actually audible where it plays alone (§7 Sound), integrated loudness and true peak against a platform target (web, social, streaming, broadcast, none). Returns pass/fail with findings. Works on drafts and finals.",
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
      const a = await api.get<{ hasAudio: boolean; black: { startS: number; endS: number; durationS: number }[] | null; frozen: { startS: number; endS: number; durationS: number }[] | null; loudness: { integratedLufs: number | null; truePeakDb: number | null; loudnessRange: number | null } | { error: string } | null; silences: { startS: number; endS: number; durationS: number }[] | null }>(`/api/assets/${assetId}/analyze`);
      const findings: Finding[] = [];
      const dur = info.durationS;
      if (expectedDurationS != null && Math.abs(dur - expectedDurationS) > toleranceFrames * FRAME)
        findings.push({ severity: "error", rule: "ch32 verify technically: duration to the frame", message: `duration ${dur.toFixed(3)} s vs expected ${expectedDurationS} s (Δ ${((dur - expectedDurationS) * FPS).toFixed(1)} frames)` });
      if (expectedWidth && expectedHeight && info.video && (info.video.width !== expectedWidth || info.video.height !== expectedHeight))
        findings.push({ severity: "error", rule: "ch32 resolution per spec", message: `${info.video.width}x${info.video.height} vs expected ${expectedWidth}x${expectedHeight}` });
      if (!info.video) findings.push({ severity: "error", rule: "ch32", message: "no video stream" });
      if (a.hasAudio === false) findings.push({ severity: target === "none" ? "warn" : "error", rule: "ch32 verify technically: audio channels", message: "the file has NO audio stream (every shot muted, no music, no narration?) — see check_soundtrack" });
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
      // The score: a render can pass loudness and silence and still be missing its bed.
      let music: Awaited<ReturnType<typeof musicBedCheck>> | null = null;
      if (info.kind === "DRAFT_MP4" || info.kind === "FINAL_MP4") {
        try {
          music = await musicBedCheck(info.projectId, assetId);
          findings.push(...music.findings);
        } catch (e) {
          findings.push({ severity: "warn", rule: "§7 Sound: the bed in the render", message: `could not check the music bed: ${(e as Error).message}` });
        }
      }
      // Burned-in text: inside the safe areas, readable, held long enough (§12).
      let textCheck: { profile: string; overlays: number; pass: boolean } | null = null;
      if (info.kind === "DRAFT_MP4" || info.kind === "FINAL_MP4") {
        try {
          const sp = await snapshot(info.projectId);
          const f = frameOf(sp);
          const tc = checkText(sp.textOverlays, { w: f.w, h: f.h }, sp.safeArea, dur, typeSystemFor((await briefInfo(info.projectId)).styleId) ?? null);
          findings.push(...tc.findings.map((x) => ({ severity: x.severity, rule: x.rule, message: x.message, fix: x.fix })));
          textCheck = { profile: tc.safe.profile, overlays: sp.textOverlays.length, pass: tc.pass };
        } catch {
          /* not a project render */
        }
      }
      const errors = findings.filter((f) => f.severity === "error").length;
      return text({ pass: errors === 0, errors, warnings: findings.filter((f) => f.severity === "warn").length, file: { path: info.path, durationS: dur, sizeBytes: info.sizeBytes, video: info.video }, music: music ? { bed: music.bed, loudestSoloLufs: music.loudestSoloLufs, soloStretches: music.soloStretches.length } : null, text: textCheck, loudness: lo, target: tgt.note, findings });
    }),
  );

  server.registerTool(
    "check_soundtrack",
    {
      title: "Check the soundtrack",
      description:
        "The audio map of the timeline (guide ch.27–29 and Part II §7 'Sound'): which layers sound when — unmuted shot audio, narration / audio-only clips, the voiceover, the music bed (volume, ducking, fade; set when the brief asks for one, audible, long enough for the cut), audio overlays — and findings: source narration or music bleeding through unmuted shots under the bed or narration (the classic clash), narration clips overlapping, two music sources at once, music that never ducks or never ends, clips past the end, or a silent film. Run before every render_draft.",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId }) => text(await soundtrackReport(projectId))),
  );

  server.registerTool(
    "check_mix_levels",
    {
      title: "Check voice-vs-music levels",
      description:
        "Measures a rendered file (the latest draft by default) the way a mixer reads it: short-term loudness in the speech windows (narration clips / voiceover) vs the music-only stretches, the gap between them, and the estimated speech-to-music ratio under speech. Targets (guide Part II §7 'Levels', ch.29): speech windows −14…−16 LUFS for a −14 program, music-only stretches 4–8 LU under the speech, ratio under speech ≥ 12 LU (≥ 8 for music-driven pieces). Run after render_draft; fix with balance_music.",
      inputSchema: { projectId: z.string(), assetId: z.string().optional().describe("a draft or final asset; default: the latest draft"), musicDriven: z.boolean().default(false) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, assetId, musicDriven }) => text(await mixLevels(projectId, assetId, musicDriven))),
  );

  server.registerTool(
    "balance_music",
    {
      title: "Balance the music under the voice",
      description:
        "Sets musicVolume from measured loudness so the bed sits `gapLu` (default 6) below the narration in the stretches where the music plays alone (with ducking it drops a further ~10 LU under speech). Measures the narration sources (audio-only clips / voiceover) and the music asset; reports the numbers it used. Then render_draft and check_mix_levels.",
      inputSchema: { projectId: z.string(), gapLu: z.number().min(0).max(30).default(6) },
    },
    guarded(async ({ projectId, gapLu }) => text(await balanceMusic(projectId, gapLu))),
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

// ---------------------------------------------------------------------------
// Soundtrack map + findings (Part II §7 "Sound: how SlopStudio builds the mix")
// ---------------------------------------------------------------------------
type Range = { startS: number; endS: number };
const overlaps = (a: Range, b: Range) => a.startS < b.endS - 0.05 && b.startS < a.endS - 0.05;

export async function soundtrackReport(projectId: string) {
  const s = await snapshot(projectId);
  const main = mainSequence(s);
  let t = 0;
  const shots = main.map((x, i) => {
    const r = { index: i, id: x.id, startS: +t.toFixed(3), endS: +(t + x.durationS).toFixed(3), muted: x.muted, sourceAssetId: x.sourceAssetId, source: sourceRange(x) };
    t += x.durationS;
    return r;
  });
  const timelineS = +t.toFixed(3);
  const narration = s.segments.filter((x) => x.audioOnly && !x.library).map((x) => ({ id: x.id, startS: x.offsetS, endS: +(x.offsetS + x.durationS).toFixed(3), sourceAssetId: x.sourceAssetId }));
  const overlaysOn = s.audioOverlays.filter((o) => o.included && o.status === "READY");
  const music = s.musicAssetId ? { assetId: s.musicAssetId, volume: s.musicVolume, ducking: s.musicDucking, muted: s.musicMuted } : null;
  const vo = s.audioMode !== "NONE" ? { mode: s.audioMode, ready: !!s.voiceover?.assetId, durationS: s.voiceover?.durationS ?? null } : null;
  const findings: Finding[] = [];

  // What is in the unmuted shots' source audio?
  const audible = shots.filter((x) => !x.muted && x.sourceAssetId);
  const cache = new Map<string, { speech: Range[]; words: { startS: number; endS: number; text: string }[] | null }>();
  await Promise.all(
    [...new Set(audible.map((x) => x.sourceAssetId!))].map(async (id) => {
      const [speech, words] = await Promise.all([
        api.get<{ speech: Range[] }>(`/api/assets/${id}/silences?noise=-35&min=0.5`).then((r) => r.speech).catch(() => [] as Range[]),
        (async () => {
          for (const m of ["small", "base", "medium", "tiny", "large-v3"]) {
            try {
              return (await api.get<{ words: { startS: number; endS: number; text: string }[] }>(`/api/assets/${id}/transcribe?model=${m}`)).words.filter((w) => /[\p{L}\p{N}]/u.test(w.text));
            } catch {
              /* not cached */
            }
          }
          return null;
        })(),
      ]);
      cache.set(id, { speech, words });
    }),
  );
  const shotAudio = audible.map((x) => {
    const c = cache.get(x.sourceAssetId!)!;
    const src = { startS: x.source.inS, endS: x.source.outS };
    const hasSound = c.speech.some((r) => overlaps(r, src));
    const spokenWords = c.words ? c.words.filter((w) => w.startS < src.endS && w.endS > src.startS).length : null;
    return { ...x, hasSound, spokenWords };
  });

  const underBed = !!music && !music.muted && (music.volume ?? 0) > 0;
  // Audits apply to the actual audible asset/range, including extracted dialogue
  // on audio-only tracks. Missing/stale plans cannot certify a clean soundtrack.
  if (underBed) {
    const raw = await api.get<{ plan: unknown }>(`/api/projects/${projectId}/plan`).catch(() => null);
    const parsed = planSchema.safeParse(raw?.plan);
    const planned = parsed.success ? parsed.data.shots : [];
    const audits = planned.flatMap(x => x.sourceAudio ? [x.sourceAudio] : []);
    const candidates = s.segments.filter(x => !x.library && x.sourceAssetId && x.volume > 0 && (x.audioOnly || !x.muted));
    for (const x of candidates) {
      const range = sourceRange(x);
      const matching = audits.filter(a => sourceAudioCovers(a, x.sourceAssetId!, range.inS, range.outS));
      // Conflicting records must not let a clean record hide known contamination.
      const audit = matching.find(a => a.music === "present") ?? matching.find(a => !sourceMusicFinding(a)) ?? matching[0];
      const originalStillAudible = planned.some(p => p.source.assetId === x.sourceAssetId && p.sourceAudio?.originalMusic === "present" && p.source.section && p.source.section.startS < range.outS && p.source.section.endS > range.inS && p.sourceAudio.treatment !== "original");
      const finding = originalStillAudible
        ? { severity: "error" as const, message: "The original music-containing clip is still audible despite planned isolation/replacement. Mute the original and use the cleaned stem." }
        : sourceMusicFinding(audit);
      if (finding) findings.push({ ...finding, rule: "sound: embedded source music", segmentId: x.id, fix: "Follow get_playbook film-dialogue; record sourceAudio for the exact audible asset/range. Pending review is not a clean pass." });
    }
  }
  for (const x of shotAudio) {
    if (!x.hasSound) continue;
    const underNarration = narration.some((n) => overlaps(n, x)) || (vo?.ready ?? false);
    if (x.spokenWords && x.spokenWords > 0 && underNarration) {
      findings.push({ severity: "error", rule: "§7 Sound: B-roll under narration or music is muted", segmentId: x.id, index: x.index, atS: x.startS, message: `shot ${x.index} (${x.startS}–${x.endS}s) is unmuted and its source has speech (${x.spokenWords} words) under the narration — two voices / the source's narration bleeds through`, fix: "update_segments muted:true (keep sound only where the sound is the point), or move the narration off it" });
    } else if (x.spokenWords && x.spokenWords > 0 && underBed) {
      // Speech may be intentional, but it can still carry embedded film music.
      // The separate source-audio audit above is required before mix approval.
      findings.push({ severity: "info", rule: "§7 Sound: sound bite over the bed", segmentId: x.id, index: x.index, atS: x.startS, message: `shot ${x.index} (${x.startS}–${x.endS}s) is a sound bite (${x.spokenWords} words) over the music bed — verify embedded music separately, then level it against the narration with the clip's volume (check_mix_levels reads bites as speech windows)`, fix: "update_segments volume:<gain> if the bite sits far from the narration level" });
    } else if (underNarration) {
      findings.push({ severity: "warn", rule: "§7 Sound: sync sound under narration", segmentId: x.id, index: x.index, atS: x.startS, message: `shot ${x.index} (${x.startS}–${x.endS}s) is unmuted with sound in its source while narration plays`, fix: "mute it, or lower it — the narration must stay intelligible (rule 20)" });
    } else if (underBed && x.spokenWords == null) {
      findings.push({ severity: "warn", rule: "§7 Sound: unmuted shot under the music bed", segmentId: x.id, index: x.index, atS: x.startS, message: `shot ${x.index} (${x.startS}–${x.endS}s) is unmuted under the music bed and its source has sound (no transcript — could be the source's own music or narration)`, fix: "audition for embedded music, select clean audio or isolate and review; a transcript alone cannot clear it" });
    }
  }
  // Narration overlaps / runs past the end.
  for (let i = 0; i < narration.length; i++) {
    for (let j = i + 1; j < narration.length; j++) {
      if (overlaps(narration[i], narration[j])) findings.push({ severity: "error", rule: "§7 Sound: one narrator at a time", atS: Math.max(narration[i].startS, narration[j].startS), message: `narration clips overlap (${narration[i].startS}–${narration[i].endS}s and ${narration[j].startS}–${narration[j].endS}s)` });
    }
    if (narration[i].endS > timelineS + 0.05) findings.push({ severity: "error", rule: "§7 Sound: audio must fit the picture", atS: narration[i].startS, message: `narration clip ends at ${narration[i].endS}s but the picture ends at ${timelineS}s` });
  }
  // Music bed vs overlays, ducking, fade.
  if (underBed && overlaysOn.length) findings.push({ severity: "warn", rule: "§7 Sound: one music source", message: `the music bed and ${overlaysOn.length} audio overlay(s) play together (an imported YouTube track is an overlay until set_music makes it the bed) — overlays do not duck`, fix: "set_music with the overlay's file (probe_asset gives the path) and update_project audioOverlays:[{id, included:false}]" });
  if (underBed && !music!.ducking && (narration.length || vo?.ready)) findings.push({ severity: "warn", rule: "ch29 music ducks under speech", message: "music ducking is off while narration plays", fix: "update_project musicDucking:true" });
  if (underBed && (s.audioFadeOutS ?? 0) === 0) findings.push({ severity: "info", rule: "ch28 a cue has a reason to stop", message: "the music bed runs to the last frame with only the built-in 0.75 s fade", fix: "update_project audioFadeOutS (2–3 s) so the cue resolves on picture" });
  findings.push(...(await musicBedSettings(s, projectId)));
  const anySound = underBed || overlaysOn.length > 0 || narration.length > 0 || (vo?.ready ?? false) || shotAudio.some((x) => x.hasSound);
  if (!anySound) findings.push({ severity: "warn", rule: "§7 Sound", message: "nothing on the timeline makes a sound (every shot muted, no music, no narration)" });

  // The map: what sounds when (2-second cells).
  const cells: string[] = [];
  for (let c = 0; c < timelineS; c += 2) {
    const r = { startS: c, endS: Math.min(c + 2, timelineS) };
    const layers: string[] = [];
    if (underBed) layers.push("music");
    if (vo?.ready) layers.push("VO");
    if (narration.some((n) => overlaps(n, r))) layers.push("narration");
    const live = shotAudio.filter((x) => x.hasSound && overlaps(x, r));
    if (live.length) layers.push(`shot-audio(${live.map((x) => x.index).join(",")})`);
    if (overlaysOn.some((o) => overlaps({ startS: o.offsetS, endS: o.offsetS + (o.durationS ?? 9999) }, r))) layers.push("overlay");
    cells.push(`${String(c).padStart(4)}s ${layers.join(" + ") || "—"}`);
  }
  return {
    timelineS,
    layers: { music, voiceover: vo, narrationClips: narration, audioOverlaysOn: overlaysOn.length, unmutedShots: audible.length, unmutedShotsWithSound: shotAudio.filter((x) => x.hasSound).map((x) => ({ index: x.index, startS: x.startS, endS: x.endS, spokenWords: x.spokenWords })), audioNormalize: s.audioNormalize, fadeOutS: s.audioFadeOutS },
    map: cells,
    findings,
    pass: !findings.some((f) => f.severity === "error"),
  };
}

// ---------------------------------------------------------------------------
// Voice vs music levels (Part II §7 "Levels", ch.29)
// ---------------------------------------------------------------------------
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  return +(a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2).toFixed(1);
};
const pct = (xs: number[], p: number) => (xs.length ? +[...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(xs.length * p))].toFixed(1) : null);

/** Estimated gain reduction of the bed's sidechain compressor (threshold ≈ −34 dBFS, ratio 8) for a voice at `voiceLufs`. */
const duckDepthLu = (voiceLufs: number) => +Math.max(0, Math.min(20, (voiceLufs - -34) * (7 / 8))).toFixed(1);

/**
 * Where a voice is meant to be heard: narration clips, the voiceover's spoken
 * ranges, and — sound bites — the spoken ranges of unmuted main-sequence shots,
 * mapped from source time to the timeline.
 */
async function speechWindows(s: Snapshot): Promise<{ startS: number; endS: number }[]> {
  const wins: { startS: number; endS: number }[] = s.segments.filter((x) => x.audioOnly && !x.library).map((x) => ({ startS: x.offsetS, endS: +(x.offsetS + x.durationS).toFixed(3) }));
  if (s.audioMode !== "NONE" && s.voiceover?.assetId) {
    try {
      const sp = await api.get<{ speech: { startS: number; endS: number }[] }>(`/api/assets/${s.voiceover.assetId}/silences?noise=-35&min=0.4`);
      wins.push(...sp.speech);
    } catch {
      /* no speech ranges */
    }
  }
  let t = 0;
  const shots = mainSequence(s).map((x) => {
    const r = { x, startS: t };
    t += x.durationS;
    return r;
  });
  await Promise.all(
    shots
      .filter(({ x }) => !x.muted && x.sourceAssetId)
      .map(async ({ x, startS }) => {
        try {
          const sp = await api.get<{ speech: Range[] }>(`/api/assets/${x.sourceAssetId}/silences?noise=-35&min=0.4`);
          const src = sourceRange(x);
          const speed = x.speed || 1;
          for (const r of sp.speech) {
            const a = Math.max(r.startS, src.inS);
            const b = Math.min(r.endS, src.outS);
            if (b - a > 0.3) wins.push({ startS: +(startS + (a - src.inS) / speed).toFixed(3), endS: +(startS + (b - src.inS) / speed).toFixed(3) });
          }
        } catch {
          /* no speech ranges */
        }
      }),
  );
  return wins.sort((a, b) => a.startS - b.startS);
}

export async function mixLevels(projectId: string, assetId?: string, musicDriven = false) {
  const s = await snapshot(projectId);
  const id = assetId ?? s.finalRender?.draftAssetId ?? s.finalRender?.assetId ?? null;
  if (!id) throw new Error("no rendered file yet — render_draft first (or pass assetId)");
  const a = await api.get<{ hasAudio: boolean; timeline: { t: number; m: number; s: number }[] | null; loudness: { integratedLufs: number | null; truePeakDb: number | null } | null }>(`/api/assets/${id}/analyze?kinds=timeline,loudness,probe`);
  if (!a.hasAudio || !a.timeline?.length) throw new Error("the file has no audio");
  const wins = await speechWindows(s);
  const end = a.timeline[a.timeline.length - 1].t;
  // Short-term loudness (3 s window) needs room; on a short file or short
  // speech windows read the 400 ms momentary meter instead.
  const shortest = Math.min(end, ...wins.map((w) => w.endS - w.startS));
  const metric: "s" | "m" = end < 12 || shortest < 4 ? "m" : "s";
  const edge = metric === "m" ? 0.3 : 1.5;
  const inSpeech = (t: number) => wins.some((w) => t >= w.startS + edge && t <= w.endS - 0.2);
  const nearSpeech = (t: number) => wins.some((w) => t >= w.startS - 0.5 && t <= w.endS + edge);
  const val = (p: { m: number; s: number }) => (metric === "m" ? p.m : p.s);
  const speech = a.timeline.filter((p) => inSpeech(p.t) && val(p) > -70).map(val);
  const musicOnly = a.timeline.filter((p) => !nearSpeech(p.t) && p.t > edge && p.t < end - edge - 1 && val(p) > -70).map(val);
  const hasMusic = !!s.musicAssetId && !s.musicMuted && s.musicVolume > 0;
  const speechMed = median(speech);
  const musicMed = median(musicOnly);
  const gap = speechMed != null && musicMed != null ? +(speechMed - musicMed).toFixed(1) : null;
  // Ducking depth depends on the voice level the compressor actually sees
  // (the source, pre-normalization), not on the normalized mix.
  let voiceSourceLufs: number | null = null;
  if (hasMusic && s.musicDucking) {
    const voices = [...new Set(s.segments.filter((x) => x.audioOnly && !x.library).map((x) => x.sourceAssetId).filter((x): x is string => !!x))];
    if (s.audioMode !== "NONE" && s.voiceover?.assetId) voices.push(s.voiceover.assetId);
    const lv = (await Promise.all(voices.map(async (vid) => (await api.post<{ loudness: { integratedLufs: number | null } | null }>(`/api/audio/analyze`, { projectId, assetId: vid, kinds: ["loudness"] }).catch(() => null))?.loudness?.integratedLufs ?? null))).filter((x): x is number => x != null);
    if (lv.length) voiceSourceLufs = +(lv.reduce((a, b) => a + b, 0) / lv.length).toFixed(1);
  }
  const duck = hasMusic && s.musicDucking ? duckDepthLu(voiceSourceLufs ?? speechMed ?? -20) : 0;
  const smr = gap != null ? +(gap + duck).toFixed(1) : null;
  const findings: Finding[] = [];
  const minSmr = musicDriven ? 8 : 12;
  if (!wins.length) findings.push({ severity: "info", rule: "§7 Levels", message: "no narration / voiceover on the timeline — nothing to balance against" });
  if (wins.length && musicMed == null) findings.push({ severity: "info", rule: "§7 Levels", message: "no music-only stretch to measure — a voice is on nearly every second, so the bed's gap and the ratio under speech are unknown here; judge the bed by ear on the draft, or leave a music-only beat" });
  if (speechMed != null && speechMed < -17) findings.push({ severity: "warn", rule: "§7 Levels: speech is the anchor (−14…−16 LUFS short-term in a −14 program)", message: `speech windows sit at ${speechMed} LUFS`, fix: "the voice is quiet: lower musicVolume so loudnorm lifts the voice, or raise voVolume (voiceover track)" });
  if (hasMusic && gap != null && gap < 4) findings.push({ severity: gap < 0 ? "error" : "warn", rule: "§7 Levels: music-only stretches 4–8 LU under the speech", message: `music-only stretches (${musicMed} LUFS) are ${gap >= 0 ? `only ${gap}` : `${-gap} LU ABOVE`} ${gap >= 0 ? "LU under" : ""} the speech windows (${speechMed} LUFS)`, fix: "balance_music (gapLu 6), then re-render" });
  if (hasMusic && gap != null && gap > 12) findings.push({ severity: "info", rule: "§7 Levels", message: `music-only stretches are ${gap} LU under the speech — the bed may be inaudible between lines`, fix: "balance_music with a smaller gapLu (4)" });
  if (hasMusic && smr != null && smr < minSmr) findings.push({ severity: smr < 6 ? "error" : "warn", rule: `§7 Levels: speech-to-music ratio under speech ≥ ${minSmr} LU`, message: `estimated ${smr} LU (gap ${gap} + ducking ≈ ${duck})`, fix: "balance_music; keep musicDucking on" });
  if (a.loudness?.truePeakDb != null && a.loudness.truePeakDb > -1) findings.push({ severity: "warn", rule: "ch29 true peak ≤ −1 dBTP", message: `true peak ${a.loudness.truePeakDb} dBTP` });
  return {
    assetId: id,
    program: { integratedLufs: a.loudness?.integratedLufs ?? null, truePeakDb: a.loudness?.truePeakDb ?? null },
    speechWindows: wins,
    meter: metric === "m" ? "momentary (400 ms)" : "short-term (3 s)",
    speech: { medianLufs: speechMed, p10: pct(speech, 0.1), p90: pct(speech, 0.9), samples: speech.length },
    musicOnly: { medianLufs: musicMed, p10: pct(musicOnly, 0.1), p90: pct(musicOnly, 0.9), samples: musicOnly.length },
    gapLu: gap,
    voiceSourceLufs,
    duckingEstimateLu: duck,
    speechToMusicUnderSpeechLu: smr,
    targets: { speechLufs: "−14…−16", musicOnlyGapLu: "4–8", smrLu: `≥ ${minSmr}` },
    findings,
    pass: !findings.some((f) => f.severity === "error"),
  };
}

// ---------------------------------------------------------------------------
// Is the music bed really there? (Part II §7 "Sound", ch.28)
// ---------------------------------------------------------------------------
type BriefMusic = { wanted: boolean; brief?: string } | undefined;

/** What the brief says about music and the directing style (both optional; null brief → nothing). */
async function briefInfo(projectId: string): Promise<{ music: BriefMusic; styleId: string | null }> {
  try {
    const r = await api.get<{ brief: { music?: { wanted: boolean; brief?: string }; production?: { style?: { id: string } } } | null }>(`/api/projects/${projectId}/brief`);
    return { music: r.brief?.music ?? undefined, styleId: r.brief?.production?.style?.id ?? null };
  } catch {
    return { music: undefined, styleId: null };
  }
}

const fmtRange = (r: { startS: number; endS: number }) => `${r.startS.toFixed(1)}–${r.endS.toFixed(1)} s`;

/**
 * Settings-level bed findings — no render needed: the brief vs the project
 * (a score asked for but never set, a bed that is set but muted or at ~0, a
 * bed the brief did not ask for) and a bed shorter than the cut (the render
 * does not loop it: from the bed's end the last shots play over silence).
 */
export async function musicBedSettings(s: Snapshot, projectId: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const { music: wanted, styleId } = await briefInfo(projectId);
  const style = styleById(styleId);
  const set = !!s.musicAssetId;
  const audible = set && !s.musicMuted && s.musicVolume > 0.02;
  if (style?.params.music === "none" && set) findings.push({ severity: "warn", rule: `style: ${style.name}`, message: `${style.name} uses no score, but a music bed is set on the project`, fix: "drop the bed, or change the brief's style" });
  if (style?.params.music === "required" && !set) findings.push({ severity: "warn", rule: `style: ${style.name}`, message: `${style.name} runs on music (${style.params.musicKind}); no bed is set`, fix: "set_music then balance_music" });
  if (!set) {
    if (wanted?.wanted)
      findings.push({
        severity: "error",
        rule: "§7 Sound: the bed the brief asked for",
        message: `the brief asks for music${wanted.brief ? ` ("${wanted.brief}")` : ""} but no music bed is set on the project`,
        fix: "set_music (a file, an asset or a YouTube URL) then balance_music — or set the brief's music.wanted to false if the score was dropped on purpose",
      });
    return findings;
  }
  if (!audible)
    findings.push({
      severity: "error",
      rule: "§7 Sound: a bed that cannot be heard",
      message: s.musicMuted ? "a music bed is set but musicMuted is on — it will not be in the render" : `a music bed is set but musicVolume is ${s.musicVolume} — it will not be heard`,
      fix: s.musicMuted ? "update_project musicMuted:false" : "balance_music",
    });
  if (wanted && !wanted.wanted) findings.push({ severity: "warn", rule: "§7 Sound: the brief asked for no music", message: "the brief says no music, but a bed is set on the project" });
  try {
    const m = await assetInfo(s.musicAssetId!);
    const cut = mainSequence(s).reduce((a, x) => a + x.durationS, 0);
    const fade = s.audioFadeOutS ?? 0;
    if (m.durationS > 0 && m.durationS < cut - Math.max(fade, 0.5) - 0.5)
      findings.push({
        severity: "warn",
        rule: "ch28 a cue has a reason to stop",
        atS: m.durationS,
        message: `the bed (${m.durationS.toFixed(1)} s) is shorter than the cut (${cut.toFixed(1)} s): the render does not loop it, so from ${m.durationS.toFixed(1)} s the last shots play over silence`,
        fix: "a longer cue, a shorter cut, or an audioFadeOutS that lands before the bed ends",
      });
  } catch {
    /* no asset info */
  }
  return findings;
}

/**
 * Did the bed make it into the render? Measures the file (momentary meter)
 * in the stretches where only the bed should sound — no narration clip, no
 * voiceover speech, no unmuted shot. A project with a bed that renders
 * silence there is an error: a file can pass loudness and silence checks
 * and still be missing its score.
 */
export async function musicBedCheck(projectId: string, assetId: string) {
  const s = await snapshot(projectId);
  const findings = await musicBedSettings(s, projectId);
  const bed = s.musicAssetId ? { assetId: s.musicAssetId, volume: s.musicVolume, ducking: s.musicDucking, muted: s.musicMuted } : null;
  const audible = !!s.musicAssetId && !s.musicMuted && s.musicVolume > 0.02;
  const empty = { bed, soloStretches: [] as { startS: number; endS: number; medianLufs: number | null }[], loudestSoloLufs: null as number | null, findings };
  if (!audible) return empty;
  const a = await api.get<{ hasAudio: boolean; timeline: { t: number; m: number; s: number }[] | null }>(`/api/assets/${assetId}/analyze?kinds=timeline`);
  if (!a.hasAudio || !a.timeline?.length) {
    findings.push({ severity: "error", rule: "§7 Sound: the bed in the render", message: "a music bed is set but the rendered file has no audio" });
    return empty;
  }
  const end = a.timeline[a.timeline.length - 1].t;
  // Everything on the timeline that is not the bed.
  const busy: Range[] = s.segments.filter((x) => x.audioOnly && !x.library).map((x) => ({ startS: x.offsetS, endS: x.offsetS + x.durationS }));
  let t = 0;
  for (const x of mainSequence(s)) {
    if (!x.muted) busy.push({ startS: t, endS: t + x.durationS });
    t += x.durationS;
  }
  busy.push(...(await speechWindows(s)));
  busy.sort((p, q) => p.startS - q.startS);
  const lo = Math.max(0.5, s.audioFadeInS ?? 0);
  const hi = end - Math.max(s.audioFadeOutS ?? 0, 0.5) - 0.3;
  const solo: Range[] = [];
  let cur = lo;
  for (const b of busy) {
    if (b.startS - 0.4 > cur) solo.push({ startS: cur, endS: Math.min(b.startS - 0.4, hi) });
    cur = Math.max(cur, b.endS + 0.4);
  }
  if (hi > cur) solo.push({ startS: cur, endS: hi });
  const stretches = solo
    .filter((w) => w.endS - w.startS >= 1.5)
    .map((w) => {
      const vals = a.timeline!.filter((p) => p.t >= w.startS + 0.2 && p.t <= w.endS - 0.2).map((p) => p.m).filter((v) => Number.isFinite(v) && v > -120);
      return { startS: +w.startS.toFixed(2), endS: +w.endS.toFixed(2), medianLufs: median(vals) };
    });
  const measured = stretches.filter((x) => x.medianLufs != null);
  const loudest = measured.length ? Math.max(...measured.map((x) => x.medianLufs!)) : null;
  const silent = measured.filter((x) => x.medianLufs! < -50);
  const rule = "§7 Sound: the bed in the render";
  if (!measured.length) findings.push({ severity: "info", rule, message: "no stretch where the bed plays alone — the render cannot confirm the bed by itself (a voice or an unmuted shot is on nearly every second)" });
  else if (loudest == null || loudest < -50)
    findings.push({
      severity: "error",
      rule,
      atS: measured[0].startS,
      message: `a music bed is set (volume ${s.musicVolume}) but the render is silent where only the bed should play (${fmtRange(measured[0])}: ${measured[0].medianLufs} LUFS) — the score did not make it into the mix`,
      fix: "probe_asset the music asset (does it have audio?), check musicMuted / musicVolume, re-render, verify again",
    });
  else {
    if (loudest < -32) findings.push({ severity: "warn", rule, message: `the bed is barely there: ${loudest} LUFS in its loudest solo stretch`, fix: "balance_music" });
    if (silent.length)
      findings.push({ severity: "warn", rule: "§7 Sound: the bed drops out", atS: silent[0].startS, message: `the bed is silent in ${silent.length} of ${measured.length} solo stretches (first at ${fmtRange(silent[0])})`, fix: "a bed shorter than the cut, or a gap in it — see check_soundtrack" });
    findings.push({ severity: "info", rule, message: `music bed present: ${loudest} LUFS (momentary median) where it plays alone, ${measured.length} solo stretch${measured.length === 1 ? "" : "es"} measured` });
  }
  return { bed, soloStretches: stretches, loudestSoloLufs: loudest, findings };
}

export async function balanceMusic(projectId: string, gapLu: number) {
  const s = await snapshot(projectId);
  if (!s.musicAssetId) throw new Error("no music bed: set_music first");
  const voices = [...new Set(s.segments.filter((x) => x.audioOnly && !x.library).map((x) => x.sourceAssetId).filter((x): x is string => !!x))];
  if (s.audioMode !== "NONE" && s.voiceover?.assetId) voices.push(s.voiceover.assetId);
  if (!voices.length) throw new Error("no narration / voiceover to balance against — add the narration first");
  const lufs = async (id: string) => (await api.post<{ loudness: { integratedLufs: number | null } | null }>(`/api/audio/analyze`, { projectId, assetId: id, kinds: ["loudness"] })).loudness?.integratedLufs ?? null;
  const voiceLevels = (await Promise.all(voices.map(lufs))).filter((x): x is number => x != null);
  const musicLufs = await lufs(s.musicAssetId);
  if (!voiceLevels.length || musicLufs == null) throw new Error("could not measure the sources");
  const voice = +(voiceLevels.reduce((a, b) => a + b, 0) / voiceLevels.length).toFixed(1);
  const gainDb = voice - gapLu - musicLufs;
  const volume = +Math.min(1, Math.max(0.02, 10 ** (gainDb / 20))).toFixed(3);
  await api.patch(`/api/projects/${projectId}`, { musicVolume: volume, musicDucking: true });
  const duck = duckDepthLu(voice);
  return {
    voiceIntegratedLufs: voice,
    musicIntegratedLufs: musicLufs,
    gapLu,
    musicVolume: volume,
    gainDb: +gainDb.toFixed(1),
    expected: { musicOnlyLufs: +(voice - gapLu).toFixed(1), musicUnderSpeechLufs: +(voice - gapLu - duck).toFixed(1), speechToMusicUnderSpeechLu: +(gapLu + duck).toFixed(1) },
    note: "levels are pre-loudnorm; audioNormalize lifts the whole mix to −14 LUFS keeping this balance. render_draft, then check_mix_levels.",
  };
}
