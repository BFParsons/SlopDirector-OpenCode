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
