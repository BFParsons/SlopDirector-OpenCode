/**
 * Acceptance test for the MCP layer: spawn mcp/server.ts over stdio, and solve
 * the eval tasks THROUGH THE TOOLS (not raw HTTP). Scores use the same
 * ffprobe / perception checks as tests/eval.
 *
 *   SLOPSTUDIO_URL=http://127.0.0.1:38473 pnpm test:mcp
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TMP, close, ffprobe, genScenes, genToneWithGaps } from "../eval/harness";

type Content = { type: string; text?: string; data?: string; mimeType?: string };

async function main() {
  await mkdir(TMP, { recursive: true });
  const transport = new StdioClientTransport({
    command: path.resolve("node_modules/.bin/tsx"),
    args: [path.resolve("mcp/server.ts")],
    env: { ...process.env as Record<string, string>, SLOPSTUDIO_URL: process.env.SLOPSTUDIO_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:38473" },
    stderr: "pipe",
  });
  const client = new Client({ name: "slopstudio-mcp-test", version: "0.0.1" });
  await client.connect(transport);

  const call = async <T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<{ json: T; content: Content[] }> => {
    const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: 10 * 60_000 })) as { content: Content[]; isError?: boolean };
    const first = res.content.find((c) => c.type === "text");
    if (res.isError) throw new Error(`${name}: ${first?.text ?? "error"}`);
    let json: T = undefined as T;
    if (first?.text) {
      try {
        json = JSON.parse(first.text) as T;
      } catch {
        json = first.text as unknown as T;
      }
    }
    return { json, content: res.content };
  };

  const results: { check: string; pass: boolean; detail: string }[] = [];
  const check = (name: string, pass: boolean, detail = "") => results.push({ check: name, pass, detail });
  const created: string[] = [];
  const fakes: string[] = []; // fake transcripts we planted in the shared cache

  try {
    // --- discovery
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    check("lists ≥ 25 tools", names.length >= 25, `${names.length} tools`);
    for (const must of ["create_project", "import_media", "get_contact_sheet", "detect_silences", "add_segment", "apply_edit_list", "render_draft", "restore_checkpoint"]) {
      check(`tool ${must}`, names.includes(must));
    }
    const resources = await client.listResources();
    check("resource slopstudio://projects", resources.resources.some((r) => r.uri === "slopstudio://projects"));
    const prompts = await client.listPrompts();
    check("prompt edit_video", prompts.prompts.some((p) => p.name === "edit_video"));

    // --- task 1: remove silences, through the tools
    const tone = await genToneWithGaps(path.join(TMP, "tone-gaps.mp4"));
    const p1 = await call<{ id: string; frame: { w: number; h: number } }>("create_project", { title: "mcp: remove silences", preset: "preview" });
    created.push(p1.json.id);
    check("create_project preview frame", p1.json.frame.w === 640 && p1.json.frame.h === 360);
    const asset = await call<{ id: string; durationS: number; video: { width: number } }>("import_media", { projectId: p1.json.id, path: tone });
    check("import_media probes duration", close(asset.json.durationS, 13, 0.3), `durationS=${asset.json.durationS}`);
    const sil = await call<{ speech: { startS: number; endS: number }[] }>("detect_silences", { assetId: asset.json.id, noiseDb: -40, minS: 0.5 });
    check("detect_silences finds 3 sounded ranges", sil.json.speech.length === 3);
    const sheet = await call("get_contact_sheet", { assetId: asset.json.id, cols: 3, rows: 2, width: 600 });
    check("contact sheet returns an image", sheet.content.some((c) => c.type === "image" && (c.data?.length ?? 0) > 1000));
    const ops = sil.json.speech.map((r) => ({ op: "add_segment", assetId: asset.json.id, trimStartS: r.startS, durationS: +(r.endS - r.startS).toFixed(3), muted: false }));
    const applied = await call<{ applied: number; createdSegmentIds: string[]; project: { timelineDurationS: number; segments: unknown[] } }>("apply_edit_list", { projectId: p1.json.id, ops });
    check("apply_edit_list builds 3 segments", applied.json.applied === 3 && applied.json.project.segments.length === 3 && close(applied.json.project.timelineDurationS, 9, 0.1), `timeline=${applied.json.project.timelineDurationS}s`);
    const draft = await call<{ draftAssetId: string; durationS: number; path: string; renderMs: number }>("render_draft", { projectId: p1.json.id });
    check("render_draft returns a file", close(draft.json.durationS, 9, 0.7) && draft.json.path.endsWith("draft.mp4"), `duration=${draft.json.durationS} in ${draft.json.renderMs}ms`);
    const outSil = await call<{ silences: { durationS: number }[] }>("detect_silences", { assetId: draft.json.draftAssetId, noiseDb: -40, minS: 0.5 });
    check("draft has no silence ≥ 0.5 s", outSil.json.silences.length === 0, `silences=${outSil.json.silences.length}`);
    const frame = await call("get_frame", { assetId: draft.json.draftAssetId, t: 1, width: 320 });
    check("get_frame on the draft", frame.content.some((c) => c.type === "image"));
    const probe = await ffprobe(draft.json.path);
    check("draft path is a real ≤360p file", probe.height <= 360 && probe.hasAudio);

    // --- task 2: scene highlight + checkpoint rollback, through the tools
    const scenes = await genScenes(path.join(TMP, "scenes.mp4"));
    const p2 = await call<{ id: string }>("create_project", { title: "mcp: highlight", width: 640, height: 360 });
    created.push(p2.json.id);
    const a2 = await call<{ id: string }>("import_media", { projectId: p2.json.id, path: scenes });
    const sc = await call<{ shots: { startS: number; endS: number }[]; cuts: number[] }>("detect_scenes", { assetId: a2.json.id, threshold: 0.3 });
    check("detect_scenes finds 4 shots", sc.json.shots.length === 4, `cuts=${sc.json.cuts.join("/")}`);
    for (const sh of sc.json.shots) await call("add_segment", { projectId: p2.json.id, assetId: a2.json.id, trimStartS: sh.startS, durationS: Math.min(2, +(sh.endS - sh.startS).toFixed(3)), muted: false });
    const cp = await call<{ id: string; segments: number }>("create_checkpoint", { projectId: p2.json.id, label: "4 shots" });
    check("create_checkpoint captured 4 segments", cp.json.segments === 4);
    const before = await call<{ segments: { id: string }[] }>("get_project", { projectId: p2.json.id });
    // a bad batch: the 3rd op references a missing segment → rollback expected
    let rolledBack = false;
    try {
      await call("apply_edit_list", { projectId: p2.json.id, ops: [{ op: "delete_segment", id: before.json.segments[0].id }, { op: "delete_segment", id: before.json.segments[1].id }, { op: "delete_segment", id: "nope" }] });
    } catch (e) {
      rolledBack = /rolled back/.test((e as Error).message);
    }
    const after = await call<{ segments: { id: string }[] }>("get_project", { projectId: p2.json.id });
    check("apply_edit_list rolls back on failure", rolledBack && after.json.segments.length === 4);
    await call("delete_segment", { projectId: p2.json.id, segmentId: before.json.segments[0].id });
    const restored = await call<{ segments: { id: string }[] }>("restore_checkpoint", { projectId: p2.json.id, checkpointId: cp.json.id });
    check("restore_checkpoint brings the segment back", restored.json.segments.length === 4 && restored.json.segments[0].id === before.json.segments[0].id);
    const d2 = await call<{ draftAssetId: string; durationS: number }>("render_draft", { projectId: p2.json.id });
    const outSc = await call<{ cuts: number[] }>("detect_scenes", { assetId: d2.json.draftAssetId, threshold: 0.3 });
    check("highlight draft: 8 s with 3 cuts", close(d2.json.durationS, 8, 0.5) && Math.abs(outSc.json.cuts.length - 3) <= 1, `duration=${d2.json.durationS} cuts=${outSc.json.cuts.length}`);
    const res = await client.readResource({ uri: `slopstudio://projects/${p2.json.id}` });
    check("resource read returns the project", (res.contents[0] as { text?: string }).text?.includes(p2.json.id) === true);

    // --- the guide as harness knowledge
    const guideHit = await call<{ id: string; chapter: string }[]>("search_guide", { query: "jump cut consistently", limit: 3 });
    check("search_guide finds the 30-degree / jump-cut section", guideHit.json.some((h) => /15/.test(h.chapter)), guideHit.json.map((h) => h.id).join(", "));
    const ch17 = await call<string>("read_guide", { section: "17" });
    check("read_guide returns chapter 17 (dialogue)", typeof ch17.json === "string" && /J-cuts and L-cuts/.test(ch17.json));
    const toc = await call<{ chapters: unknown[]; playbooks: { name: string }[] }>("list_guide", {});
    check("list_guide: ≥ 37 chapters, ≥ 7 playbooks", toc.json.chapters.length >= 37 && toc.json.playbooks.length >= 7, `${toc.json.chapters.length} chapters`);
    const pb = await call<string>("get_playbook", { name: "interview-cleanup" });
    check("get_playbook interview-cleanup", typeof pb.json === "string" && /apply_edit_list/.test(pb.json));
    const prompt = await client.getPrompt({ name: "playbook", arguments: { name: "scene-highlight", projectId: p2.json.id } });
    const promptText = (prompt.messages[0].content as { text?: string }).text ?? "";
    check("playbook prompt embeds the rules", /Always-on rules/.test(promptText) && /pacing_report/.test(promptText));
    const guideRes = await client.readResource({ uri: "slopstudio://guide/16-rhythm-and-pacing" });
    check("guide chapter resource", ((guideRes.contents[0] as { text?: string }).text ?? "").includes("Average shot length"));

    // --- mechanical checks (guide ch.16/17/24/29/32)
    const pacing = await call<{ count: number; aslS: number; findings: unknown[]; comparison: string | null }>("pacing_report", { projectId: p2.json.id, genre: "social" });
    check("pacing_report: 4 shots of 2 s, uniform flagged, social norm", pacing.json.count === 4 && pacing.json.aslS === 2 && pacing.json.findings.length >= 1 && /inside|faster|slower/.test(pacing.json.comparison ?? ""), `asl=${pacing.json.aslS} findings=${pacing.json.findings.length}`);
    // Fake transcripts go into the server's content-addressed cache (lib/media/cache.ts),
    // which outlives the run — the fixtures are regenerated byte-identical, so clear ours first.
    const { writeFileSync, rmSync } = await import("node:fs");
    const { mediaCachePath } = await import("../../src/lib/media/cache");
    const info = await call<{ path: string; projectId: string }>("probe_asset", { assetId: a2.json.id });
    const fakeA2 = await mediaCachePath(info.json.path, "transcript-base.json");
    rmSync(fakeA2, { force: true });
    fakes.push(fakeA2);
    const cuts0 = await call<{ cuts: number[]; findings: { rule: string }[]; untranscribedSources: string[] }>("check_cuts", { projectId: p2.json.id });
    check("check_cuts: 3 cut times, no transcript → hint, no false errors", cuts0.json.cuts.length === 3 && cuts0.json.untranscribedSources.length === 1 && !cuts0.json.findings.some((f) => /mid-word|inside the word/.test(f.rule)));
    // a fake transcript in the server's cache puts a word across the 3.0 s cut → check_cuts must catch it
    writeFileSync(fakeA2, JSON.stringify({ language: "en", text: "hello world", segments: [{ startS: 2.5, endS: 3.6, text: "hello world", words: [{ startS: 2.5, endS: 2.8, text: "hello" }, { startS: 2.85, endS: 3.4, text: "world" }] }], words: [{ startS: 2.5, endS: 2.8, text: "hello" }, { startS: 2.85, endS: 3.4, text: "world" }], srt: null, vtt: null }));
    const cuts1 = await call<{ findings: { rule: string; message: string; index?: number }[] }>("check_cuts", { projectId: p2.json.id });
    const mid = cuts1.json.findings.filter((f) => /inside the word/.test(f.message));
    check("check_cuts flags the cut inside \"world\" at 3.0 s", mid.length === 1 && /"world"/.test(mid[0].message), mid.map((m) => m.message).join(" | "));
    const ver = await call<{ pass: boolean; findings: { rule: string }[]; loudness: { integratedLufs: number | null } | null; file: { durationS: number } }>("verify_export", { assetId: d2.json.draftAssetId, target: "none", expectedDurationS: 8, expectedWidth: 640, expectedHeight: 360 });
    check("verify_export passes the 8 s draft with loudness measured", ver.json.pass && ver.json.loudness?.integratedLufs != null, `lufs=${ver.json.loudness?.integratedLufs} findings=${ver.json.findings.length}`);
    const verBad = await call<{ pass: boolean; findings: { rule: string }[] }>("verify_export", { assetId: d2.json.draftAssetId, target: "web", expectedDurationS: 9 });
    check("verify_export fails a wrong expected duration", !verBad.json.pass && verBad.json.findings.some((f) => /duration/.test(f.rule)));
    await call("delete_segment", { projectId: p2.json.id, segmentId: before.json.segments[3].id });
    const diff = await call<{ removed: unknown[]; added: unknown[]; changed: unknown[]; from: { runtimeS: number }; to: { runtimeS: number } }>("compare_versions", { projectId: p2.json.id, fromCheckpointId: cp.json.id });
    check("compare_versions: one segment removed, runtime 8 → 6", diff.json.removed.length === 1 && diff.json.added.length === 0 && diff.json.from.runtimeS === 8 && diff.json.to.runtimeS === 6, `runtime ${diff.json.from.runtimeS}→${diff.json.to.runtimeS}`);
    const au = await call<{ loudness: { integratedLufs: number | null } | null; tempo: { bpm: number | null; beatsS: number[] } | null }>("analyze_audio", { assetId: a2.json.id, kinds: ["loudness", "tempo"] });
    check("analyze_audio returns loudness + a beat grid", au.json.loudness?.integratedLufs != null && Array.isArray(au.json.tempo?.beatsS), `lufs=${au.json.loudness?.integratedLufs} beats=${au.json.tempo?.beatsS.length}`);
    // --- soundtrack: video is silent by default; a clash is caught before rendering
    const addedQuiet = await call<{ segments: { id: string; muted: boolean; audioOnly: boolean }[] }>("add_segment", { projectId: p2.json.id, assetId: a2.json.id, trimStartS: 0, durationS: 1 });
    const quiet = addedQuiet.json.segments.filter((x) => !x.audioOnly).at(-1)!;
    check("add_segment mutes video by default", quiet.muted === true);
    await call("delete_segment", { projectId: p2.json.id, segmentId: quiet.id });
    // narration clip from the tone clip (it has a fake transcript with words) + an unmuted shot with "speech" under it
    const tone2 = await call<{ id: string }>("import_media", { projectId: p2.json.id, path: tone });
    const tone2Info = await call<{ path: string }>("probe_asset", { assetId: tone2.json.id });
    const fakeTone = await mediaCachePath(tone2Info.json.path, "transcript-base.json");
    fakes.push(fakeTone);
    writeFileSync(fakeTone, JSON.stringify({ language: "en", text: "one two", segments: [], words: [{ startS: 0.2, endS: 0.6, text: "one" }, { startS: 1.0, endS: 1.4, text: "two" }], srt: null, vtt: null }));
    const loud = await call<{ segments: { id: string; muted: boolean; audioOnly: boolean; track: number; durationS: number; index: number }[] }>("add_segment", { projectId: p2.json.id, assetId: tone2.json.id, trimStartS: 0, durationS: 1.5, muted: false });
    const loudShot = loud.json.segments.filter((x) => !x.audioOnly).at(-1)!;
    // the narration must sit UNDER the seeded shot (it is appended after the highlight's shots)
    const loudStart = loud.json.segments.filter((x) => x.track === 0 && !x.audioOnly && x.index < loudShot.index).reduce((a, x) => a + x.durationS, 0);
    await call("add_segment", { projectId: p2.json.id, assetId: tone2.json.id, audioOnly: true, trimStartS: 0, durationS: 1.5, offsetS: +loudStart.toFixed(3) });
    const st = await call<{ pass: boolean; findings: { severity: string; rule: string }[]; map: string[]; layers: { narrationClips: unknown[] } }>("check_soundtrack", { projectId: p2.json.id });
    check("check_soundtrack flags speech bleeding through under narration", !st.json.pass && st.json.findings.some((f) => f.severity === "error" && /B-roll/.test(f.rule)) && st.json.layers.narrationClips.length === 1, st.json.findings.map((f) => f.rule).join(" | "));
    await call("update_segments", { projectId: p2.json.id, edits: [{ id: loudShot.id, muted: true }] });
    const st2 = await call<{ pass: boolean; findings: { severity: string }[] }>("check_soundtrack", { projectId: p2.json.id });
    check("check_soundtrack passes once the shot is muted", st2.json.pass, `${st2.json.findings.length} non-error findings`);
    await call("delete_segment", { projectId: p2.json.id, segmentId: loudShot.id });
    for (const n of (await call<{ segments: { id: string; audioOnly: boolean }[] }>("get_project", { projectId: p2.json.id })).json.segments.filter((x) => x.audioOnly)) await call("delete_segment", { projectId: p2.json.id, segmentId: n.id });

    // click track at 120 BPM as the music bed: 2 s shots cut on beats
    const click = path.join(TMP, "click-120.wav");
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "aevalsrc=if(lt(mod(t\\,0.5)\\,0.03)\\,sin(2*PI*1000*t)\\,0):s=48000", "-t", "12", click]);
    await call("set_music", { projectId: p2.json.id, path: click, volume: 0.5 });
    // voice-vs-music: balance the bed from measured levels, render, read it back
    // B-roll under narration is muted (RULES 25) — and since sound bites count as
    // speech windows, an unmuted tone shot would leave no music-only stretch to read.
    const p2now = await call<{ segments: { id: string; audioOnly: boolean; muted: boolean }[] }>("get_project", { projectId: p2.json.id });
    const toMute = p2now.json.segments.filter((x) => !x.audioOnly && !x.muted).map((x) => ({ id: x.id, muted: true }));
    if (toMute.length) await call("update_segments", { projectId: p2.json.id, edits: toMute });
    const nar = await call<{ segments: { id: string; audioOnly: boolean }[] }>("add_segment", { projectId: p2.json.id, assetId: tone2.json.id, audioOnly: true, trimStartS: 0, durationS: 2.5, offsetS: 0 });
    const narId = nar.json.segments.filter((x) => x.audioOnly).at(-1)!.id;
    const bal = await call<{ musicVolume: number; voiceIntegratedLufs: number; musicIntegratedLufs: number; gainDb: number }>("balance_music", { projectId: p2.json.id, gapLu: 6 });
    check("balance_music sets a measured musicVolume", bal.json.musicVolume > 0 && bal.json.musicVolume <= 1 && Number.isFinite(bal.json.voiceIntegratedLufs), `voice=${bal.json.voiceIntegratedLufs} music=${bal.json.musicIntegratedLufs} → volume ${bal.json.musicVolume} (${bal.json.gainDb} dB)`);
    const d3 = await call<{ draftAssetId?: string; stillRendering?: boolean }>("render_draft", { projectId: p2.json.id });
    let draft3 = d3.json.draftAssetId;
    for (let i = 0; i < 60 && !draft3; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const rs = await call<{ status: string }>("render_status", { projectId: p2.json.id });
      if (rs.json.status !== "RENDERING") draft3 = (await call<{ draftAssetId: string }>("draft_result", { projectId: p2.json.id })).json.draftAssetId;
    }
    const lv = await call<{ speech: { medianLufs: number | null }; musicOnly: { medianLufs: number | null }; gapLu: number | null; speechToMusicUnderSpeechLu: number | null; findings: { severity: string }[] }>("check_mix_levels", { projectId: p2.json.id, assetId: draft3 });
    check("check_mix_levels reads speech vs music from the draft", lv.json.speech.medianLufs != null && lv.json.musicOnly.medianLufs != null && lv.json.gapLu != null, `speech=${lv.json.speech.medianLufs} music=${lv.json.musicOnly.medianLufs} gap=${lv.json.gapLu} smr=${lv.json.speechToMusicUnderSpeechLu}`);
    await call("delete_segment", { projectId: p2.json.id, segmentId: narId });
    const beat = await call<{ bpm: number | null; total: number; onGrid: number; onGridPct: number | null }>("check_beat_alignment", { projectId: p2.json.id, toleranceFrames: 2 });
    check("check_beat_alignment: 120 BPM click, cuts at 2/4 s on grid", beat.json.total === 2 && beat.json.onGrid === 2 && (beat.json.bpm ?? 0) > 100 && (beat.json.bpm ?? 0) < 140, `bpm=${beat.json.bpm} onGrid=${beat.json.onGrid}/${beat.json.total}`);

    // --- pre-production: brief → plan → check → document → tasks → approve; storyboard of the cut
    let briefRejected = "";
    try {
      await call("set_brief", { projectId: p2.json.id, brief: { deliverable: { kind: "standalone", durationS: 12 }, production: { scripted: true, genre: "attack ad" }, sources: { kinds: ["youtube"] }, premise: "", tone: "mean" } });
    } catch (e) {
      briefRejected = (e as Error).message;
    }
    check("set_brief rejects an empty premise", briefRejected !== "", briefRejected.slice(0, 80));
    const brief = { deliverable: { kind: "standalone", durationS: 12, aspect: "16:9", resolution: "720p" }, production: { scripted: true, genre: "attack ad", form: "spot" }, sources: { kinds: ["youtube", "ai"] }, premise: "Twelve seconds against the tone clip.", tone: "mean, dry, fast", narration: { wanted: true, voice: "rex" }, music: { wanted: true } };
    const b = await call<{ brief: { status: string } }>("set_brief", { projectId: p2.json.id, brief });
    check("set_brief stores a draft brief", b.json.brief?.status === "draft");
    const plan = {
      logline: "The tone clip, exposed.",
      beats: [{ id: "hook", title: "Hook", startS: 0, endS: 4 }, { id: "case", title: "The case", startS: 4, endS: 10 }, { id: "sting", title: "Sting", startS: 10, endS: 12 }],
      script: [{ id: "n1", kind: "narration", text: "Listen to this.", atS: 0.3 }, { id: "b1", kind: "bite", text: "beep", atS: 4, shotId: "s2" }, { id: "n2", kind: "narration", text: "It never stopped beeping.", atS: 6.2 }, { id: "t1", kind: "text", text: "BEEP.", atS: 10 }],
      shots: [
        { id: "s1", beat: "hook", order: 0, durationS: 4, description: "the tone source, wide", source: { type: "youtube", clipId: "c1" }, sound: "vo" },
        { id: "s2", beat: "case", order: 1, durationS: 2, description: "the beep itself", source: { type: "youtube", clipId: "c1", section: { startS: 0, endS: 30 } }, sound: "sync" },
        { id: "s3", beat: "case", order: 2, durationS: 4, description: "AI: an oscilloscope trace pulsing", source: { type: "ai" }, sound: "muted" },
        { id: "s4", beat: "sting", order: 3, durationS: 2, description: "end card", source: { type: "card" }, sound: "muted", text: "BEEP.", transition: "cut" },
      ],
      clipList: [{ id: "c1", need: "a clip with a clear beep", queries: ["test tone beep"], durationHintS: 30 }],
      aiShots: [{ shotId: "s3", prompt: "an oscilloscope trace pulsing on a dark screen, macro, cinematic", model: "alibaba/wan-2.7", durationS: 4 }],
      music: { brief: "ominous drone", queries: ["ominous drone royalty free"] },
      narration: { voice: "rex", lines: [{ scriptId: "n1", text: "Listen to this." }, { scriptId: "n2", text: "It never stopped beeping." }] },
      risks: ["the beep may be copyrighted"],
    };
    const sp = await call<{ plan: { version: number; status: string }; check: { pass: boolean; findings: { severity: string; rule: string; message: string }[]; summary: { totalS: number; aiCostUsd: number } }; documentPath: string | null }>("set_plan", { projectId: p2.json.id, plan });
    check("set_plan stores v1 as proposed and checks it", sp.json.plan?.version === 1 && sp.json.plan.status === "proposed" && sp.json.check?.summary.totalS === 12, `v=${sp.json.plan?.version} total=${sp.json.check?.summary.totalS}`);
    check("check_plan: AI length warning + cost, no errors", sp.json.check.pass && sp.json.check.findings.some((f) => /5 s clips/.test(f.message)) && sp.json.check.summary.aiCostUsd > 0, sp.json.check.findings.map((f) => f.message.slice(0, 50)).join(" | "));
    const bad = await call<{ check: { pass: boolean; findings: { severity: string; message: string }[] } }>("set_plan", { projectId: p2.json.id, plan: { ...plan, shots: plan.shots.map((x) => (x.id === "s1" ? { ...x, durationS: 9 } : x)) } });
    check("check_plan flags a length that misses the brief", !bad.json.check.pass && bad.json.check.findings.some((f) => f.severity === "error" && /add up to 17/.test(f.message)), bad.json.check.findings.filter((f) => f.severity === "error").map((f) => f.message).join(" | "));
    await call("set_plan", { projectId: p2.json.id, plan });
    const tbl = await call<unknown>("plan_document", { projectId: p2.json.id });
    const tblText = tbl.content.find((c) => c.type === "text")?.text ?? "";
    check("plan_document (table) draws the AV script as a boxed table", /│ VIDEO/.test(tblText) && /│ AUDIO/.test(tblText) && /BITE "beep"/.test(tblText) && /┌/.test(tblText) && /CLIPS TO FIND/.test(tblText) && /CHECK: PASS/.test(tblText), tblText.split("\n").slice(0, 3).join(" | "));
    const cli = await call<unknown>("plan_document", { projectId: p2.json.id, format: "list" });
    const cliText = cli.content.find((c) => c.type === "text")?.text ?? "";
    check("plan_document (list) lists script + storyboard in one time-ordered list", /SCRIPT \+ STORYBOARD/.test(cliText) && /BITE "beep"/.test(cliText) && /CLIPS TO FIND/.test(cliText) && /CHECK: PASS/.test(cliText), cliText.split("\n").slice(0, 3).join(" | "));
    const doc = await call<unknown>("plan_document", { projectId: p2.json.id, format: "markdown" });
    const docText = doc.content.find((c) => c.type === "text")?.text ?? "";
    check("plan_document renders beats, storyboard, clips and AI prompts", /## Beats/.test(docText) && /## Storyboard/.test(docText) && /## Clips to find/.test(docText) && /oscilloscope/.test(docText) && /CHECK: PASS/.test(docText));
    const tasks = await call<{ tasks: { id: string; deps: string[] }[]; parallelNow: string[] }>("plan_tasks", { projectId: p2.json.id });
    check("plan_tasks: source, ai, narration, music run first; assemble waits for them", tasks.json.parallelNow.sort().join(",") === "ai:s3,music,narration,source:c1" && tasks.json.tasks.find((t) => t.id === "assemble")!.deps.length === 4, tasks.json.parallelNow.join(","));
    const ap = await call<{ plan: { status: string; version: number }; brief: { status: string } }>("approve_plan", { projectId: p2.json.id });
    check("approve_plan marks plan v3 and brief approved", ap.json.plan?.status === "approved" && ap.json.plan.version === 3 && ap.json.brief?.status === "approved", `v=${ap.json.plan?.version}`);
    const sb = await call<unknown>("storyboard_sheet", { projectId: p2.json.id, cols: 4, width: 320 });
    const sbText = sb.content.find((c) => c.type === "text")?.text ?? "";
    check("storyboard_sheet returns one captioned frame per shot", sb.content.some((c) => c.type === "image") && /Shots left/.test(sbText), sbText.slice(0, 60));
    const vm = await call<{ video: { id: string; durationsS?: number[] }[] }>("list_video_models", {});
    check("list_video_models lists the video models with clip lengths", vm.json.video.length >= 3 && vm.json.video.every((m) => Array.isArray(m.durationsS)));
    if (process.env.MCP_TEST_NETWORK === "1") {
      const yt = await call<{ candidates: { id: string; durationS: number | null }[] }>("search_youtube", { query: "Audionautix High Tension", max: 3 });
      check("search_youtube returns candidates with durations", yt.json.candidates.length > 0 && yt.json.candidates.every((c) => typeof c.durationS === "number"));
    }
  } finally {
    for (const f of fakes) (await import("node:fs")).rmSync(f, { force: true });
    for (const id of created) await call("delete_project", { projectId: id }).catch(() => {});
    await client.close();
  }

  console.table(results.map((r) => ({ check: r.check, pass: r.pass ? "PASS" : "FAIL", detail: r.detail })));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
