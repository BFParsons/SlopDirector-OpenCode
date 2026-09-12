import type { SourceAudio } from "../validation/brief";

/** No signal classifier here: transcription and loudness cannot establish absence of music. */
export function sourceMusicFinding(a?: SourceAudio): { severity: "error" | "warn"; message: string } | null {
  if (a?.music === "present") return { severity: "error", message: "Selected dialogue still contains embedded music. Choose a music-free excerpt or isolate and review the voice before mixing." };
  if (!a || a.music === "unknown" || a.review !== "listened") return { severity: "warn", message: "Embedded music is unverified. Audition the selected dialogue alone and under the cue; transcription, ducking, EQ and a separation job do not certify clean dialogue." };
  return null;
}

/** Bind clearance to the actual audible file and full source interval; never to timeline index. */
export function sourceAudioCovers(a: SourceAudio, assetId: string, startS: number, endS: number): boolean {
  return a.assetId === assetId && a.startS != null && a.endS != null &&
    a.startS <= startS + 0.001 && a.endS >= endS - 0.001;
}
