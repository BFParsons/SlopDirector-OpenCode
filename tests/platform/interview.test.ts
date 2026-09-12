import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { interviewBatch, nextQuestion, type Answers, type Question } from "../../mcp/interview";
import { briefSchema } from "../../src/lib/validation/brief";

const request = "A two-minute historical documentary";
const answers: Answers = {
  kind: "standalone", materials: "none", durationS: 120, aspect: "16:9|1080p",
  genre: "scripted historical documentary", style: "adam-curtis", sources: ["stock"],
  premise: "How people construct a shared account of the past.",
  tone: "intense, questioning — general documentary viewers", narration: "full",
  music: "score", musicSelection: "choose", text: "lower-thirds+card", guardrails: ["include: paintings", "avoid: jerky pans"],
};

test("the initial batch includes every independent field and directing style without a known genre", () => {
  const result = interviewBatch("Make a film", {});
  assert.equal(result.done, false);
  if (result.done) return;
  assert.deepEqual(result.questions.map((q) => q.id), [
    "kind", "genre", "style", "materials", "durationS", "aspect", "sources",
    "premise", "tone", "audience", "narration", "music", "text", "guardrails",
  ]);
  assert.equal(result.progress.remaining, 14);
  assert.equal(result.progress.answered, 0);
});

test("cached clip-type menus match fresh suggestions without another tool call", () => {
  const initial = interviewBatch("Make a film", {});
  assert.ok(!initial.done);
  if (initial.done) return;
  const genreQuestion = initial.questions.find((q) => q.id === "genre")!;
  const styleQuestion = initial.questions.find((q) => q.id === "style")!;
  assert.deepEqual(genreQuestion.options.map((o) => o.label), ["Documentary", "Trailer", "Short movie", "Commercial"]);
  const expected = [
    ["adam-curtis", "ken-burns", "werner-herzog"],
    ["mark-woollen", "av-squad", "a24"],
    ["wes-anderson", "christopher-nolan", "denis-villeneuve"],
    ["ridley-scott", "spike-jonze", "jonathan-glazer"],
  ];
  for (const [i, genre] of genreQuestion.options.entries()) {
    const options = styleQuestion.optionsByGenre![genre.value];
    assert.deepEqual(options.map((o) => o.value), [...expected[i], "none"]);
    assert.ok(options.every((o) => o.description));
    // An earlier request mentioning documentary must not override the chosen format.
    const next = nextQuestion(request, { kind: "standalone", genre: genre.value });
    assert.ok(!next.done);
    if (next.done) continue;
    assert.equal(next.question.id, "style");
    assert.deepEqual(next.question.options, options);
    for (const option of options) {
      const complete = interviewBatch(request, { ...answers, genre: genre.value, style: option.value });
      assert.ok(complete.done);
      if (!complete.done) continue;
      assert.ok(briefSchema.safeParse(complete.brief).success);
      assert.equal(complete.brief.production.style?.id, option.value === "none" ? undefined : option.value);
    }
  }
});

test("custom clip types have useful suggestions and supplied styles are not re-asked", () => {
  for (const genre of ["Political Attack Ad", "Explainer", "Music video", "Visual montage", "Interview / observational", "Experimental installation"]) {
    const next = nextQuestion("Make a film", { kind: "standalone", genre });
    assert.ok(!next.done);
    if (next.done) continue;
    assert.equal(next.question.id, "style");
    assert.equal(next.question.options.length, 4);
    if (genre === "Political Attack Ad") assert.equal(next.question.options[0].value, "lincoln-project");
    if (genre === "Interview / observational") assert.equal(next.question.options[0].value, "frederick-wiseman");
  }
  const queue = interviewBatch("Make a trailer", { kind: "standalone", style: "adam-curtis" });
  assert.ok(!queue.done);
  if (!queue.done) assert.ok(!queue.questions.some((q) => q.id === "style"));
});

test("one complete reply produces the same valid draft brief as the guided interview", () => {
  const batch = interviewBatch(request, answers);
  assert.equal(batch.done, true);
  if (!batch.done) return;
  assert.ok(briefSchema.safeParse(batch.brief).success);
  assert.equal(batch.brief.production.style?.id, "adam-curtis");
  assert.equal(batch.brief.audience, "general documentary viewers");
  assert.deepEqual(batch.brief.mustInclude, ["paintings"]);
  assert.deepEqual(batch.brief.avoid, ["jerky pans"]);
  assert.equal(batch.brief.status, "draft");
  const accumulated: Answers = {};
  for (let i = 0; i <= Object.keys(answers).length; i++) {
    const step = nextQuestion(request, accumulated);
    if (step.done) { assert.deepEqual(step, batch); return; }
    assert.ok(step.question.id in answers);
    accumulated[step.question.id] = answers[step.question.id];
  }
  assert.fail("guided interview did not finish");
});

test("conditional scene, material and licence gaps arrive together without repeating answered fields", () => {
  const partial = { ...answers, kind: "scene", materials: "both", sources: ["youtube", "upload"] };
  const followup = interviewBatch(request, partial);
  assert.equal(followup.done, false);
  if (followup.done) return;
  assert.deepEqual(followup.questions.map((q) => q.id), ["scenePart", "context", "materialsText", "licence"]);
  const materialsText = "  NARRATOR: A new beginning.\r\n\r\nSHOT 1: Hold on a painting.\n";
  const complete = interviewBatch(request, {
    ...partial, scenePart: "The opening discovery.", context: "After the prologue, before the evidence.",
    materialsText, licence: "cc",
  });
  assert.equal(complete.done, true);
  if (!complete.done) return;
  assert.ok(briefSchema.safeParse(complete.brief).success);
  assert.equal(complete.brief.materials?.text, materialsText);
  assert.equal(complete.brief.sources.notes, "Creative Commons only");
  assert.deepEqual(complete.brief.sources.kinds, ["youtube", "upload"]);
  assert.match(complete.brief.deliverable.parentContext!, /opening discovery/);
});

test("partial replies stay pending, supplied answers are reused, and none is an explicit choice", () => {
  const partial = { ...answers, tone: undefined, narration: null, music: "none", text: "none" };
  const result = interviewBatch(request, partial);
  assert.equal(result.done, false);
  if (result.done) return;
  assert.deepEqual(result.questions.map((q) => q.id), ["tone", "audience", "narration"]);
  assert.deepEqual(interviewBatch(request, partial), result);
  assert.equal(partial.narration, null);
  const complete = interviewBatch(request, { ...partial, tone: "quiet", audience: "general viewers", narration: "none" });
  assert.equal(complete.done, true);
  if (!complete.done) return;
  assert.equal(complete.brief.music?.wanted, false);
  assert.equal(complete.brief.text?.wanted, false);
  assert.equal(complete.brief.narration?.wanted, false);
});

test("the real MCP entry supports cached questions and conditional music follow-ups", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(__dirname, "../../mcp/run.cjs")],
    env: { ...process.env as Record<string, string>, SLOPSTUDIO_AGENT_FEED: "0" },
    stderr: "pipe",
  });
  const client = new Client({ name: "interview-batch-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === "interview_batch"));
    assert.ok(tools.some((tool) => tool.name === "interview_next"));
    const prompt = await client.getPrompt({ name: "interview", arguments: { request } });
    const content = prompt.messages[0].content;
    assert.equal(content.type, "text");
    if (content.type === "text") {
      assert.match(content.text, /Call interview_batch/);
      assert.match(content.text, /ONE QUESTION AT A TIME FROM A CACHED QUEUE/);
      assert.match(content.text, /Do not call interview_next or interview_batch after every answer/);
      assert.match(content.text, /optionsByGenre/);
      assert.match(content.text, /musicSelection/);
      assert.match(content.text, /musicReference/);
      assert.doesNotMatch(content.text, /ONE UP-FRONT QUESTIONNAIRE|combine related fields into a compact questionnaire/);
    }
    const call = async (values: Answers) => {
      const result = await client.callTool({ name: "interview_batch", arguments: { request, answers: values } });
      assert.ok(!result.isError);
      const first = (result.content as { type: string; text?: string }[]).find((c) => c.type === "text");
      return JSON.parse(first!.text!) as ReturnType<typeof interviewBatch>;
    };
    const initial = await call({});
    assert.equal(initial.done, false);
    if (initial.done) return;
    assert.ok(initial.questions.find((q) => q.id === "style")?.optionsByGenre?.["scripted documentary"]);
    const accumulated: Answers = {};
    // Simulate successive user replies without any intervening MCP call.
    for (const question of initial.questions) {
      if (question.id === "audience" && String(accumulated.tone).includes(" — ")) continue;
      accumulated[question.id] = answers[question.id];
    }
    const music = await call(accumulated);
    assert.ok(!music.done);
    if (music.done) return;
    assert.deepEqual(music.questions.map(q => q.id), ["musicSelection"]);
    accumulated.musicSelection = "soundtrack";
    const reference = await call(accumulated);
    assert.ok(!reference.done);
    if (reference.done) return;
    assert.deepEqual(reference.questions.map(q => q.id), ["musicReference"]);
    accumulated.musicReference = "The Power of Nightmares";
    const complete = await call(accumulated);
    assert.ok(complete.done);
    if (!complete.done) return;
    assert.ok(briefSchema.safeParse(complete.brief).success);
    assert.match(complete.brief.music!.brief!, /The Power of Nightmares/);
    assert.deepEqual(complete, interviewBatch(request, accumulated));
  } finally {
    await client.close();
  }
});

test("music selection waits for an explicit answer and delegation needs no reference", () => {
  const partial = { ...answers, musicSelection: undefined };
  const step = nextQuestion(request, partial);
  assert.ok(!step.done);
  if (step.done) return;
  assert.equal(step.question.id, "musicSelection");
  assert.deepEqual(step.question.options.map(o => o.value), ["choose", "soundtrack", "tracks"]);
  assert.deepEqual(nextQuestion(request, partial), step);
  assert.equal(partial.musicSelection, undefined);
  const complete = interviewBatch(request, { ...partial, musicSelection: "choose" });
  assert.ok(complete.done);
  if (complete.done) assert.match(complete.brief.music!.brief!, /selection delegated/);
});

test("a soundtrack reference is collected once and stays independent of directing style", () => {
  for (const empty of [undefined, null, "", "  "]) {
    const step = interviewBatch(request, { ...answers, musicSelection: "soundtrack", musicReference: empty });
    assert.ok(!step.done);
    if (!step.done) assert.deepEqual(step.questions.map(q => q.id), ["musicReference"]);
  }
  const reference = "The Power of Nightmares\nMorricone for the cake; The Big Ship at the verdict.";
  const complete = interviewBatch(request, { ...answers, style: "ken-burns", musicSelection: "soundtrack", musicReference: reference });
  assert.ok(complete.done);
  if (!complete.done) return;
  const brief = briefSchema.parse(complete.brief);
  assert.equal(brief.production.style?.id, "ken-burns");
  assert.ok(brief.music!.brief!.endsWith(reference));
  assert.match(brief.music!.brief!, /film or series soundtrack/);
});

test("track names, URLs and local paths survive brief assembly verbatim", () => {
  const partial = { ...answers, musicSelection: "tracks" };
  const step = nextQuestion(request, partial);
  assert.ok(!step.done);
  if (!step.done) {
    assert.equal(step.question.id, "musicReference");
    assert.match(step.question.question, /local files/);
  }
  const reference = '  Brian Eno - The Big Ship\r\nhttps://example.com/music?a=1&b=2\nD:\\Music\\My score.wav  ';
  const complete = interviewBatch(request, { ...partial, musicReference: reference });
  assert.ok(complete.done);
  if (complete.done) assert.ok(briefSchema.parse(complete.brief).music!.brief!.endsWith(reference));
});

test("supplied music and custom directions bypass redundant selection questions", () => {
  for (const provided of [
    { musicSelection: undefined, musicReference: "Use music from The Power of Nightmares" },
    { musicSelection: "Sparse analog synths, with no vocals" },
    { music: "Use The Big Ship for the ending", musicSelection: undefined },
  ]) {
    const complete = interviewBatch(request, { ...answers, ...provided });
    assert.ok(complete.done);
    if (!complete.done) continue;
    assert.ok(briefSchema.safeParse(complete.brief).success);
    const supplied = provided.musicReference ?? provided.musicSelection ?? provided.music!;
    assert.ok(complete.brief.music!.brief!.includes(supplied));
  }
});

test("no music suppresses follow-ups and discards stale references from the brief", () => {
  for (const musicSelection of [undefined, "soundtrack", "tracks"]) {
    const complete = interviewBatch(request, { ...answers, music: "none", musicSelection, musicReference: "The Big Ship" });
    assert.ok(complete.done);
    if (complete.done) assert.deepEqual(complete.brief.music, { wanted: false });
  }
  const changed = interviewBatch(request, { ...answers, musicSelection: "tracks", musicReference: undefined });
  assert.ok(!changed.done);
  if (!changed.done) assert.deepEqual(changed.questions.map(q => q.id), ["musicReference"]);
});


test("genre, tone and audience provide usable choices without model-generated menus", () => {
  const queue = interviewBatch("Make a film", {});
  assert.equal(queue.done, false);
  if (queue.done) return;
  const selected: Answers = { ...answers, tone: "", audience: "" };
  for (const id of ["genre", "tone", "audience"] as const) {
    const question: Question = queue.questions.find((q) => q.id === id)!;
    assert.ok(question.options.length >= 2 && question.options.length <= 4);
    assert.equal(question.agentFills, undefined);
    selected[id] = question.options[0].value;
  }
  const complete = interviewBatch(request, selected);
  assert.equal(complete.done, true);
  if (!complete.done) return;
  assert.ok(briefSchema.safeParse(complete.brief).success);
  assert.equal(complete.brief.audience, "general viewers");
});
