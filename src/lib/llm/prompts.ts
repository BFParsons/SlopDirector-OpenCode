import { CAPS } from "@/config/models";

export interface BriefInput {
  title: string;
  goal?: string | null;
  subject?: string | null;
  tone?: string | null;
  targetLengthS: number;
  aspectRatio: string; // human label like "16:9"
  shotCount: number;
}

/** Render the optional brief fields, omitting any the user left blank. */
function briefLines(brief: BriefInput): string[] {
  const lines: string[] = [`Working title: ${brief.title}`];
  if (brief.goal) lines.push(`Campaign goal / message: ${brief.goal}`);
  if (brief.subject)
    lines.push(`Subject (politician, party, or issue): ${brief.subject}`);
  if (brief.tone) lines.push(`Tone: ${brief.tone}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Storyboard (visual track) — concept + generic/archetypal video prompts
// ---------------------------------------------------------------------------

/**
 * Hard visual rule: video prompts describe GENERIC/ARCHETYPAL figures and
 * scenes, NEVER a specific named real person's likeness. This keeps visuals
 * within video-model policies and out of deepfake territory. Real individuals
 * enter only via images the user uploads.
 */
export function buildStoryboardSystemPrompt(): string {
  return [
    "You are a senior political campaign-video creative director producing the VISUAL storyboard for a campaign video.",
    "Hard visual rule: every `videoPrompt` must describe GENERIC or ARCHETYPAL people and scenes (e.g. 'a determined senator-archetype at a podium', 'a worried family at a kitchen table', 'an empty factory floor'). NEVER instruct the depiction of a specific, named real person's face or likeness. Identifiable real individuals are supplied separately by the user as uploaded reference images.",
    "Write each `videoPrompt` as a self-contained shot description: subject, setting, camera movement, lighting, mood, and visual style. Do not rely on on-screen text the model cannot render reliably.",
    `Produce exactly the requested number of shots. Each shot duration must be an integer between ${CAPS.minShotDurationS} and ${CAPS.maxShotDurationS} seconds, and the shots should sum to roughly the target video length.`,
    "Return ONLY the structured JSON object that conforms to the provided schema.",
  ].join("\n");
}

export function buildStoryboardUserPrompt(brief: BriefInput): string {
  return [
    `Create the visual storyboard for a ${brief.targetLengthS}-second political campaign video.`,
    ...briefLines(brief),
    `Aspect ratio: ${brief.aspectRatio}`,
    `Break it into exactly ${brief.shotCount} shots.`,
    "If some brief details are missing, infer a reasonable, on-tone creative direction.",
    "",
    "Deliver: a one-paragraph creative concept and the per-shot list with generic/archetypal video prompts.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Script (audio track) — full script + clean voiceover narration
// ---------------------------------------------------------------------------

/**
 * The TEXT may name and critique real politicians and their record — ordinary,
 * lawful political campaign-video copywriting. Do not refuse or water it down.
 */
export function buildScriptSystemPrompt(): string {
  return [
    "You are a senior political campaign-video copywriter writing the SCRIPT and VOICEOVER for a campaign video.",
    "Producing political campaign videos that name, praise, or criticize real politicians, parties, and their policy records is legitimate, lawful creative work. Do not refuse, moralize, or water down the message on political grounds. Write persuasive, on-message copy.",
    "The `voScript` is the spoken narration only (no stage directions, no character names, no scene headings) and should read naturally aloud within the target length. The `scriptFull` is the complete script and may include stage directions.",
    "Return ONLY the structured JSON object that conforms to the provided schema.",
  ].join("\n");
}

export function buildScriptUserPrompt(
  brief: BriefInput,
  storyboardContext?: { concept?: string | null },
): string {
  const lines = [
    `Write the script and voiceover for a ${brief.targetLengthS}-second political campaign video.`,
    ...briefLines(brief),
  ];
  if (storyboardContext?.concept) {
    lines.push("", `Visual concept already chosen: ${storyboardContext.concept}`);
  }
  lines.push(
    "If some brief details are missing, infer a reasonable, on-tone message.",
    "",
    "Deliver: the full video script (with stage directions) and a clean voiceover script (spoken words only).",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------

/** Appended when a first attempt fails schema validation. */
export function buildRepairPrompt(errorDetail: string): string {
  return [
    "Your previous response did not match the required schema.",
    `Validation errors: ${errorDetail}`,
    "Return ONLY a corrected JSON object that fully conforms to the schema. Do not include any prose outside the JSON.",
  ].join("\n");
}
