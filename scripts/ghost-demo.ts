/**
 * Watch the invisible editor: with the project open in the app, this replays
 * a real edit through the MCP server — checkpoint, clear the main sequence
 * shot by shot, rebuild it in order, render a draft — then restores the
 * checkpoint. Every step is a real tool call, so the timeline empties and
 * refills before your eyes, the playhead follows, and the monitor switches
 * to the draft when it lands.
 *
 *   pnpm exec tsx scripts/ghost-demo.ts <projectId> [--keep]
 */
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [projectId, ...flags] = process.argv.slice(2);
if (!projectId) {
  console.error("usage: ghost-demo.ts <projectId> [--keep]");
  process.exit(2);
}
const keep = flags.includes("--keep");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Seg = { id: string; index: number; track: number; audioOnly: boolean; library: boolean; sourceAssetId: string | null; trimStartS: number; durationS: number; muted: boolean; volume?: number; speed: number };

async function main() {
  const transport = new StdioClientTransport({ command: path.resolve("node_modules/.bin/tsx"), args: [path.resolve("mcp/server.ts")], env: { ...process.env, SLOPSTUDIO_AGENT_NAME: "ghost" } as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "ghost-demo", version: "0.0.1" });
  await client.connect(transport);
  const call = async <T = unknown>(name: string, args: Record<string, unknown>): Promise<T> => {
    const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: 10 * 60_000 })) as { content: { type: string; text?: string }[]; isError?: boolean };
    const text = res.content.find((c) => c.type === "text")?.text ?? "";
    if (res.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  };
  const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)}  ${m}`);
  try {
    const snap = await call<{ segments: Seg[] }>("get_project", { projectId });
    const shots = snap.segments.filter((s) => s.track === 0 && !s.audioOnly && !s.library && s.sourceAssetId).sort((a, b) => a.index - b.index);
    if (shots.length < 2) throw new Error("the project needs a main sequence of at least 2 shots");
    const cp = await call<{ id: string }>("create_checkpoint", { projectId, label: "before the ghost demo" });
    log(`checkpoint ${cp.id} · ${shots.length} shots on the main sequence`);
    await sleep(1500);
    log("clearing the sequence, last shot first…");
    for (const s of [...shots].reverse()) {
      await call("delete_segment", { projectId, segmentId: s.id });
      await sleep(350);
    }
    await sleep(1500);
    log("rebuilding it in order…");
    for (const s of shots) {
      await call("add_segment", { projectId, assetId: s.sourceAssetId, trimStartS: s.trimStartS, durationS: s.durationS, muted: s.muted, ...(s.volume != null && s.volume !== 1 ? { volume: s.volume } : {}) });
      await sleep(450);
    }
    await sleep(800);
    log("checks…");
    await call("check_soundtrack", { projectId });
    await call("pacing_report", { projectId });
    log("rendering a draft…");
    const d = await call<{ draftAssetId?: string; started?: boolean }>("render_draft", { projectId, wait: true });
    log(d.draftAssetId ? `draft ${d.draftAssetId} — the monitor shows it now` : "draft still rendering");
    await sleep(4000);
  } finally {
    if (!keep) {
      type Cp = { id: string; label: string | null };
      const cps = await call<{ checkpoints: Cp[] } | Cp[]>("list_checkpoints", { projectId });
      const list: Cp[] = Array.isArray(cps) ? cps : cps.checkpoints;
      const mine = list.find((c) => c.label === "before the ghost demo");
      if (mine) {
        await call("restore_checkpoint", { projectId, checkpointId: mine.id });
        log("restored the checkpoint — the project is as it was");
      }
    }
    await client.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
