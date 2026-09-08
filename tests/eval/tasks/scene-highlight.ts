import path from "node:path";
import { type Task, addVideoSegment, close, createProject, downloadDraft, ffprobe, genScenes, render, snapshot, uploadAsset } from "../harness";

const task: Task = {
  name: "scene-highlight",
  brief: "Make an 8 second highlight: the first 2 seconds of every shot, in order.",
  async run(api, ctx) {
    const src = await genScenes(path.join(ctx.tmp, "scenes.mp4"));
    const pid = await createProject(api, "eval: scene highlight");
    ctx.cleanup(pid);
    const assetId = await uploadAsset(api, pid, src);
    // --- reference solution
    const scenes = await api.get<{ cuts: number[]; shots: { startS: number; endS: number }[] }>(`/api/assets/${assetId}/scenes?threshold=0.3`);
    for (const sh of scenes.shots) await addVideoSegment(api, pid, assetId, { trimStartS: sh.startS, durationS: Math.min(2, +(sh.endS - sh.startS).toFixed(3)) });
    // --- score
    const { snap: done, ms } = await render(api, pid, true);
    const out = await downloadDraft(api, pid, path.join(ctx.tmp, "scene-highlight-draft.mp4"));
    const probe = await ffprobe(out);
    const outScenes = await api.get<{ cuts: number[] }>(`/api/assets/${done.finalRender!.draftAssetId}/scenes?threshold=0.3`);
    const segs = (await snapshot(api, pid)).segments.length;
    return {
      pass: scenes.shots.length === 4 && close(probe.durationS, 8, 0.5) && Math.abs(outScenes.cuts.length - 3) <= 1,
      metrics: { detectedShots: scenes.shots.length, cutsIn: scenes.cuts.map((c) => c.toFixed(1)).join("/"), segments: segs, outputS: +probe.durationS.toFixed(2), cutsOut: outScenes.cuts.length, renderMs: ms },
    };
  },
};
export default task;
