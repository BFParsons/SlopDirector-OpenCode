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
    const res = (await client.callTool({ name, arguments: args })) as { content: Content[]; isError?: boolean };
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
    for (const sh of sc.json.shots) await call("add_segment", { projectId: p2.json.id, assetId: a2.json.id, trimStartS: sh.startS, durationS: Math.min(2, +(sh.endS - sh.startS).toFixed(3)) });
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
  } finally {
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
