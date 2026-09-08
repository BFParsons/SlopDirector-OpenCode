import { z } from "zod";

// One structured LLM call for the audio track: the full script + clean
// voiceover narration. (The visual-storyboard call was removed in this fork.)

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
