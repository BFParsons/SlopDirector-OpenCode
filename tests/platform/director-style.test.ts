import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { STYLES, styleById } from "../../src/lib/styles";
import { loadGuide } from "../../mcp/guide";
import { briefSchema, planSchema } from "../../src/lib/validation/brief";
import { checkPlan, planCli, planDocument, planTable, planTasks } from "../../src/lib/projects/plan";
import { applyRole, typeSystemFor } from "../../src/lib/typography/styleType";
import { checkText } from "../../src/lib/typography/check";

const treatment = {
  reference: "A specific reference version and its collaborators.",
  mechanism: "A recognizable pattern gains one unexpected variation.",
  materialPlan: "Use available setup and payoff coverage; source the missing contact.",
  rhythm: "Establish, repeat, pause, vary.",
  sound: "Use practical contacts and a selected musical accent.",
  typography: "A separate film title and readable source labels.",
  exceptions: ["Hold the final action beyond the starting range."],
  evaluation: "A viewer recognizes the pattern and identifies the variation.",
};
function fixture(id = "edgar-wright") {
  const brief = briefSchema.parse({
    deliverable: { kind: "standalone", durationS: 12 },
    production: { scripted: false, genre: "short film", style: { id } },
    sources: { kinds: ["upload"] }, premise: "An ordinary routine changes.", tone: "Precise",
  });
  const plan = planSchema.parse({
    logline: brief.premise, beats: [{ id: "b", title: "Routine", startS: 0, endS: 12 }],
    shots: [3, 4, 5].map((durationS, i) => ({
      id: "s" + i, order: i, beat: "b", durationS, description: "A routine action",
      source: { type: "upload", assetId: "a" + i }, sound: "muted",
    })),
    script: [], clipList: [], aiShots: [],
    music: { brief: "A restrained phrase", queries: [] },
  });
  return { plan, brief };
}

test("all researched references expose matching craft evidence and guide instructions", () => {
  const researched = STYLES.filter(s => s.craft);
  assert.equal(researched.length, 40);
  const guide = loadGuide();
  const sourceIds = new Set<string>();
  for (const s of researched) {
    const c = s.craft!;
    assert.equal(s.oneLine, c.mechanism);
    assert.equal(s.parameterBasis, "editorial-defaults");
    assert.ok(c.prerequisites && c.evaluation && c.evidence.basis, s.id);
    const text = guide.styles.get(s.id)!.text;
    assert.ok(text.includes(c.mechanism), s.id);
    assert.ok(text.includes(c.evaluation), s.id);
    assert.match(text, /# Applying a director reference/);
    assert.match(text, /plan.styleTreatment/);
    for (const source of c.evidence.sources) {
      assert.ok(text.includes(source.url), s.id);
      assert.equal(new URL(source.url).protocol, "https:");
      sourceIds.add(source.id);
    }
  }
  assert.equal(sourceIds.size, 57);
  assert.match(styleById("tony-zhou")!.name, /Taylor Ramos/);
  assert.match(styleById("a24")!.craft!.reference, /studio and distributor/i);
});

test("existing plans stay valid and receive a treatment review reminder", () => {
  const { plan, brief } = fixture();
  const checked = checkPlan(plan, brief);
  assert.ok(checked.pass);
  assert.ok(checked.findings.some(f => f.rule === "style: treatment" && f.severity === "warn"));
  assert.equal(plan.styleTreatment, undefined);
  assert.ok(planSchema.safeParse(JSON.parse(JSON.stringify(plan))).success);
});

test("treatment survives schema roundtrip, all plan views and every task handoff", () => {
  const { plan: old, brief } = fixture();
  const plan = planSchema.parse({ ...old, styleTreatment: treatment });
  assert.deepEqual(plan.styleTreatment, treatment);
  assert.ok(!checkPlan(plan, brief).findings.some(f => f.rule === "style: treatment"));
  for (const format of [planCli, planDocument, planTable]) {
    const output = format(plan, brief, "Routine");
    for (const value of Object.values(treatment).flat()) {
      assert.ok(output.replace(/\s+/g, " ").includes(value), value);
    }
  }
  for (const task of planTasks(plan).tasks) assert.deepEqual(task.spec.styleTreatment, treatment, task.id);
  assert.ok(!planTasks(old).tasks.some(t => "styleTreatment" in t.spec));
});

test("incomplete and oversized supplied treatments fail schema validation", () => {
  const { plan } = fixture();
  assert.equal(planSchema.safeParse({ ...plan, styleTreatment: {} }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, styleTreatment: { ...treatment, mechanism: " " } }).success, false);
  assert.equal(planSchema.safeParse({ ...plan, styleTreatment: { ...treatment, sound: "x".repeat(1501) } }).success, false);
});

test("documentary creative departures are advisory but technical errors still fail", () => {
  const { plan, brief } = fixture("frederick-wiseman");
  plan.script.push({ id: "n", kind: "narration", text: "The rule changes.", atS: 0, durationS: 2 });
  const check = checkPlan(plan, brief);
  assert.ok(check.pass);
  assert.ok(check.findings.some(f => f.rule === "style: Frederick Wiseman" && f.severity === "warn"));
  assert.ok(!check.findings.some(f => f.rule.startsWith("style:") && f.severity === "error"));
  plan.shots[0].durationS = 0.1;
  assert.ok(checkPlan(plan, brief).findings.some(f => /flash frame/.test(f.rule) && f.severity === "error"));
  plan.shots[0].beat = "missing";
  assert.ok(checkPlan(plan, brief).findings.some(f => /unknown beat/.test(f.message) && f.severity === "error"));
});

test("researched typography permits reference-specific faces and source roles while checking readability", () => {
  const frame = { w: 1920, h: 1080 };
  for (const id of ["edgar-wright", "werner-herzog", "mkbhd", "martin-scorsese"]) {
    const system = typeSystemFor(id)!;
    assert.equal(system.preferenceOnly, true);
    assert.deepEqual(system.never, []);
    const label = applyRole(id, "citation", frame, "Archive source", 0, { font: "Cinzel-Bold", endS: 5 });
    const checked = checkText([label], frame, "web", 12, system);
    assert.ok(checked.pass);
    assert.ok(!checked.findings.some(f => f.rule.startsWith("style:")));
    label.endS = 0.1;
    assert.ok(checkText([label], frame, "web", 12, system).findings.some(f => /reading time/.test(f.rule) && f.severity === "error"));
  }
  assert.equal(typeSystemFor("adam-curtis")!.preferenceOnly, undefined);
});

test("the active guide and catalogue do not reintroduce superseded blanket recipes", () => {
  const wright = readFileSync("guide/styles/edgar-wright.md", "utf8");
  assert.ok(!wright.includes("Everything is cut to a sound"));
  assert.ok(!wright.includes("**Never:**"));
  assert.equal(styleById("edgar-wright")!.params.narration, "optional");
  assert.equal(styleById("humphrey-jennings")!.params.narration, "optional");
  assert.ok(!styleById("johnny-harris")!.oneLine.includes("label-free"));
});
