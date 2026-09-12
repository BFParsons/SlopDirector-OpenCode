import assert from "node:assert/strict";
import { test } from "node:test";
import { CAPS } from "../../src/config/models";
import { checkPlan } from "../../src/lib/projects/plan";
import { briefSchema, planSchema } from "../../src/lib/validation/brief";
import { patchProjectSchema, reorderSegmentsSchema } from "../../src/lib/validation/project";
import { loadGuide } from "../../mcp/guide";

function fixture(count = 48, durationS = 1.25, style = "av-squad") {
  const brief = briefSchema.parse({
    deliverable: { kind: "standalone", durationS: count * durationS },
    production: { scripted: false, genre: "trailer", style: { id: style } },
    sources: { kinds: ["upload"] },
    premise: "A public performance becomes increasingly difficult to control.",
    tone: "Energetic, precise, satirical",
  });
  const plan = planSchema.parse({
    logline: brief.premise,
    beats: [{ id: "arc", title: "Pressure", startS: 0, endS: count * durationS }],
    script: [],
    shots: Array.from({ length: count }, (_, i) => ({
      id: "s" + i, beat: "arc", order: i, durationS,
      description: "Distinct archival moment " + i,
      source: { type: "upload", assetId: "asset" + i },
      sound: "muted",
    })),
    clipList: [], aiShots: [],
    music: { brief: "An auditioned cue with contrasting phrases.", queries: [] },
  });
  return { brief, plan };
}

test("a dense one-minute trailer can pass beyond the old 30-segment limit", () => {
  const { plan, brief } = fixture();
  const result = checkPlan(plan, brief);
  assert.equal(result.pass, true, JSON.stringify(result.findings));
  assert.equal(reorderSegmentsSchema.safeParse({ orderedIds: plan.shots.map(s => s.id) }).success, true);
  assert.equal(patchProjectSchema.safeParse({ segments: plan.shots.map(s => ({ id: s.id, durationS: s.durationS })) }).success, true);
});

test("visual and audio capacities accept their boundaries and reject overflow", () => {
  for (const [key, cap] of [["segments", CAPS.maxSegments], ["audioOverlays", CAPS.maxAudioOverlays]] as const) {
    const items = Array.from({ length: cap }, (_, i) => ({ id: "item" + i }));
    assert.equal(patchProjectSchema.safeParse({ [key]: items }).success, true);
    assert.equal(patchProjectSchema.safeParse({ [key]: [...items, { id: "overflow" }] }).success, false);
  }
  assert.equal(reorderSegmentsSchema.safeParse({ orderedIds: Array.from({ length: CAPS.maxSegments + 1 }, (_, i) => String(i)) }).success, false);
  const { plan, brief } = fixture(CAPS.maxSegments + 1, 0.5);
  assert.equal(checkPlan(plan, brief).pass, false);
});

test("six-to-nine-frame accents warn while sub-six-frame shots remain errors", () => {
  const { plan, brief } = fixture(10, 0.2);
  assert.equal(checkPlan(plan, brief).pass, true);
  assert.ok(checkPlan(plan, brief).findings.some(f => f.severity === "warn" && /readable/.test(f.rule)));
  plan.shots[0].durationS = 0.1;
  assert.ok(checkPlan(plan, brief).findings.some(f => f.severity === "error" && /flash frame/.test(f.rule)));
});

test("creative style departures remain advisory across trailer and documentary references", () => {
  const { plan, brief } = fixture(12, 5, "mark-woollen");
  plan.script.push({ id: "n1", kind: "narration", text: "A change begins.", atS: 0, durationS: 2 });
  const result = checkPlan(plan, brief);
  assert.equal(result.pass, true, JSON.stringify(result.findings));
  assert.ok(result.findings.some(f => f.rule === "style: Mark Woollen" && f.severity === "warn"));
  brief.production.style = { id: "frederick-wiseman" };
  assert.ok(checkPlan(plan, brief).findings.some(f => f.rule === "style: Frederick Wiseman" && f.severity === "warn"));
});

test("technical plan errors and the AI cost guard remain enforced", () => {
  const { plan, brief } = fixture(9, 2);
  brief.sources.kinds = ["ai"];
  for (const shot of plan.shots) shot.source = { type: "ai", prompt: "An abstract landscape." };
  assert.ok(checkPlan(plan, brief).findings.some(f => f.severity === "error" && /AI shots/.test(f.rule)));
  plan.shots[0].beat = "missing";
  assert.ok(checkPlan(plan, brief).findings.some(f => f.severity === "error" && /unknown beat/.test(f.message)));
});

test("served trailer profiles include flexible constraints and honest listening status", () => {
  const guide = loadGuide();
  for (const id of ["av-squad", "anais-bimpel", "mark-woollen", "a24"]) {
    const text = guide.styles.get(id)!.text;
    assert.match(text, /# Trailer construction/);
    assert.match(text, /no required on-grid percentage/);
    assert.match(text, /listening is unavailable/);
  }
  assert.ok(!guide.styles.get("adam-curtis")!.text.includes("# Trailer construction"));
});
