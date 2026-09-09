/**
 * End-to-end timing of an agent editing job, phase by phase, over ONE MCP
 * connection (the way a real client works). Reuses already-imported media
 * (the asset ids below) so the numbers are about the app, not the network.
 *
 *   pnpm exec tsx tests/bench/job.ts <label>            # writes tests/bench/results/<label>.json
 *   BENCH_IMPORT=1 …                                    # also time one YouTube section import
 *   BENCH_MODEL=small …                                 # transcription model (default base)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// LEGO job material (imported 2026-09-08); override with BENCH_ASSETS=json
const ASSETS = process.env.BENCH_ASSETS
  ? (JSON.parse(process.env.BENCH_ASSETS) as Record<string, string>)
  : { A0: "cmtt1gkcu0013m64nbfy55n0p", A1: "cmtt1o4db001hm64n852eobhw", A2: "cmtt1i9fu0017m64nrnei2lmy", A3: "cmtt1hg170015m64n6fwe21te", A4: "cmtt1owqh001jm64n5e091cyx", A6: "cmtt1kvj8001dm64nsmb0p19r", A7: "cmtt1mqqg001fm64nqizyh6pl" };
const MUSIC_PATH = process.env.BENCH_MUSIC ?? path.resolve(".data/assets/cmtt1d6670001m64nciddv5zu/overlays/yt-audio-cmtt1fg0j000zm64ndnyeqsq1.mp3");

type Content = { type: string; text?: string };
const label = process.argv[2] ?? `run-${Date.now()}`;
const times: Record<string, number> = {};
const notes: Record<string, string> = {};
const t = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const t0 = Date.now();
  const r = await fn();
  times[name] = +((Date.now() - t0) / 1000).toFixed(2);
  return r;
};

async function main() {
  const transport = new StdioClientTransport({ command: path.resolve("node_modules/.bin/tsx"), args: [path.resolve("mcp/server.ts")], env: process.env as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "bench", version: "0.0.1" });
  await t("mcp_connect", async () => client.connect(transport));
  const call = async <T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
    const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: 30 * 60_000 })) as { content: Content[]; isError?: boolean };
    const first = res.content.find((c) => c.type === "text")?.text ?? "";
    if (res.isError) throw new Error(`${name}: ${first}`);
    try {
      return JSON.parse(first) as T;
    } catch {
      return first as unknown as T;
    }
  };
  const waitRender = async (pid: string, draft: boolean) => {
    for (;;) {
      const st = await call<{ status: string }>("render_status", { projectId: pid });
      if (st.status !== "RENDERING") return call(draft ? "draft_result" : "final_result", { projectId: pid });
      await new Promise((r) => setTimeout(r, 1000));
    }
  };
  const bust = Date.now() % 97; // cache-busting width offset for contact sheets
  const ids = Object.values(ASSETS);
  const created: string[] = [];
  try {
    // --- perception, sequential
    await t("perceive_sequential", async () => {
      for (const a of ids) await call("get_contact_sheet", { assetId: a, cols: 4, rows: 3, width: 1200 + bust });
      for (const a of ids.slice(0, 6)) await call("detect_scenes", { assetId: a, threshold: 0.35 });
      for (const a of ids.slice(0, 2)) await call("detect_silences", { assetId: a });
    });
    // --- perception, parallel (same calls at once)
    await t("perceive_parallel", async () => {
      await Promise.all([
        ...ids.map((a) => call("get_contact_sheet", { assetId: a, cols: 4, rows: 3, width: 1300 + bust })),
        ...ids.slice(0, 6).map((a) => call("detect_scenes", { assetId: a, threshold: 0.35 })),
        ...ids.slice(0, 2).map((a) => call("detect_silences", { assetId: a })),
      ]);
    });
    // --- transcription, uncached, one 60 s narrated clip
    const model = process.env.BENCH_MODEL ?? "base";
    await t(`transcribe_${model}`, async () => {
      let r = await call<{ running?: boolean }>("transcribe", { assetId: ASSETS.A4, model, force: true, includeWords: false });
      while (r.running) {
        await new Promise((res) => setTimeout(res, 2000));
        r = await call("transcribe", { assetId: ASSETS.A4, model, includeWords: false });
      }
    });
    // --- the cut (the LEGO edit list, 21 shots + 3 narration clips + music + titles)
    const pid = await t("create_project", async () => (await call<{ id: string }>("create_project", { title: `bench ${label}`, preset: "1080p" })).id);
    created.push(pid);
    const shots: [string, number, number][] = [
      [ASSETS.A2, 34.3, 2.5], [ASSETS.A2, 0.3, 3.0], [ASSETS.A2, 4.2, 2.5], [ASSETS.A2, 38.5, 2.5], [ASSETS.A2, 16.0, 3.5], [ASSETS.A3, 8.2, 2.0], [ASSETS.A0, 20.0, 2.5], [ASSETS.A3, 4.2, 2.0], [ASSETS.A3, 24.5, 2.0], [ASSETS.A3, 16.5, 1.5], [ASSETS.A3, 47.5, 2.5], [ASSETS.A3, 28.2, 3.0], [ASSETS.A3, 32.3, 4.0], [ASSETS.A2, 12.0, 3.0], [ASSETS.A6, 50.5, 3.0], [ASSETS.A7, 8.0, 3.5], [ASSETS.A1, 27.5, 2.5], [ASSETS.A7, 46.7, 3.0], [ASSETS.A2, 22.5, 2.5], [ASSETS.A6, 20.0, 4.4], [ASSETS.A7, 51.7, 4.6],
    ];
    const ops: Record<string, unknown>[] = shots.map(([a, ts, d]) => ({ op: "add_segment", assetId: a, trimStartS: ts, durationS: d }));
    for (const [ts, d, o] of [[0.0, 8.4, 2.0], [17.6, 8.3, 29.7], [45.55, 3.75, 54.6]]) ops.push({ op: "add_segment", assetId: ASSETS.A4, audioOnly: true, trimStartS: ts, durationS: d, offsetS: o });
    await t("apply_edit_list", () => call("apply_edit_list", { projectId: pid, ops }));
    await t("music_and_titles", async () => {
      if (existsSync(MUSIC_PATH)) {
        await call("set_music", { projectId: pid, path: MUSIC_PATH });
        await call("balance_music", { projectId: pid, gapLu: 8 });
      } else notes.music = "music file not found; skipped";
      await call("update_project", { projectId: pid, patch: { audioFadeOutS: 2.5 } });
      await call("add_text_overlay", { projectId: pid, text: "LEGO", position: "CENTER", startS: 10.8, endS: 13.9, sizePct: 18, boxEnabled: false, animation: "FADE" });
    });
    await t("checks_pre", async () => {
      await call("check_soundtrack", { projectId: pid });
      await call("check_cuts", { projectId: pid });
      await call("pacing_report", { projectId: pid });
    });
    await t("render_draft", async () => {
      await call("render_draft", { projectId: pid, wait: false });
      await waitRender(pid, true);
    });
    const draft = await call<{ draftAssetId: string }>("draft_result", { projectId: pid });
    await t("checks_post", async () => {
      await call("verify_export", { assetId: draft.draftAssetId, target: "social", expectedDurationS: 60 });
      await call("check_mix_levels", { projectId: pid });
    });
    await t("render_final", async () => {
      await call("render_final", { projectId: pid, wait: false });
      await waitRender(pid, false);
    });
    if (process.env.BENCH_IMPORT === "1") {
      await t("import_youtube_60s_of_780s", async () => {
        await call("import_youtube", { projectId: pid, url: "https://www.youtube.com/watch?v=Hbo2vj6qrJs", startS: 120, endS: 180 });
        for (;;) {
          const p = await call<{ segments: { status: string; sourceAssetId: string | null }[] }>("get_project", { projectId: pid });
          const last = p.segments.filter((s) => s.status !== "READY" || !s.sourceAssetId);
          if (!last.length) break;
          if (p.segments.some((s) => s.status === "FAILED")) throw new Error("import failed");
          await new Promise((r) => setTimeout(r, 2000));
        }
      });
    }
  } finally {
    for (const id of created) await call("delete_project", { projectId: id }).catch(() => {});
    await client.close();
  }
  const total = +Object.values(times).reduce((a, b) => a + b, 0).toFixed(1);
  const out = { label, at: new Date().toISOString(), times, total, notes };
  mkdirSync("tests/bench/results", { recursive: true });
  writeFileSync(`tests/bench/results/${label}.json`, JSON.stringify(out, null, 2));
  const base = process.env.BENCH_COMPARE && existsSync(`tests/bench/results/${process.env.BENCH_COMPARE}.json`) ? (JSON.parse(readFileSync(`tests/bench/results/${process.env.BENCH_COMPARE}.json`, "utf8")) as { times: Record<string, number> }).times : null;
  console.table(Object.entries(times).map(([phase, s]) => ({ phase, seconds: s, ...(base ? { baseline: base[phase] ?? null, speedup: base[phase] ? `${(base[phase] / s).toFixed(2)}×` : "" } : {}) })));
  console.log(`total ${total} s${base ? ` (baseline ${Object.values(base).reduce((a, b) => a + b, 0).toFixed(1)} s)` : ""} — ${label}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
