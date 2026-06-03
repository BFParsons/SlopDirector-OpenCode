import { getTtsModel, getVideoModel } from "@/config/models";

export interface CostBreakdown {
  videoCents: number;
  ttsCents: number;
  llmCents: number;
  totalCents: number;
  videoSeconds: number;
}

/** One AI/driver shot to be billed: its model + duration. */
export interface ShotCost {
  model: string;
  durationS: number;
}

/**
 * Estimate the cost of rendering one video. Only AI work is billed: callers pass
 * each AI/driver shot (model + seconds) — models may differ per shot — plus the
 * TTS character count (0 for uploaded-audio or silent). Video dominates.
 */
export function estimateCost(opts: {
  ttsModel: string;
  shots: ShotCost[]; // AI/driver segments only; uploaded video/photo cost nothing
  voScriptChars: number; // 0 for UPLOAD_AUDIO / NONE
}): CostBreakdown {
  const videoSeconds = opts.shots.reduce((a, s) => a + s.durationS, 0);

  // Per-shot pricing so mixed models bill correctly.
  const videoCents = Math.round(
    opts.shots.reduce((cents, s) => {
      const perSec = getVideoModel(s.model)?.pricePerSecondUsd ?? 0.05;
      return cents + s.durationS * perSec * 100;
    }, 0),
  );

  const tm = getTtsModel(opts.ttsModel);
  const ttsPer1k = tm?.pricePer1kCharsUsd ?? 0.01;
  const ttsCents = Math.round((opts.voScriptChars / 1000) * ttsPer1k * 100);

  // Flat allowance for the structured LLM call(s) — only when AI was actually
  // used to produce visuals or the script. Zero for a fully-uploaded ad.
  const llmCents = videoSeconds > 0 || opts.voScriptChars > 0 ? 2 : 0;

  return {
    videoSeconds,
    videoCents,
    ttsCents,
    llmCents,
    totalCents: videoCents + ttsCents + llmCents,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
