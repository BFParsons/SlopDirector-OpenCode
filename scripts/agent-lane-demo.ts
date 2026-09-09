/**
 * Demo / smoke test for the Agent panel: replays a short scripted agent
 * session (look → check → edit) into a project's activity feed, and — with
 * --screenshot <file> — opens the editor headlessly and captures it.
 *
 *   pnpm exec tsx scripts/agent-lane-demo.ts <projectId> [--screenshot out.png]
 *
 * The events are real (POST /api/activity), so an open editor shows them;
 * the one edit it makes (a segment's volume) is a real PATCH too.
 */
import type { ConsoleMessage } from "@playwright/test";

const base = process.env.SLOPSTUDIO_URL ?? "http://127.0.0.1:38473";
const [projectId, ...rest] = process.argv.slice(2);
const shot = rest.includes("--screenshot") ? rest[rest.indexOf("--screenshot") + 1] : null;
if (!projectId) {
  console.error("usage: agent-lane-demo.ts <projectId> [--screenshot out.png]");
  process.exit(2);
}
const headers = { "content-type": "application/json", "X-Requested-With": "spotforge", ...(process.env.SLOPSTUDIO_API_TOKEN ? { Authorization: `Bearer ${process.env.SLOPSTUDIO_API_TOKEN}` } : {}) };
const post = async (path: string, data: unknown, method = "POST") => {
  const r = await fetch(base + path, { method, headers, body: JSON.stringify(data) });
  if (!r.ok) console.log(method, path, r.status, (await r.text()).slice(0, 120));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function replay(segmentId: string | null, videoAssetId: string | null, newVolume = 1.9) {
  const cid = (n: number) => `demo-${Date.now()}-${n}`;
  const steps: { tool: string; args: Record<string, unknown>; ms: number; summary: string }[] = [
    { tool: "get_project", args: { projectId }, ms: 120, summary: "31 s · 12 shots · music bed · 7 narration clips" },
    ...(videoAssetId ? [{ tool: "get_contact_sheet", args: { assetId: videoAssetId, cols: 4, rows: 2, startS: 55, endS: 90, width: 800 }, ms: 1700, summary: "Cells read left→right, top→bottom; source times (s): [55, 59.4, 63.8, 68.1, 72.5, 76.9, 81.3, 85.6]" }] : []),
    { tool: "check_soundtrack", args: { projectId }, ms: 240, summary: "pass: true · 5 sound bites over the bed · the bed ducks under narration and bites" },
    { tool: "check_cuts", args: { projectId }, ms: 900, summary: "11 cuts · no mid-word cuts · no flash frames · 1 jump cut flagged at 16.5 s (same source)" },
    ...(segmentId ? [{ tool: "update_segments", args: { projectId, edits: [{ id: segmentId, volume: newVolume }] }, ms: 80, summary: "1 segment updated" }] : []),
  ];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const callId = cid(i);
    await post("/api/activity", { projectId, callId, phase: "start", tool: s.tool, args: s.args, agent: "demo" });
    await sleep(Math.min(1200, s.ms));
    if (s.tool === "update_segments" && segmentId) await post(`/api/projects/${projectId}`, { segments: [{ id: segmentId, volume: newVolume }] }, "PATCH");
    await post("/api/activity", { projectId, callId, phase: "end", tool: s.tool, ok: true, ms: s.ms, summary: s.summary, agent: "demo" });
    await sleep(300);
  }
}

(async () => {
  const snap = (await (await fetch(`${base}/api/projects/${projectId}`, { headers })).json()) as { data?: { segments: { id: string; audioOnly: boolean; library: boolean; sourceAssetId: string | null; source: string; volume?: number }[] } };
  const shots = (snap.data?.segments ?? []).filter((s) => !s.audioOnly && !s.library && s.source === "UPLOAD_VIDEO");
  const target = shots[1] ?? shots[0] ?? null;
  const segmentId = target?.id ?? null;
  // A real change every run: nudge the clip's volume by a hair so the timeline flashes it.
  const newVolume = target ? +((target.volume ?? 1) > 1.5 ? (target.volume ?? 1) - 0.05 : (target.volume ?? 1) + 0.05).toFixed(2) : 1;
  const videoAssetId = shots[0]?.sourceAssetId ?? null;
  if (!shot) {
    await replay(segmentId, videoAssetId, newVolume);
    console.log("replayed into the project's agent lane");
    return;
  }
  const { chromium } = await import("@playwright/test");
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/usr/bin/chromium" });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, extraHTTPHeaders: { "X-Requested-With": "spotforge" } });
  const page = await ctx.newPage();
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error") console.log("console:", m.text().slice(0, 200));
  });
  page.on("pageerror", (e: Error) => console.log("pageerror:", e.message.slice(0, 200)));
  await page.goto(`${base}/projects/${projectId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await replay(segmentId, videoAssetId, newVolume);
  await page.waitForTimeout(700);
  await page.screenshot({ path: shot });
  const n = await page.evaluate(() => ({ clips: document.querySelectorAll("[data-clip-id]").length, flashing: document.querySelectorAll(".agent-flash").length }));
  console.log(JSON.stringify(n), "→", shot);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
