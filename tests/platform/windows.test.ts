import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ffQuote, FONT_BOLD } from "../../src/lib/ffmpeg/args";
import { ffmpegPath } from "../../src/lib/ffmpeg/binary";
import { cachedJson } from "../../src/lib/media/cache";

const root = path.resolve(__dirname, "../..");
const scratch = path.join(root, ".data", "platform-tests");
mkdirSync(scratch, { recursive: true });

test("analysis recovers from a cached missing-dependency result after installation", async () => {
  const source = path.join(mkdtempSync(path.join(scratch, "cache-")), "source.txt");
  writeFileSync(source, source);
  const missing = { bpm: null as number | null, beatsS: [] as number[] };
  await cachedJson("tempo", source, async () => missing);
  const accept = (value: typeof missing) => value.bpm != null && value.beatsS.length > 0;
  const valid = { bpm: 120, beatsS: [0.5, 1] };
  assert.deepEqual(await cachedJson("tempo", source, async () => valid, accept), valid);
  assert.deepEqual(await cachedJson("tempo", source, async () => { throw new Error("should reuse successful analysis"); }, accept), valid);
});

test("FFmpeg reads titles, LUTs and captions through native paths containing punctuation", () => {
  const dir = mkdtempSync(path.join(scratch, "Editor's clips [test],; "));
  const title = path.join(dir, "title's text.txt");
  const font = path.join(dir, "font.ttf");
  const lut = path.join(dir, "look.cube");
  const captions = path.join(dir, "captions.ass");
  writeFileSync(title, "Windows & Codex: 100% ready");
  copyFileSync(FONT_BOLD, font);
  writeFileSync(lut, "LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n");
  writeFileSync(captions, `[Script Info]\nScriptType: v4.00+\nPlayResX: 320\nPlayResY: 180\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Caption\n`);
  const graph = [
    `drawtext=fontfile=${ffQuote(font)}:textfile=${ffQuote(title)}:expansion=none:fontsize=20`,
    `lut3d=file=${ffQuote(lut)}`,
    `ass=filename=${ffQuote(captions)}:fontsdir=${ffQuote(dir)}`,
  ].join(",");
  execFileSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:d=1", "-vf", graph, "-frames:v", "1", "-f", "null", "-"], { windowsHide: true, timeout: 30000, stdio: "pipe" });
});

test("Codex stdio entry discovers the full harness from another working directory", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, "mcp", "run.cjs")],
    cwd: scratch,
    env: { ...process.env as Record<string, string>, SLOPSTUDIO_AGENT_FEED: "0" },
    stderr: "pipe",
  });
  const client = new Client({ name: "windows-codex-check", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    for (const name of ["interview_next", "set_brief", "set_plan", "approve_plan", "plan_tasks", "apply_edit_list", "render_draft", "render_final"]) {
      assert.ok(tools.some((tool) => tool.name === name), name);
    }
    const interview = await client.getPrompt({ name: "interview", arguments: { request: "A 30 second film from my own clips" } });
    const content = interview.messages[0].content;
    assert.equal(content.type, "text");
    if (content.type === "text") assert.match(content.text, /Codex: use request_user_input_async/);
    const result = await client.callTool({ name: "interview_next", arguments: { request: "A 30 second standalone film", answers: { kind: "standalone", durationS: 30 } } });
    assert.ok(!result.isError);
    const first = (result.content as { type: string; text?: string }[]).find((c) => c.type === "text");
    assert.equal(JSON.parse(first!.text!).question.id, "genre");
    const guide = await client.readResource({ uri: "slopstudio://guide/16-rhythm-and-pacing" });
    assert.ok("text" in guide.contents[0]);
    assert.match(guide.contents[0].text, /Average shot length/);
  } finally {
    await client.close();
  }
});
