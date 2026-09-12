import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRole, roleOf, STYLE_TYPE, typeSystemFor } from "../../src/lib/typography/styleType";
import { checkText } from "../../src/lib/typography/check";

const landscape = { w: 1920, h: 1080 };

test("styles without an explicit title get a distinct, style-aware film title", () => {
  const title = applyRole("tony-zhou", "title", landscape, "Phantom Time", 0);
  const card = applyRole("tony-zhou", "card", landscape, "History is uncertain", 0);
  assert.equal(title.font, "NotoSans-Regular");
  assert.equal(title.text, "Phantom Time");
  assert.ok(title.sizePct > card.sizePct);
  assert.equal(title.position, "CENTER");
  assert.equal(title.animation, "FADE");
  assert.equal(title.boxEnabled, false);
  assert.equal(title.shadow, 0);
  assert.equal(roleOf(title.preset), "title");
  assert.equal(roleOf(card.preset), "card");
  const portrait = applyRole("tony-zhou", "title", { w: 1080, h: 1920 }, "Phantom\nTime", 0);
  assert.ok(portrait.sizePct < title.sizePct);
  assert.ok(checkText([portrait], { w: 1080, h: 1920 }).pass);
});

test("Curtis film titles are bold and colored while supporting cards remain plain", () => {
  const title = applyRole("adam-curtis", "title", landscape, "After the\nLight", 0);
  const card = applyRole("adam-curtis", "card", landscape, "After the light", 0);
  assert.equal(title.text, "AFTER THE\nLIGHT");
  assert.equal(title.font, "LiberationSans-Bold");
  assert.equal(title.color, "#00DED4");
  assert.ok(title.sizePct >= card.sizePct * 2);
  assert.equal(card.text, "After the light");
  assert.equal(card.font, "LiberationSans-Regular");
  assert.equal(card.color, "#FFFFFF");
  assert.ok(checkText([title], landscape, "web", 4, typeSystemFor("adam-curtis")).pass);
});

test("every registered style resolves a title and preserves explicit quiet designs", () => {
  for (const style of STYLE_TYPE) {
    const title = applyRole(style.style, "title", landscape, "Film", 0);
    assert.ok(style.faces.includes(title.font), style.name);
    assert.equal(roleOf(title.preset), "title");
    assert.ok(title.endS! > title.startS);
  }
  assert.equal(applyRole("frederick-wiseman", "title", landscape, "Film", 0).sizePct, 5);
  assert.equal(applyRole("jonathan-glazer", "title", landscape, "Film", 0).sizePct, 5);
});

test("a custom title face and uppercase treatment do not impose the same choice on captions", () => {
  const style = typeSystemFor("adam-curtis")!;
  const title = applyRole(style.style, "title", landscape, "PHANTOM TIME", 0, {
    font: "Cinzel-Bold", color: "#F2E9D8", sizePct: 8,
  });
  const result = checkText([title], landscape, "web", 30, style);
  assert.ok(result.pass);
  assert.ok(!result.findings.some(f => f.rule.startsWith("style:")));
  const caption = { ...title, preset: "adam-curtis:caption" };
  assert.ok(checkText([caption], landscape, "web", 30, style).findings.some(f => /face outside/.test(f.message)));
});

test("researched references allow supporting statements and credits", () => {
  const style = typeSystemFor("werner-herzog")!;
  const title = applyRole(style.style, "title", landscape, "Film", 0);
  assert.ok(!checkText([title], landscape, "web", 30, style).findings.some(f => f.rule.startsWith("style:")));
  const card = { ...title, preset: "card-editorial" };
  assert.ok(!checkText([card], landscape, "web", 30, style).findings.some(f => /supporting overlay/.test(f.message)));
  const cunningham = typeSystemFor("chris-cunningham")!;
  const credit = applyRole(cunningham.style, "credit", landscape, "Artist", 0);
  assert.ok(!checkText([credit], landscape, "web", 30, cunningham).findings.some(f => /supporting overlay/.test(f.message)));
});

test("supporting casing follows its role, allowing the Burns chapter capitals", () => {
  const style = typeSystemFor("ken-burns")!;
  const card = applyRole(style.style, "card", landscape, "War", 0);
  assert.ok(!checkText([card], landscape, "web", 30, style).findings.some(f => /case|capitals/.test(f.message)));
  const lower = typeSystemFor("emma-chamberlain")!;
  const caption = { ...applyRole(lower.style, "caption", landscape, "aside", 0), text: "ASIDE" };
  assert.ok(!checkText([caption], landscape, "web", 30, lower).findings.some(f => /lower case/.test(f.message)));
});

test("film titles still receive geometric, reading-time and overlap checks", () => {
  const style = typeSystemFor("adam-curtis")!;
  const title = applyRole(style.style, "title", landscape, "A title far too long to fit within this frame", 0, { sizePct: 40, endS: 0.1 });
  const result = checkText([title, { ...title, text: "Other title" }], landscape, "web", 30, style);
  assert.equal(result.pass, false);
  assert.ok(result.findings.some(f => f.rule.includes("safe areas")));
  assert.ok(result.findings.some(f => f.rule.includes("reading time")));
  assert.ok(result.findings.some(f => f.rule.includes("one thing at a time")));
});
