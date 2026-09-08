import path from "node:path";
import { type Task, createProject, genScenes, uploadAsset } from "../harness";

/** Gated: needs the Whisper venv + a downloaded model (EVAL_WHISPER=1). */
const task: Task = {
  name: "transcript",
  brief: "Get a word-timed transcript of the clip's audio.",
  async run(api, ctx) {
    const src = await genScenes(path.join(ctx.tmp, "scenes.mp4"));
    const pid = await createProject(api, "eval: transcript");
    ctx.cleanup(pid);
    const assetId = await uploadAsset(api, pid, src);
    const t0 = Date.now();
    const r = await api.post<{ cached: boolean; segments: unknown[]; words: unknown[]; language: string | null }>(`/api/assets/${assetId}/transcribe`, { model: "tiny" });
    const again = await api.post<{ cached: boolean }>(`/api/assets/${assetId}/transcribe`, { model: "tiny" });
    // A pure sine tone has no words; the contract under test is "runs, returns
    // the structured shape, caches". Real-speech accuracy is a separate eval.
    return {
      pass: Array.isArray(r.segments) && Array.isArray(r.words) && again.cached === true,
      metrics: { ms: Date.now() - t0, segments: r.segments.length, words: r.words.length, cachedSecondCall: again.cached },
    };
  },
};
export default task;
