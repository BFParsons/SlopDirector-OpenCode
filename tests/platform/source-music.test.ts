import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceAudioSchema, planSchema } from "../../src/lib/validation/brief";
import { sourceAudioCovers, sourceMusicFinding } from "../../src/lib/audio/source-music";
import { checkPlan, planDocument, planCli, planTable, planTasks } from "../../src/lib/projects/plan";
import { loadGuide } from "../../mcp/guide";
import { api, type Snapshot, type Segment } from "../../mcp/client";
import { soundtrackReport } from "../../mcp/tools/verify";

const clean = sourceAudioSchema.parse({ music: "none", treatment: "isolated", review: "listened", assetId: "voice", startS: 0, endS: 3, originalMusic: "present", notes: "Level-matched solo and mix review." });
function fixture() {
  return planSchema.parse({ logline: "A warning", beats: [{ id: "b", title: "Warning", startS: 0, endS: 3 }], script: [], clipList: [], aiShots: [], music: { brief: "New cue", queries: [] }, shots: [{ id: "s", beat: "b", order: 0, durationS: 3, description: "Dialogue", source: { type: "upload", assetId: "film", section: { startS: 10, endS: 13 } }, sound: "sync" }] });
}
test("known score fails; unknown and unreviewed separation cannot certify clean dialogue", () => {
  assert.equal(sourceMusicFinding({ ...clean, music: "present" })?.severity, "error");
  assert.equal(sourceMusicFinding()?.severity, "warn");
  assert.equal(sourceMusicFinding({ ...clean, music: "unknown" })?.severity, "warn");
  assert.equal(sourceMusicFinding({ ...clean, review: "pending" })?.severity, "warn");
  assert.equal(sourceMusicFinding(clean), null);
  const p = fixture();
  assert.ok(checkPlan(p, null).findings.some(f => f.rule === "sound: embedded source music"));
  p.shots[0].sourceAudio = { ...clean, music: "present" };
  assert.equal(checkPlan(p, null).pass, false);
});
test("review is bound to the actual asset and whole source interval", () => {
  assert.equal(sourceAudioCovers(clean, "voice", 0, 3), true);
  assert.equal(sourceAudioCovers(clean, "film", 0, 3), false);
  assert.equal(sourceAudioCovers(clean, "voice", 0, 3.1), false);
  assert.equal(sourceAudioCovers(clean, "voice", 3, 6), false);
  assert.equal(sourceAudioSchema.safeParse({ ...clean, startS: 4 }).success, false);
});
test("audio assessment survives schema, review documents and assembly handoff", () => {
  const p = fixture(); p.shots[0].sourceAudio = clean;
  const copy = planSchema.parse(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(copy.shots[0].sourceAudio, clean);
  for (const format of [planDocument, planCli, planTable]) assert.match(format(copy, null, "Warning"), /embedded music none; review listened/);
  assert.ok(JSON.stringify(planTasks(copy)).includes('"sourceAudio"'));
  for (const style of loadGuide().styles.values()) assert.match(style.text, /# Clean dialogue from film clips/);
});
test("soundtrack audit catches scored speech and a still-audible original; checks isolated tracks too", async () => {
  const p = fixture();
  const shot = { id: "segment", index: 0, track: 0, audioOnly: false, library: false, muted: false, volume: 1, sourceAssetId: "film", trimStartS: 10, durationS: 3, speed: 1, offsetS: 0 } as Segment;
  const s = { segments: [shot], audioOverlays: [], musicAssetId: "music", musicVolume: 1, musicMuted: false, musicDucking: true, audioMode: "NONE", audioFadeOutS: 1 } as unknown as Snapshot;
  const original = api.get;
  api.get = (async (url: string) => {
    if (url === "/api/projects/test") return s;
    if (url.endsWith("/plan")) return { plan: p };
    if (url.endsWith("/brief")) return { brief: null };
    if (url.includes("silences")) return { speech: [{ startS: 0, endS: 30 }] };
    if (url.includes("transcribe")) return { words: [{ startS: 10, endS: 12, text: "Warning" }] };
    throw Error("No media requested by fixture");
  }) as typeof api.get;
  try {
    assert.ok((await soundtrackReport("test")).findings.some(f => f.rule === "sound: embedded source music" && f.severity === "warn"));
    p.shots[0].sourceAudio = clean;
    assert.ok((await soundtrackReport("test")).findings.some(f => f.severity === "error" && /original.*still audible/.test(f.message)));
    shot.muted = true;
    s.segments.push({ ...shot, id: "stem", audioOnly: true, track: 1, trimStartS: 0, sourceAssetId: "voice" });
    assert.ok(!(await soundtrackReport("test")).findings.some(f => f.rule === "sound: embedded source music"));
    p.shots[0].sourceAudio = { ...clean, review: "pending" };
    assert.ok((await soundtrackReport("test")).findings.some(f => f.segmentId === "stem" && f.severity === "warn"));
  } finally { api.get = original; }
});
