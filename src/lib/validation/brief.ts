/**
 * Pre-production: the brief an agent establishes by interviewing the person,
 * and the plan it proposes from it (beats, script, shots, clip list, AI
 * shots). Both are stored as JSON on the project. The plan is
 * propose-and-approve (guide ch.37): nothing is sourced or cut before
 * `status: "approved"` unless the person says so.
 */
import { z } from "zod";

export const briefSchema = z.object({
  deliverable: z.object({
    /** standalone piece, or one scene of a longer video (then no end card, no closing fade, no sign-off) */
    kind: z.enum(["standalone", "scene"]),
    parentContext: z.string().max(2000).optional(),
    durationS: z.number().min(2).max(3600),
    aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
    resolution: z.enum(["720p", "1080p"]).default("1080p"),
  }),
  production: z.object({
    scripted: z.boolean(),
    /** documentary, commercial, attack ad, explainer, trailer, music video, comedy sketch, interview, news package, social… */
    genre: z.string().min(1).max(80),
    form: z.string().max(120).optional(),
    /** a directing style from src/lib/styles (guide/styles/<id>.md): the cut, narration and sound are held to it */
    style: z.object({ id: z.string().min(1).max(60), notes: z.string().max(500).optional() }).optional(),
  }),
  sources: z.object({
    kinds: z.array(z.enum(["youtube", "ai", "upload", "stock"])).min(1),
    notes: z.string().max(2000).optional(),
    /** local files or already-imported asset ids the person pointed at */
    uploads: z.array(z.string()).optional(),
  }),
  /** the person's own script and / or shot list, pasted in the interview: the plan's spine (lines verbatim, shots in their order) */
  materials: z.object({ kind: z.enum(["script", "shots", "both"]), text: z.string().min(1).max(20000) }).optional(),
  premise: z.string().min(1).max(4000),
  tone: z.string().min(1).max(500),
  audience: z.string().max(500).optional(),
  mustInclude: z.array(z.string().max(300)).optional(),
  avoid: z.array(z.string().max(300)).optional(),
  narration: z.object({ wanted: z.boolean(), voice: z.string().max(60).optional(), style: z.string().max(300).optional() }).optional(),
  music: z.object({ wanted: z.boolean(), brief: z.string().max(500).optional() }).optional(),
  text: z.object({ wanted: z.boolean(), style: z.string().max(300).optional() }).optional(),
  status: z.enum(["draft", "approved"]).default("draft"),
});
export type Brief = z.infer<typeof briefSchema>;

const idStr = z.string().min(1).max(60);

/** Assessment of the selected audible asset/range, not the picture or a model name. */
export const sourceAudioSchema = z.object({
  music: z.enum(["none", "present", "unknown"]),
  treatment: z.enum(["original", "isolated", "replacement"]),
  review: z.enum(["pending", "listened"]),
  assetId: z.string().min(1).optional(),
  startS: z.number().min(0).optional(),
  endS: z.number().min(0).optional(),
  originalMusic: z.enum(["none", "present", "unknown"]).optional(),
  notes: z.string().max(1000).optional(),
}).refine(a => a.startS == null || a.endS == null || a.endS > a.startS, { message: "source audio end must follow start" });
export type SourceAudio = z.infer<typeof sourceAudioSchema>;

export const planSchema = z.object({
  version: z.number().int().min(1).default(1),
  status: z.enum(["proposed", "approved", "superseded"]).default("proposed"),
  logline: z.string().min(1).max(600),
  beats: z
    .array(z.object({ id: idStr, title: z.string().max(120), purpose: z.string().max(600).optional(), startS: z.number().min(0), endS: z.number().min(0) }))
    .min(1)
    .max(40),
  script: z
    .array(
      z.object({
        id: idStr,
        kind: z.enum(["narration", "bite", "text", "dialogue"]),
        text: z.string().min(1).max(1000),
        atS: z.number().min(0),
        durationS: z.number().min(0.1).optional(),
        shotId: idStr.optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .max(200),
  shots: z
    .array(
      z.object({
        id: idStr,
        beat: idStr,
        order: z.number().int().min(0),
        durationS: z.number().min(0.1).max(600),
        description: z.string().min(1).max(600),
        source: z.object({
          type: z.enum(["youtube", "ai", "upload", "stock", "card"]),
          clipId: idStr.optional(),
          section: z.object({ startS: z.number().min(0), endS: z.number().min(0) }).optional(),
          prompt: z.string().max(2000).optional(),
          model: z.string().max(120).optional(),
          assetId: z.string().optional(),
          hint: z.string().max(300).optional(),
        }),
        sound: z.enum(["sync", "muted", "vo"]),
        sourceAudio: sourceAudioSchema.optional(),
        text: z.string().max(300).optional(),
        transition: z.enum(["cut", "dissolve", "fadeToBlack"]).default("cut"),
      }),
    )
    .min(1)
    .max(200),
  clipList: z
    .array(
      z.object({
        id: idStr,
        need: z.string().min(1).max(600),
        queries: z.array(z.string().min(1).max(200)).min(1).max(8),
        preferredChannels: z.array(z.string().max(120)).optional(),
        mustHave: z.array(z.string().max(120)).optional(),
        wantedSection: z.string().max(300).optional(),
        durationHintS: z.number().min(1).max(3600).optional(),
      }),
    )
    .max(60),
  aiShots: z
    .array(
      z.object({
        shotId: idStr,
        prompt: z.string().min(1).max(2000),
        model: z.string().max(120).optional(),
        durationS: z.number().min(1).max(60),
        negative: z.string().max(500).optional(),
        referenceImageAssetId: z.string().optional(),
      }),
    )
    .max(40),
  music: z.object({ brief: z.string().max(500), queries: z.array(z.string().max(200)).max(6) }).nullable().default(null),
  narration: z
    .object({
      voice: z.string().max(60).optional(),
      style: z.string().max(300).optional(),
      lines: z.array(z.object({ scriptId: idStr, text: z.string().min(1).max(1000) })).max(100),
    })
    .nullable()
    .default(null),
  styleTreatment: z.object({
    reference: z.string().trim().min(1).max(1000),
    mechanism: z.string().trim().min(1).max(1000),
    materialPlan: z.string().trim().min(1).max(1500),
    rhythm: z.string().trim().min(1).max(1500),
    sound: z.string().trim().min(1).max(1500),
    typography: z.string().trim().min(1).max(1500),
    exceptions: z.array(z.string().trim().min(1).max(800)).max(20).default([]),
    evaluation: z.string().trim().min(1).max(1500),
  }).optional(),
  risks: z.array(z.string().max(400)).max(30).default([]),
  notes: z.string().max(4000).optional(),
});
export type Plan = z.infer<typeof planSchema>;
