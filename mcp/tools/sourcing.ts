/**
 * Sourcing: find footage on YouTube (search only), fetch a clip list in one
 * batch (search → rank → import a section per clip), and generate AI shots
 * from the plan. Imports and generations run as background jobs — poll
 * get_project for READY.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, type Snapshot, snapshot } from "../client";
import { guarded, text } from "../format";

type Candidate = { id: string; url: string; title: string; channel: string | null; durationS: number | null; viewCount: number | null; uploadDate: string | null };
type ClipSpec = { id: string; queries: string[]; mustHave?: string[]; preferredChannels?: string[]; durationHintS?: number; section?: { startS: number; endS: number } | null; need?: string };

const MAX_SECTION_S = 180;

function score(c: Candidate, spec: ClipSpec): number {
  const title = c.title.toLowerCase();
  let s = 0;
  for (const m of spec.mustHave ?? []) if (title.includes(m.toLowerCase())) s += 3;
  for (const q of spec.queries) for (const w of q.toLowerCase().split(/\W+/)) if (w.length > 3 && title.includes(w)) s += 0.5;
  if (spec.preferredChannels?.some((p) => (c.channel ?? "").toLowerCase().includes(p.toLowerCase()))) s += 4;
  if (c.durationS != null) {
    if (c.durationS < 3) s -= 5;
    if (c.durationS > 1800) s -= 2;
    if (spec.durationHintS) s -= Math.min(2, Math.abs(c.durationS - spec.durationHintS) / spec.durationHintS);
  }
  if (c.viewCount) s += Math.min(2, Math.log10(c.viewCount) / 4);
  if (/reaction|react to|meme|compilation|explained|review/i.test(c.title) && !(spec.mustHave ?? []).some((m) => /reaction|compilation|review/i.test(m))) s -= 2;
  return s;
}

async function search(q: string, max: number): Promise<Candidate[]> {
  const r = await api.get<{ candidates: Candidate[] }>(`/api/youtube/search?q=${encodeURIComponent(q)}&max=${max}`);
  return r.candidates;
}

export function registerSourcingTools(server: McpServer) {
  server.registerTool(
    "search_youtube",
    {
      title: "Search YouTube",
      description: "Search YouTube (yt-dlp, no download): id, url, title, channel, duration, views per result. Filter by duration. Prefer archives, official channels and Creative Commons uploads; the licence isn't in the search page — check the video page when it matters. Then import_youtube a ≤ 180 s section.",
      inputSchema: { query: z.string().min(1).max(200), max: z.number().int().min(1).max(25).default(8), minDurationS: z.number().min(0).optional(), maxDurationS: z.number().min(1).optional() },
    },
    guarded(async ({ query, max, minDurationS, maxDurationS }) => {
      const all = await search(query, max);
      const candidates = all.filter((c) => (minDurationS == null || (c.durationS ?? 0) >= minDurationS) && (maxDurationS == null || (c.durationS ?? Infinity) <= maxDurationS));
      return text({ query, candidates });
    }),
  );

  server.registerTool(
    "youtube_captions",
    {
      title: "YouTube captions (no download)",
      description:
        "The caption track of a YouTube video with timings — the manual track if there is one, else YouTube's auto-captions — without downloading the media. Find the second a sentence is spoken BEFORE importing: pass `q` to get only the cues containing a phrase (case-insensitive), or from/to to read a stretch; then import_youtube a short window (≈ 30 s) around it instead of blind 180 s sections. Auto-captions are rough on names and numbers; confirm with transcribe after the import when the exact words matter.",
      inputSchema: { url: z.string().url(), q: z.string().max(200).optional().describe("phrase to look for"), fromS: z.number().min(0).optional(), toS: z.number().min(0).optional(), lang: z.string().max(8).default("en") },
    },
    guarded(async ({ url, q, fromS, toS, lang }) => {
      const p = new URLSearchParams({ url, lang });
      if (q) p.set("q", q);
      if (fromS != null) p.set("from", String(fromS));
      if (toS != null) p.set("to", String(toS));
      const r = await api.get<{ videoId: string; title: string | null; durationS: number | null; auto: boolean; cueCount: number; cues: { startS: number; endS: number; text: string }[]; matches: { startS: number; endS: number; text: string }[] | null }>(`/api/youtube/captions?${p}`);
      if (r.matches) return text({ videoId: r.videoId, title: r.title, durationS: r.durationS, auto: r.auto, cueCount: r.cueCount, matches: r.matches, hint: r.matches.length ? "import_youtube a window from ~15 s before the first match to ~15 s after the last one you need" : "no cue contains that phrase — try a shorter or different wording, or read a stretch with fromS/toS" });
      const lines = r.cues.map((c) => `${c.startS.toFixed(1)}  ${c.text}`);
      return text(`${r.title ?? r.videoId} · ${r.durationS ?? "?"} s · ${r.auto ? "auto-captions" : "captions"} · ${r.cueCount} cues${lines.length < r.cueCount ? ` (showing ${lines.length})` : ""}\n` + lines.join("\n"));
    }),
  );

  server.registerTool(
    "source_clips",
    {
      title: "Fetch a clip list",
      description:
        "For each clip spec (default: the approved plan's clipList): search YouTube with its queries, rank the candidates (must-have words in the title, preferred channels, duration hint, views; penalises reactions/compilations), and import a section of the best one (the shot's planned section, else the first ≤ 180 s). Runs the clips in parallel and returns what it picked, the alternatives, and the new segment ids to poll with get_project. Handles at most `maxClips` per call and lists the rest in `remaining` — call again. For precision (a specific quote, a specific moment) send a clip-scout sub-agent instead: search_youtube → import → get_contact_sheet / transcribe → pick.",
      inputSchema: {
        projectId: z.string(),
        clips: z
          .array(z.object({ id: z.string(), queries: z.array(z.string()).min(1).max(4), mustHave: z.array(z.string()).optional(), preferredChannels: z.array(z.string()).optional(), durationHintS: z.number().optional(), section: z.object({ startS: z.number().min(0), endS: z.number().min(0) }).nullable().optional(), need: z.string().optional() }))
          .optional()
          .describe("explicit specs; default: the plan's clipList (+ each shot's planned section)"),
        maxClips: z.number().int().min(1).max(12).default(6),
        candidatesPerQuery: z.number().int().min(1).max(10).default(6),
      },
    },
    guarded(async ({ projectId, clips, maxClips, candidatesPerQuery }) => {
      let specs: ClipSpec[] = clips ?? [];
      if (!specs.length) {
        const p = await api.get<{ plan: { clipList: ClipSpec[]; shots: { source: { clipId?: string; section?: { startS: number; endS: number } } }[] } | null }>(`/api/projects/${projectId}/plan`);
        if (!p.plan) throw new Error("no plan and no clips given — set_plan first or pass clips");
        specs = p.plan.clipList.map((c) => ({ ...c, section: p.plan!.shots.find((s) => s.source.clipId === c.id && s.source.section)?.source.section ?? null }));
      }
      // Skip clips already imported into this project (a re-run after a partial batch).
      const before = await snapshot(projectId);
      const done = new Set(before.segments.filter((s) => (s as { title?: string }).title?.startsWith("clip:")).map((s) => (s as { title?: string }).title!.slice(5)));
      const todo = specs.filter((c) => !done.has(c.id));
      const batch = todo.slice(0, maxClips);
      const remaining = todo.slice(maxClips).map((c) => c.id);
      const results: Record<string, unknown>[] = [];
      let lastSnap: Snapshot = before;
      const queue = [...batch];
      const work = async () => {
        for (let spec = queue.shift(); spec; spec = queue.shift()) {
          try {
            const seen = new Map<string, Candidate>();
            for (const q of spec.queries.slice(0, 2)) for (const c of await search(q, candidatesPerQuery)) seen.set(c.id, c);
            const ranked = [...seen.values()].map((c) => ({ c, s: score(c, spec) })).sort((a, b) => b.s - a.s);
            if (!ranked.length) {
              results.push({ clipId: spec.id, status: "no results" });
              continue;
            }
            const pick = ranked[0].c;
            const dur = pick.durationS ?? MAX_SECTION_S;
            const section = spec.section ? { startS: Math.min(spec.section.startS, Math.max(0, dur - 1)), endS: Math.min(spec.section.endS, dur) } : { startS: 0, endS: Math.min(dur, MAX_SECTION_S) };
            if (section.endS - section.startS > MAX_SECTION_S) section.endS = section.startS + MAX_SECTION_S;
            const prevIds = new Set(lastSnap.segments.map((s) => s.id));
            const snap = await api.post<Snapshot>(`/api/projects/${projectId}/youtube`, { url: pick.url, startS: section.startS, endS: section.endS, kind: "video" });
            lastSnap = snap;
            const seg = snap.segments.find((s) => !prevIds.has(s.id));
            if (seg) await api.patch(`/api/projects/${projectId}`, { segments: [{ id: seg.id, title: `clip:${spec.id}` }] }).catch(() => null);
            results.push({ clipId: spec.id, status: "importing", picked: { ...pick, score: +ranked[0].s.toFixed(1) }, section, segmentId: seg?.id ?? null, note: dur > MAX_SECTION_S && !spec.section ? `long video (${Math.round(dur)} s): took the first ${MAX_SECTION_S} s — pass a section or send a clip-scout` : undefined, alternatives: ranked.slice(1, 4).map((r) => ({ ...r.c, score: +r.s.toFixed(1) })) });
          } catch (e) {
            results.push({ clipId: spec.id, status: "failed", error: e instanceof Error ? e.message : String(e) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, work));
      return text({ results, remaining, skippedAlreadyImported: [...done].filter((id) => specs.some((c) => c.id === id)), next: "poll get_project until the segments are READY, then look (get_contact_sheet / transcribe) and cut sub-clips with add_segment" });
    }),
  );

  server.registerTool(
    "add_ai_shot",
    {
      title: "Generate an AI shot",
      description: "Create an AI-generated shot from a prompt and start generating it (costs credits: see list_video_models for price per second and the clip lengths each model makes; Veo blocks public figures). The segment appears at the end of the main sequence with status PENDING/GENERATING; poll get_project for READY, then trim/reorder like any clip.",
      inputSchema: { projectId: z.string(), prompt: z.string().min(1).max(2000), durationS: z.number().int().min(1).max(60).default(5), model: z.string().optional().describe("default: the build's default video model"), referenceImageAssetId: z.string().optional() },
    },
    guarded(async ({ projectId, prompt, durationS, model, referenceImageAssetId }) => {
      const models = await api.get<{ video: { id: string; durationsS?: number[] }[] }>(`/api/models`);
      const m = model ?? models.video[0]?.id;
      const info = models.video.find((v) => v.id === m);
      if (!info) throw new Error(`unknown video model ${m}`);
      const lengths = info.durationsS?.length ? info.durationsS : [5];
      const len = lengths.includes(durationS) ? durationS : lengths.reduce((a, b) => (Math.abs(b - durationS) < Math.abs(a - durationS) ? b : a));
      const before = await snapshot(projectId);
      const known = new Set(before.segments.map((s) => s.id));
      const snap = await api.post<Snapshot>(`/api/projects/${projectId}/generate-clip`, { videoModel: m, prompt, durationS: len, ...(referenceImageAssetId ? { refAssetId: referenceImageAssetId } : {}) });
      const seg = snap.segments.find((s) => !known.has(s.id));
      return text({ segmentId: seg?.id ?? null, model: m, durationS: len, note: len !== durationS ? `${m} generates ${lengths.join("/")} s clips — made ${len} s; trim with durationS after it lands` : undefined });
    }),
  );

  server.registerTool(
    "generate_ai_shots",
    {
      title: "Generate the plan's AI shots",
      description: "Start every AI shot in the approved plan (aiShots[]) in one go — each becomes a generating segment at the end of the main sequence. Returns shotId → segmentId so the assemble step can reorder. Costs credits; the plan's check states the estimate.",
      inputSchema: { projectId: z.string(), onlyShotIds: z.array(z.string()).optional() },
    },
    guarded(async ({ projectId, onlyShotIds }) => {
      const p = await api.get<{ plan: { status: string; aiShots: { shotId: string; prompt: string; model?: string; durationS: number; referenceImageAssetId?: string }[] } | null }>(`/api/projects/${projectId}/plan`);
      if (!p.plan) throw new Error("no plan — set_plan first");
      const models = await api.get<{ video: { id: string; durationsS?: number[] }[] }>(`/api/models`);
      const out: Record<string, unknown>[] = [];
      for (const a of p.plan.aiShots.filter((x) => !onlyShotIds || onlyShotIds.includes(x.shotId))) {
        try {
          const m = a.model ?? models.video[0]?.id;
          const info = models.video.find((v) => v.id === m);
          const lengths = info?.durationsS?.length ? info.durationsS : [5];
          const want = Math.round(a.durationS);
          const len = lengths.includes(want) ? want : lengths.reduce((x, y) => (Math.abs(y - want) < Math.abs(x - want) ? y : x));
          const before = await snapshot(projectId);
          const known = new Set(before.segments.map((s) => s.id));
          const snap = await api.post<Snapshot>(`/api/projects/${projectId}/generate-clip`, { videoModel: m, prompt: a.prompt, durationS: len, ...(a.referenceImageAssetId ? { refAssetId: a.referenceImageAssetId } : {}) });
          const seg = snap.segments.find((s) => !known.has(s.id));
          if (seg) await api.patch(`/api/projects/${projectId}`, { segments: [{ id: seg.id, title: `ai:${a.shotId}` }] }).catch(() => null);
          out.push({ shotId: a.shotId, segmentId: seg?.id ?? null, model: m, durationS: len });
        } catch (e) {
          out.push({ shotId: a.shotId, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return text({ started: out, next: "poll get_project until every AI segment is READY (minutes), then reorder per the plan" });
    }),
  );
}
