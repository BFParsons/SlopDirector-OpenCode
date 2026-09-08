import path from "node:path";
import { type Task, addVideoSegment, close, createProject, downloadDraft, ffprobe, genToneWithGaps, render, snapshot, uploadAsset } from "../harness";

const task: Task = {
  name: "remove-silences",
  brief: "The clip has dead air. Cut every silence longer than half a second and keep everything else in order.",
  async run(api, ctx) {
    const src = await genToneWithGaps(path.join(ctx.tmp, "tone-gaps.mp4"));
    const pid = await createProject(api, "eval: remove silences");
    ctx.cleanup(pid);
    const assetId = await uploadAsset(api, pid, src);
    const first = await addVideoSegment(api, pid, assetId);
    // --- reference solution: perceive, then re-cut into one segment per sounded range
    const sil = await api.get<{ speech: { startS: number; endS: number }[]; silences: unknown[] }>(`/api/assets/${assetId}/silences?noise=-40&min=0.5`);
    for (const r of sil.speech) await addVideoSegment(api, pid, assetId, { trimStartS: r.startS, durationS: +(r.endS - r.startS).toFixed(3) });
    await api.del(`/api/projects/${pid}/segments/${first.segments[0].id}`);
    const snap = await snapshot(api, pid);
    await api.patch(`/api/projects/${pid}`, { segments: snap.segments.map((s) => ({ id: s.id, muted: false })) });
    // --- score
    const { snap: done, ms } = await render(api, pid, true);
    const out = await downloadDraft(api, pid, path.join(ctx.tmp, "remove-silences-draft.mp4"));
    const probe = await ffprobe(out);
    const outSil = await api.get<{ silences: { durationS: number }[] }>(`/api/assets/${done.finalRender!.draftAssetId}/silences?noise=-40&min=0.5`);
    const expected = 9;
    const durationOk = close(probe.durationS, expected, 0.7);
    const noSilence = outSil.silences.every((s) => s.durationS < 0.5);
    return {
      pass: durationOk && noSilence && sil.speech.length === 3,
      metrics: { detectedSpeechRanges: sil.speech.length, outputS: +probe.durationS.toFixed(2), expectedS: expected, silencesLeft: outSil.silences.length, renderMs: ms },
    };
  },
};
export default task;
