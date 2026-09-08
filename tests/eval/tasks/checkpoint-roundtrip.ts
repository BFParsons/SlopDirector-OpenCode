import path from "node:path";
import { type Task, addVideoSegment, createProject, genScenes, snapshot, uploadAsset } from "../harness";

const task: Task = {
  name: "checkpoint-roundtrip",
  brief: "Try an edit, then roll the project back to the checkpoint taken before it.",
  async run(api, ctx) {
    const src = await genScenes(path.join(ctx.tmp, "scenes.mp4"));
    const pid = await createProject(api, "eval: checkpoint");
    ctx.cleanup(pid);
    const assetId = await uploadAsset(api, pid, src);
    await addVideoSegment(api, pid, assetId, { trimStartS: 0, durationS: 3 });
    await addVideoSegment(api, pid, assetId, { trimStartS: 6, durationS: 3 });
    const before = await snapshot(api, pid);
    const cp = await api.post<{ id: string; segments: number }>(`/api/projects/${pid}/checkpoints`, { label: "before the bot" });
    // a destructive "edit"
    await api.del(`/api/projects/${pid}/segments/${before.segments[0].id}`);
    await api.patch(`/api/projects/${pid}`, { title: "eval: checkpoint (mangled)" });
    const mangled = await snapshot(api, pid);
    // roll back
    const restored = await api.post<{ title: string; segments: { id: string; trimStartS: number; durationS: number }[] }>(`/api/projects/${pid}/checkpoints/${cp.id}/restore`);
    const list = await api.get<{ id: string }[]>(`/api/projects/${pid}/checkpoints`);
    const sameIds = JSON.stringify(restored.segments.map((s) => s.id)) === JSON.stringify(before.segments.map((s) => s.id));
    const sameCuts = restored.segments.every((s, i) => s.trimStartS === before.segments[i].trimStartS && s.durationS === before.segments[i].durationS);
    return {
      pass: cp.segments === 2 && mangled.segments.length === 1 && sameIds && sameCuts && restored.title === before.title && list.length === 1,
      metrics: { segmentsBefore: before.segments.length, segmentsAfterEdit: mangled.segments.length, segmentsRestored: restored.segments.length, titleRestored: restored.title === before.title, checkpoints: list.length },
    };
  },
};
export default task;
