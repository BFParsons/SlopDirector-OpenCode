import { z } from "zod";
import { CAPS } from "@/config/models";

// The LLM work is split into two INDEPENDENT structured calls so the visual and
// audio tracks can be (re)generated separately:
//   - storyboard: concept + the per-shot visual list
//   - script:     the full script + clean voiceover narration

// ---------------------------------------------------------------------------
// Storyboard (visual track)
// ---------------------------------------------------------------------------

export const storyboardOutputSchema = z.object({
  concept: z.string().min(1),
  shots: z
    .array(
      z.object({
        index: z.number().int().min(0),
        title: z.string().min(1),
        videoPrompt: z.string().min(1),
        durationS: z
          .number()
          .int()
          .min(CAPS.minShotDurationS)
          .max(CAPS.maxShotDurationS),
        suggestedRefRole: z
          .enum(["FIRST_FRAME", "LAST_FRAME", "STYLE"])
          .nullable(),
      }),
    )
    .min(CAPS.minShots)
    .max(CAPS.maxShots),
});

export type StoryboardOutput = z.infer<typeof storyboardOutputSchema>;

export const storyboardJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    concept: { type: "string" },
    shots: {
      type: "array",
      minItems: CAPS.minShots,
      maxItems: CAPS.maxShots,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", minimum: 0 },
          title: { type: "string" },
          videoPrompt: { type: "string" },
          durationS: {
            type: "integer",
            minimum: CAPS.minShotDurationS,
            maximum: CAPS.maxShotDurationS,
          },
          suggestedRefRole: {
            type: ["string", "null"],
            enum: ["FIRST_FRAME", "LAST_FRAME", "STYLE", null],
          },
        },
        required: [
          "index",
          "title",
          "videoPrompt",
          "durationS",
          "suggestedRefRole",
        ],
      },
    },
  },
  required: ["concept", "shots"],
};

// ---------------------------------------------------------------------------
// Script (audio track)
// ---------------------------------------------------------------------------

export const scriptOutputSchema = z.object({
  scriptFull: z.string().min(1),
  voScript: z.string().min(1),
});

export type ScriptOutput = z.infer<typeof scriptOutputSchema>;

export const scriptJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    scriptFull: { type: "string" },
    voScript: { type: "string" },
  },
  required: ["scriptFull", "voScript"],
};
