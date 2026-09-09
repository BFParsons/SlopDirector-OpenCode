import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FONT_IDS, TYPE_PRESETS, applyPreset, presetById } from "../../src/lib/typography";
import { api, type Snapshot, snapshot, summarize, frameOf } from "../client";
import { guarded, text } from "../format";

const segmentEdit = {
  id: z.string(),
  trimStartS: z.number().min(0).optional().describe("source seconds skipped from the start (in-point)"),
  durationS: z.number().min(0.1).optional().describe("on-screen length in seconds"),
  speed: z.number().min(0.5).max(2).optional(),
  muted: z.boolean().optional().describe("false = mix this clip's own audio into the soundtrack"),
  volume: z.number().min(0).max(4).optional().describe("gain on this clip's audio — unmuted shots and audio-only clips; 1 = as recorded, 2 ≈ +6 dB, 0.5 ≈ −6 dB (guide §7 Levels)"),
  offsetS: z.number().min(0).optional().describe("timeline start (overlay tracks and audio-only clips)"),
  track: z.number().int().min(0).max(31).optional(),
  brightness: z.number().min(-0.3).max(0.3).optional(),
  contrast: z.number().min(0.5).max(1.5).optional(),
  saturation: z.number().min(0).max(2).optional(),
  imageMotion: z.string().optional().describe("stills: NONE | ZOOM_IN | ZOOM_OUT | PAN_LEFT | PAN_RIGHT …"),
  effects: z
    .array(z.object({ kind: z.string(), enabled: z.boolean().optional(), params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional() }))
    .nullable()
    .optional()
    .describe("replaces the effect stack; kinds include blur, chromaKey, crop, denoise, detail, deinterlace, deshake, stabilize, smoothSlowmo, tonemap …"),
  pip: z.object({ scale: z.number(), posX: z.number(), posY: z.number(), opacity: z.number().optional() }).nullable().optional(),
  transform: z.unknown().optional(),
};

const addSegmentInput = {
  projectId: z.string(),
  assetId: z.string().describe("an UPLOAD_VIDEO / UPLOAD_IMAGE / audio asset from import_media or list_media"),
  trimStartS: z.number().min(0).optional(),
  durationS: z.number().min(0.1).optional().describe("default: the rest of the clip (video) or 5 s (image)"),
  track: z.number().int().min(0).max(31).default(0).describe("0 = main sequence (appended in order); >=1 = positioned overlay"),
  offsetS: z.number().min(0).optional(),
  audioOnly: z.boolean().default(false),
  muted: z.boolean().optional().describe("SOUND DECISION for a video clip: true (default here) = silent B-roll under music/narration; false = keep the clip's own sound (dialogue, sync sound). Note the raw API keeps sound by default; this tool mutes by default. Ignored for audioOnly clips (always audible)."),
  volume: z.number().min(0).max(4).optional().describe("gain on this clip's audio — unmuted shots and audio-only clips; 1 = as recorded, 2 ≈ +6 dB, 0.5 ≈ −6 dB (guide §7 Levels)"),
  imageMotion: z.string().optional(),
};

/**
 * The reorder route wants EVERY segment id (overlays and audio-only clips
 * included); callers think in main-sequence order, so append whatever they
 * left out in its current order.
 */
async function completeOrder(projectId: string, orderedIds: string[]): Promise<string[]> {
  const s = await snapshot(projectId);
  const given = new Set(orderedIds);
  const rest = s.segments.filter((x) => !given.has(x.id)).sort((a, b) => a.index - b.index).map((x) => x.id);
  return [...orderedIds, ...rest];
}

// Asset kinds do not change: remember them so a 25-op edit list does not probe
// the same file 25 times (each /info is three ffprobe spawns).
const kindCache = new Map<string, string>();
async function assetKind(assetId: string): Promise<string> {
  const hit = kindCache.get(assetId);
  if (hit) return hit;
  const info = await api.get<{ kind: string }>(`/api/assets/${assetId}/info`);
  kindCache.set(assetId, info.kind);
  return info.kind;
}

async function addSegment(a: {
  projectId: string; assetId: string; trimStartS?: number; durationS?: number; track: number; offsetS?: number; audioOnly: boolean; muted?: boolean; volume?: number; imageMotion?: string;
}): Promise<Snapshot> {
  const kind = await assetKind(a.assetId);
  const source = kind === "UPLOAD_IMAGE" ? "UPLOAD_IMAGE_STILL" : "UPLOAD_VIDEO";
  const body: Record<string, unknown> = { source, sourceAssetId: a.assetId, track: a.track, audioOnly: a.audioOnly };
  if (a.trimStartS != null) body.trimStartS = a.trimStartS;
  if (a.durationS != null) body.durationS = a.durationS;
  if (a.offsetS != null) body.offsetS = a.offsetS;
  // Sound is a decision, not an accident: video shots are silent unless asked
  // (the raw API keeps an upload's sound by default — every imported YouTube
  // clip carries its own narration and music). Audio-only clips are audible.
  body.muted = a.audioOnly ? false : (a.muted ?? true);
  if (a.imageMotion) body.imageMotion = a.imageMotion;
  if (a.volume != null) body.volume = a.volume;
  return api.post<Snapshot>(`/api/projects/${a.projectId}/segments`, body);
}

export function registerTimelineTools(server: McpServer) {
  server.registerTool(
    "add_segment",
    {
      title: "Add a clip to the timeline",
      description:
        "Place an imported asset on the timeline. Track 0 appends to the main sequence; the same asset can be added several times with different trimStartS/durationS to make sub-clips (that is how you cut). The clip's OWN SOUND is off unless muted:false (see check_soundtrack). Returns the updated project.",
      inputSchema: addSegmentInput,
    },
    guarded(async (a) => text(summarize(await addSegment(a)))),
  );

  server.registerTool(
    "update_segments",
    {
      title: "Edit segments",
      description: "Change any number of segments at once (trim, duration, speed, mute, colour, effects, overlay placement). Only the fields you pass change.",
      inputSchema: { projectId: z.string(), edits: z.array(z.object(segmentEdit)).min(1).max(200) },
    },
    guarded(async ({ projectId, edits }) => text(summarize(await api.patch<Snapshot>(`/api/projects/${projectId}`, { segments: edits })))),
  );

  server.registerTool(
    "split_segment",
    {
      title: "Split (blade)",
      description: "Cut a segment into two at atS seconds from its own start (on-screen time, not source time).",
      inputSchema: { projectId: z.string(), segmentId: z.string(), atS: z.number().min(0.1) },
    },
    guarded(async ({ projectId, segmentId, atS }) => text(summarize(await api.post<Snapshot>(`/api/projects/${projectId}/segments/${segmentId}/split`, { atS })))),
  );

  server.registerTool(
    "reorder_segments",
    {
      title: "Reorder the main sequence",
      description: "The main-sequence segment ids in their new order (overlay and audio-only clips may be omitted; they keep their place).",
      inputSchema: { projectId: z.string(), orderedIds: z.array(z.string()).min(1) },
    },
    guarded(async ({ projectId, orderedIds }) =>
      text(summarize(await api.post<Snapshot>(`/api/projects/${projectId}/segments/reorder`, { orderedIds: await completeOrder(projectId, orderedIds) }))),
    ),
  );

  server.registerTool(
    "delete_segment",
    {
      title: "Delete a segment",
      description: "Remove a segment from the timeline (the media asset stays in the bucket).",
      inputSchema: { projectId: z.string(), segmentId: z.string() },
      annotations: { destructiveHint: true },
    },
    guarded(async ({ projectId, segmentId }) => text(summarize(await api.del<Snapshot>(`/api/projects/${projectId}/segments/${segmentId}`)))),
  );

  server.registerTool(
    "add_text_overlay",
    {
      title: "Add burned-in text",
      description:
        "A title / lower-third / caption / card drawn over the video from startS to endS. Give a `preset` (list_typography: lower-third, callout, caption-pop, card-archive, card-editorial, title, intertitle, quote, date-card, map-label, mono-note, citation) and the face, size, placement, box / outline / shadow, entrance and hold are filled in for this frame — any field you pass overrides it. Text anchors to the TITLE-SAFE area of the frame (safe areas by aspect / project.safeArea; marginPx moves it further in), so it is never cut or covered on delivery; check_text verifies. position: TOP_LEFT|TOP_CENTER|TOP_RIGHT|MIDDLE_LEFT|CENTER|MIDDLE_RIGHT|BOTTOM_LEFT|BOTTOM_CENTER|BOTTOM_RIGHT. animation: NONE|FADE|SLIDE_UP|POP.",
      inputSchema: {
        projectId: z.string(),
        text: z.string().min(1).max(500),
        preset: z.enum(TYPE_PRESETS.map((p) => p.id) as [string, ...string[]]).optional(),
        position: z.string().optional(),
        startS: z.number().min(0).default(0),
        endS: z.number().min(0).nullable().optional(),
        sizePct: z.number().int().min(1).max(40).optional(),
        color: z.string().optional(),
        boxEnabled: z.boolean().optional(),
        boxColor: z.string().optional(),
        boxOpacity: z.number().min(0).max(1).optional(),
        marginPx: z.number().int().min(0).max(600).optional(),
        font: z.enum(FONT_IDS).optional(),
        outlineW: z.number().int().min(0).max(40).optional().describe("outline width as % of the font size"),
        shadow: z.number().int().min(0).max(30).optional().describe("drop-shadow offset as % of the font size"),
        animation: z.enum(["NONE", "FADE", "SLIDE_UP", "POP"]).optional(),
      },
    },
    guarded(async ({ projectId, preset, text: txt, startS, ...rest }) => {
      let body: Record<string, unknown> = { text: txt, startS, ...rest, position: rest.position ?? "BOTTOM_CENTER" };
      if (preset) {
        const s = await snapshot(projectId);
        const { endS, ...overrides } = rest;
        body = { ...applyPreset(presetById(preset)!, frameOf(s), txt, startS, { ...overrides, ...(endS !== undefined ? { endS } : {}) }) };
      }
      return text(summarize(await api.post<Snapshot>(`/api/projects/${projectId}/text-overlays`, body)));
    }),
  );

  server.registerTool(
    "remove_text_overlay",
    { title: "Remove burned-in text", inputSchema: { projectId: z.string(), overlayId: z.string() }, annotations: { destructiveHint: true } },
    guarded(async ({ projectId, overlayId }) => text(summarize(await api.del<Snapshot>(`/api/projects/${projectId}/text-overlays/${overlayId}`)))),
  );

  // --- checkpoints -----------------------------------------------------------
  server.registerTool(
    "create_checkpoint",
    {
      title: "Checkpoint",
      description: "Save the project's editable state (settings, segments, overlays) server-side so you can try an edit and roll back with restore_checkpoint. Take one before any multi-step change.",
      inputSchema: { projectId: z.string(), label: z.string().max(200).optional() },
    },
    guarded(async ({ projectId, label }) => text(await api.post(`/api/projects/${projectId}/checkpoints`, label ? { label } : {}))),
  );
  server.registerTool(
    "list_checkpoints",
    { title: "List checkpoints", inputSchema: { projectId: z.string() }, annotations: { readOnlyHint: true } },
    guarded(async ({ projectId }) => text(await api.get(`/api/projects/${projectId}/checkpoints`))),
  );
  server.registerTool(
    "restore_checkpoint",
    {
      title: "Restore checkpoint",
      description: "Put settings, segments and overlays back exactly as captured (same ids). Media and renders are untouched.",
      inputSchema: { projectId: z.string(), checkpointId: z.string() },
      annotations: { destructiveHint: true },
    },
    guarded(async ({ projectId, checkpointId }) => text(summarize(await api.post<Snapshot>(`/api/projects/${projectId}/checkpoints/${checkpointId}/restore`)))),
  );

  // --- batch ---------------------------------------------------------------
  const op = z.discriminatedUnion("op", [
    z.object({ op: z.literal("add_segment"), ...Object.fromEntries(Object.entries(addSegmentInput).filter(([k]) => k !== "projectId")) as Omit<typeof addSegmentInput, "projectId"> }),
    z.object({ op: z.literal("update_segment"), ...segmentEdit }),
    z.object({ op: z.literal("delete_segment"), id: z.string() }),
    z.object({ op: z.literal("split_segment"), id: z.string(), atS: z.number().min(0.1) }),
    z.object({ op: z.literal("reorder"), orderedIds: z.array(z.string()).min(1) }),
    z.object({ op: z.literal("clear_timeline") }),
  ]);

  server.registerTool(
    "apply_edit_list",
    {
      title: "Apply an edit list",
      description:
        "Run a sequence of timeline operations as one unit: a checkpoint is taken first and, if any step fails, the project is rolled back to it. " +
        "Ops: add_segment {assetId, trimStartS?, durationS?, track?, offsetS?, muted? (video is SILENT unless muted:false), audioOnly?}, update_segment {id, …fields incl. volume}, delete_segment {id}, split_segment {id, atS}, reorder {orderedIds}, clear_timeline. " +
        "Ids created by earlier add_segment ops can be referenced as \"$1\", \"$2\", … (1-based index of the add op).",
      inputSchema: { projectId: z.string(), ops: z.array(op).min(1).max(200), label: z.string().max(200).optional() },
    },
    guarded(async ({ projectId, ops, label }) => {
      const cp = await api.post<{ id: string }>(`/api/projects/${projectId}/checkpoints`, { label: label ?? "before apply_edit_list" });
      const created: string[] = [];
      const resolve = (id: string) => {
        const m = /^\$(\d+)$/.exec(id);
        if (!m) return id;
        const ref = created[Number(m[1]) - 1];
        if (!ref) throw new Error(`${id} refers to an add_segment that has not run yet`);
        return ref;
      };
      let step = 0;
      try {
        for (const o of ops) {
          step++;
          if (o.op === "add_segment") {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { op: _op, ...rest } = o;
            const snap = await addSegment({ projectId, ...rest, track: rest.track ?? 0, audioOnly: rest.audioOnly ?? false });
            // A new segment always gets the highest index — no pre-snapshot needed.
            const fresh = snap.segments.reduce((best, s) => (s.index > best.index ? s : best), snap.segments[0]);
            created.push(fresh?.id ?? "");
          } else if (o.op === "update_segment") {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { op: _op, id, ...fields } = o;
            await api.patch(`/api/projects/${projectId}`, { segments: [{ id: resolve(id), ...fields }] });
          } else if (o.op === "delete_segment") {
            await api.del(`/api/projects/${projectId}/segments/${resolve(o.id)}`);
          } else if (o.op === "split_segment") {
            await api.post(`/api/projects/${projectId}/segments/${resolve(o.id)}/split`, { atS: o.atS });
          } else if (o.op === "reorder") {
            await api.post(`/api/projects/${projectId}/segments/reorder`, { orderedIds: await completeOrder(projectId, o.orderedIds.map(resolve)) });
          } else if (o.op === "clear_timeline") {
            for (const s of (await snapshot(projectId)).segments) await api.del(`/api/projects/${projectId}/segments/${s.id}`);
          }
        }
      } catch (e) {
        await api.post(`/api/projects/${projectId}/checkpoints/${cp.id}/restore`).catch(() => {});
        throw new Error(`step ${step} (${ops[step - 1]?.op}) failed: ${(e as Error).message} — project rolled back to checkpoint ${cp.id}`);
      }
      return text({ applied: ops.length, checkpointId: cp.id, createdSegmentIds: created, project: summarize(await snapshot(projectId)) });
    }),
  );
}
