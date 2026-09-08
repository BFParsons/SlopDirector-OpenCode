import path from "node:path";
import { type Task, addVideoSegment, createProject, downloadDraft, ffprobe, genScenes, render, uploadAsset } from "../harness";

const task: Task = {
  name: "draft-speed",
  brief: "Preview the current timeline quickly at low resolution.",
  async run(api, ctx) {
    const src = await genScenes(path.join(ctx.tmp, "scenes.mp4"));
    const pid = await createProject(api, "eval: draft speed", 1920, 1080);
    ctx.cleanup(pid);
    const assetId = await uploadAsset(api, pid, src);
    await addVideoSegment(api, pid, assetId);
    const { ms } = await render(api, pid, true);
    const out = await downloadDraft(api, pid, path.join(ctx.tmp, "draft-speed.mp4"));
    const probe = await ffprobe(out);
    // A frame of the draft through the perception API (what an agent would "look at").
    const frame = await api.bytes(`/api/projects/${pid}`).then(() => api.get<{ finalRender: { draftAssetId: string } }>(`/api/projects/${pid}`)).then((s) => api.bytes(`/api/assets/${s.finalRender.draftAssetId}/frame?t=1&w=320`));
    return {
      pass: ms < 30_000 && probe.height <= 360 && probe.width <= 640 && frame.length > 1000,
      metrics: { renderMs: ms, width: probe.width, height: probe.height, durationS: +probe.durationS.toFixed(2), frameBytes: frame.length },
    };
  },
};
export default task;
