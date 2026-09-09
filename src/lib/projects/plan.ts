/**
 * Pre-production plan logic: mechanical checks on a proposed plan against the
 * brief (guide ch.16 pacing, ch.27–29 sound, ch.37 conduct, product caps), a
 * markdown document of it for the person to approve, and a task graph an
 * orchestrator can fan out to parallel agents.
 */
import { CAPS, VIDEO_MODELS, getVideoModel } from "@/config/models";
import { styleById } from "@/lib/styles";
import type { Brief, Plan } from "@/lib/validation/brief";

export type PlanFinding = { severity: "error" | "warn" | "info"; rule: string; message: string; ref?: string };

const WPS = 2.5; // narrated words per second (guide §7 / ch.28)

/** [min, max] average shot length by genre (guide ch.16), loosely matched. */
const ASL_NORMS: [RegExp, [number, number]][] = [
  [/attack|commercial|advert|\bad\b|spot|promo|social|tiktok|reel/i, [1.5, 3.5]],
  [/trailer|teaser|sizzle/i, [1, 3]],
  [/music video|montage/i, [1, 2.5]],
  [/interview|talking head|podcast/i, [6, 20]],
  [/documentary|doc\b/i, [4, 8]],
  [/explainer|tutorial|how-to|education/i, [3, 6]],
  [/news|package|report/i, [3, 6]],
  [/comedy|sketch/i, [3, 6]],
  [/drama|narrative|short film/i, [4, 8]],
];
export function aslNorm(genre: string): [number, number] {
  for (const [re, n] of ASL_NORMS) if (re.test(genre)) return n;
  return [2, 6];
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Timeline start of every shot (main sequence = shots sorted by order). */
export function shotTimes(plan: Plan): { id: string; startS: number; endS: number }[] {
  let t = 0;
  return [...plan.shots]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const r = { id: s.id, startS: r1(t), endS: r1(t + s.durationS) };
      t += s.durationS;
      return r;
    });
}

export function checkPlan(plan: Plan, brief: Brief | null) {
  const f: PlanFinding[] = [];
  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  const times = shotTimes(plan);
  const at = new Map(times.map((t) => [t.id, t]));
  const total = r1(shots.reduce((a, s) => a + s.durationS, 0));
  const target = brief?.deliverable.durationS ?? null;
  const genre = brief?.production.genre ?? "";
  const st = brief?.production.style ? styleById(brief.production.style.id) : undefined;
  if (brief?.production.style && !st) f.push({ severity: "warn", rule: "brief: style", message: `unknown style id "${brief.production.style.id}" — list_styles has the registry` });

  // Length
  if (target != null) {
    const tol = Math.max(1, target * 0.1);
    if (Math.abs(total - target) > tol) f.push({ severity: "error", rule: "brief: length", message: `shots add up to ${total} s; the brief asks for ${target} s (±${r1(tol)} s)` });
  }
  // Pacing (ch.16)
  const asl = shots.length ? r1(total / shots.length) : 0;
  const [lo, hi] = st ? st.params.aslS : aslNorm(genre);
  if (shots.length >= 3 && (asl < lo * 0.6 || asl > hi * 1.6)) f.push({ severity: "warn", rule: st ? `style: ${st.name} pacing` : "ch16 pacing", message: `average shot ${asl} s; ${st ? `${st.name}'s cut` : genre || "this kind of piece"} usually runs ${lo}–${hi} s` });
  if (st) for (const x of shots) if (x.durationS < st.params.minShotS && x.durationS >= 0.34) f.push({ severity: "warn", rule: `style: ${st.name} shot floor`, message: `shot ${x.id} is ${x.durationS} s; ${st.name} does not cut under ${st.params.minShotS} s`, ref: x.id });
  for (const s of shots) {
    if (s.durationS < 0.34) f.push({ severity: "error", rule: "ch16 minimum readable shot ≈ 10 frames", message: `shot ${s.id} is ${s.durationS} s`, ref: s.id });
  }
  const uniform = shots.length >= 4 && shots.every((s) => Math.abs(s.durationS - shots[0].durationS) < 0.15);
  if (uniform) f.push({ severity: "warn", rule: "ch16 rhythm", message: "every shot has the same length — vary it unless the beat grid demands it" });

  // Beats
  const beatIds = new Set(plan.beats.map((b) => b.id));
  for (const s of shots) if (!beatIds.has(s.beat)) f.push({ severity: "error", rule: "plan: beats", message: `shot ${s.id} points at unknown beat ${s.beat}`, ref: s.id });
  const beats = [...plan.beats].sort((a, b) => a.startS - b.startS);
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (b.endS <= b.startS) f.push({ severity: "error", rule: "plan: beats", message: `beat ${b.id} ends before it starts` });
    if (i > 0 && Math.abs(beats[i - 1].endS - b.startS) > 0.06) f.push({ severity: "warn", rule: "plan: beats", message: `beats ${beats[i - 1].id} and ${b.id} don't meet (${beats[i - 1].endS} → ${b.startS})` });
  }
  if (beats.length && Math.abs(beats[beats.length - 1].endS - total) > 0.6) f.push({ severity: "warn", rule: "plan: beats", message: `beats end at ${beats[beats.length - 1].endS} s but the shots run ${total} s` });

  // Sources
  const clipIds = new Set(plan.clipList.map((c) => c.id));
  const aiById = new Map(plan.aiShots.map((a) => [a.shotId, a]));
  const kinds = new Set(brief?.sources.kinds ?? []);
  for (const s of shots) {
    const src = s.source;
    if (src.type === "youtube") {
      if (!src.clipId) f.push({ severity: "error", rule: "plan: sources", message: `shot ${s.id} comes from YouTube but names no clipList entry`, ref: s.id });
      else if (!clipIds.has(src.clipId)) f.push({ severity: "error", rule: "plan: sources", message: `shot ${s.id} names clip ${src.clipId}, which is not in the clip list`, ref: s.id });
      if (src.section && src.section.endS - src.section.startS > 180) f.push({ severity: "warn", rule: "import: 180 s per section", message: `shot ${s.id} wants a ${r1(src.section.endS - src.section.startS)} s section; the importer takes at most 180 s per call`, ref: s.id });
    } else if (src.type === "ai") {
      const a = aiById.get(s.id);
      if (!a && !src.prompt) f.push({ severity: "error", rule: "plan: sources", message: `AI shot ${s.id} has no prompt (aiShots entry or source.prompt)`, ref: s.id });
      const modelId = a?.model ?? src.model ?? "";
      const m = modelId ? getVideoModel(modelId) : undefined;
      if (modelId && !m) f.push({ severity: "error", rule: "plan: sources", message: `AI shot ${s.id} names unknown model ${modelId} (see list_video_models)`, ref: s.id });
      const d = a?.durationS ?? s.durationS;
      if (m && m.durationsS && !m.durationsS.includes(Math.round(d))) f.push({ severity: "warn", rule: "plan: sources", message: `AI shot ${s.id}: ${m.label} generates ${m.durationsS.join("/")} s clips, plan says ${d} s — the shot will be trimmed from the nearest length`, ref: s.id });
    } else if (src.type === "upload" && !src.assetId && !src.hint) {
      f.push({ severity: "warn", rule: "plan: sources", message: `upload shot ${s.id} names no asset or file hint`, ref: s.id });
    } else if (src.type === "card" && !s.text) {
      f.push({ severity: "warn", rule: "plan: sources", message: `card ${s.id} has no text`, ref: s.id });
    }
    if (kinds.size && src.type !== "card" && !kinds.has(src.type as "youtube")) f.push({ severity: "warn", rule: "brief: sources", message: `shot ${s.id} uses ${src.type} footage; the brief allows ${[...kinds].join(", ")}`, ref: s.id });
  }
  for (const c of plan.clipList) if (!shots.some((s) => s.source.clipId === c.id)) f.push({ severity: "info", rule: "plan: sources", message: `clip ${c.id} is in the clip list but no shot uses it` });
  const aiShots = shots.filter((s) => s.source.type === "ai");
  if (aiShots.length > CAPS.maxShots) f.push({ severity: "error", rule: `cap: ${CAPS.maxShots} AI shots per project`, message: `${aiShots.length} AI shots planned` });
  if (shots.length > CAPS.maxSegments) f.push({ severity: "error", rule: `cap: ${CAPS.maxSegments} segments`, message: `${shots.length} shots planned` });
  const aiCost = aiShots.reduce((sum, s) => {
    const a = aiById.get(s.id);
    const m = getVideoModel(a?.model ?? s.source.model ?? "") ?? VIDEO_MODELS[0];
    return sum + (a?.durationS ?? s.durationS) * m.pricePerSecondUsd;
  }, 0);
  if (aiShots.length) f.push({ severity: "info", rule: "cost", message: `${aiShots.length} AI shot(s) ≈ $${aiCost.toFixed(2)} to generate` });

  // Script and sound (ch.27–29, RULES 25–31)
  const narration = plan.script.filter((l) => l.kind === "narration" || l.kind === "dialogue");
  const est = (l: (typeof narration)[number]) => l.durationS ?? r1(words(l.text) / WPS);
  const sorted = [...narration].sort((a, b) => a.atS - b.atS);
  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i - 1];
    if (p.atS + est(p) > sorted[i].atS + 0.05) f.push({ severity: "warn", rule: "§7 one narrator at a time", message: `lines ${p.id} and ${sorted[i].id} overlap (${p.id} needs ≈${est(p)} s from ${p.atS} s)`, ref: sorted[i].id });
  }
  for (const l of narration) {
    const end = l.atS + est(l);
    const over = shots.filter((s) => s.sound === "sync" && at.get(s.id)!.startS < end && at.get(s.id)!.endS > l.atS);
    if (over.length) f.push({ severity: "warn", rule: "RULES 25/26 narration over sync sound", message: `line ${l.id} (${l.atS}–${r1(end)} s) plays over sync-sound shot(s) ${over.map((s) => s.id).join(", ")} — two voices`, ref: l.id });
    if (end > total + 0.5) f.push({ severity: "warn", rule: "§7 nothing past the picture", message: `line ${l.id} runs to ≈${r1(end)} s, past the ${total} s picture`, ref: l.id });
  }
  const nWords = narration.reduce((a, l) => a + words(l.text), 0);
  if (total > 0 && nWords / total > 2.2) f.push({ severity: "warn", rule: "ch28 density", message: `${nWords} narrated words in ${total} s (${r1(nWords / total)} w/s) — the narrator never breathes; ≤ 2 w/s averaged over the piece` });
  const cards = plan.script.filter((l) => l.kind === "text").length + shots.filter((s) => s.text).length;
  if (cards > CAPS.maxTextOverlays) f.push({ severity: "error", rule: `cap: ${CAPS.maxTextOverlays} text overlays`, message: `${cards} text cards planned` });
  const scriptIds = new Set(plan.script.map((l) => l.id));
  for (const n of plan.narration?.lines ?? []) if (!scriptIds.has(n.scriptId)) f.push({ severity: "error", rule: "plan: narration", message: `narration line ${n.scriptId} is not in the script` });
  for (const s of shots) if (s.sound === "vo" && !narration.some((l) => at.get(s.id)!.startS < l.atS + est(l) && at.get(s.id)!.endS > l.atS)) f.push({ severity: "info", rule: "plan: sound", message: `shot ${s.id} is marked "vo" but no narration line plays over it`, ref: s.id });

  // Brief expectations
  if (brief) {
    if (brief.narration?.wanted && !(plan.narration?.lines.length || narration.length)) f.push({ severity: "warn", rule: "brief: narration", message: "the brief wants narration; the plan has no narrated lines" });
    if (brief.narration && !brief.narration.wanted && narration.length) f.push({ severity: "warn", rule: "brief: narration", message: "the brief says no narration; the plan narrates" });
    if (brief.music?.wanted && !plan.music) f.push({ severity: "warn", rule: "brief: music", message: "the brief wants music; the plan names no bed" });
    if (brief.materials?.text) {
      const own = brief.materials.text.toLowerCase();
      if (brief.materials.kind !== "shots") {
        const spoken = plan.script.filter((l) => l.kind === "narration" || l.kind === "bite" || l.kind === "dialogue");
        const cover = spoken.map((l) => {
          const ws = l.text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 3);
          return ws.length ? ws.filter((w) => own.includes(w)).length / ws.length : 1;
        });
        const off = cover.filter((c) => c < 0.6).length;
        if (spoken.length && off / spoken.length > 0.4) f.push({ severity: "warn", rule: "brief: the person's own script", message: `${off} of ${spoken.length} spoken lines in the plan are not in the script the person supplied — their lines are the spine (verbatim, RULES 4); propose only what they left open, and say so in notes` });
      }
      if (brief.materials.kind !== "script") {
        const listed = brief.materials.text.split(/\r?\n/).filter((l) => /\S/.test(l)).length;
        if (listed && Math.abs(listed - shots.length) > Math.max(2, listed * 0.3)) f.push({ severity: "info", rule: "brief: the person's own shot list", message: `the shot list has ${listed} line(s); the plan has ${shots.length} shots — follow their list shot for shot unless notes say why not` });
      }
    }
    if (st) {
      const p = st.params;
      const who = st.name;
      const rule = `style: ${who}`;
      const narrated = narration.filter((l) => l.kind === "narration").length + (plan.narration?.lines.length ?? 0);
      const textCount = plan.script.filter((l) => l.kind === "text").length + shots.filter((x) => x.source.type === "card" || x.text).length;
      const syncShots = shots.filter((x) => x.sound === "sync").length;
      if (p.narration === "none" && narrated) f.push({ severity: "error", rule, message: `${who} has no narrator — the subjects and the footage carry it; move the information into bites, cards or the picture (${narrated} narration line(s) planned)` });
      if (p.narration === "required" && !narrated && p.narrationVoice !== "presenter") f.push({ severity: "warn", rule, message: `${who} is carried by narration; the plan has none` });
      if (p.narration === "required" && p.narrationVoice === "presenter" && !narrated && !syncShots) f.push({ severity: "warn", rule, message: `${who} is carried by a presenter speaking to camera; the plan has neither narration lines nor sync shots` });
      if (p.music === "none" && plan.music) f.push({ severity: "error", rule, message: `${who} uses no score; drop the music bed (or choose another style)` });
      if (p.music === "required" && !plan.music) f.push({ severity: "warn", rule, message: `${who} runs on music (${p.musicKind}); the plan names no bed` });
      if (p.text === "none" && textCount) f.push({ severity: "warn", rule, message: `${who} puts no text on screen; the plan has ${textCount} card(s) / text line(s)` });
      if (p.transitions === "cuts" && shots.some((x) => x.transition === "dissolve")) f.push({ severity: "warn", rule, message: `${who} cuts straight; ${shots.filter((x) => x.transition === "dissolve").length} dissolve(s) planned` });
      if ((p.transitions === "cuts" || p.transitions === "kinetic") && shots.slice(0, -1).some((x) => x.transition === "fadeToBlack")) f.push({ severity: "warn", rule, message: `${who} does not fade to black inside the piece` });
      if (p.sync === "sync-first" && !syncShots) f.push({ severity: "error", rule, message: `${who} is made of the shots' own sound; every shot in the plan is muted or under narration — mark the shots that keep their sound as "sync"` });
      if (p.sync === "muted" && shots.length >= 4 && syncShots > shots.length / 2) f.push({ severity: "warn", rule, message: `${who} keeps the shots' sound off under the layers; ${syncShots} of ${shots.length} shots are sync` });
      if (p.narrationWpm && narrated && total > 0) {
        const wpm = r1((nWords / total) * 60);
        const [wlo, whi] = p.narrationWpm;
        if (wpm < wlo * 0.7 || wpm > whi * 1.3) f.push({ severity: "warn", rule, message: `narration density ${wpm} words/min; ${who} sits at ${wlo}–${whi}` });
      }
      if (p.beatCut && !plan.music) f.push({ severity: "warn", rule, message: `${who} cuts on the beat; the plan needs a bed to cut to (and check_beat_alignment after the cut)` });
      if (p.stills && !shots.some((x) => /still|photo|document|map|engraving|diagram|letter|page|painting/i.test(x.description))) f.push({ severity: "info", rule, message: `${who} is built on stills that move; no shot description mentions a photograph, document or map` });
    }
    if (brief.deliverable.kind === "scene") {
      const last = shots[shots.length - 1];
      if (last?.source.type === "card") f.push({ severity: "warn", rule: "brief: scene of a longer video", message: "a scene doesn't sign off — drop the closing card" });
      if (last?.transition === "fadeToBlack") f.push({ severity: "warn", rule: "brief: scene of a longer video", message: "a scene shouldn't fade to black unless it ends a chapter (ch.20)" });
    }
    // Loose match: most of the phrase's meaningful words appear somewhere in the plan.
    const hay = JSON.stringify(plan).toLowerCase();
    for (const m of brief.mustInclude ?? []) {
      const ws = m.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !["that", "with", "this", "from", "into", "over", "being", "read", "their", "there"].includes(w));
      const hit = ws.filter((w) => hay.includes(w)).length;
      if (ws.length && hit / ws.length < 0.6) f.push({ severity: "warn", rule: "brief: must include", message: `little in the plan matches "${m}" (${hit}/${ws.length} of its words appear)` });
    }
  }

  const errors = f.filter((x) => x.severity === "error").length;
  return {
    pass: errors === 0,
    findings: f,
    summary: {
      totalS: total,
      targetS: target,
      shots: shots.length,
      averageShotS: asl,
      aslNorm: [lo, hi] as [number, number],
      beats: plan.beats.length,
      narratedWords: nWords,
      narrationLines: narration.length,
      clips: plan.clipList.length,
      aiShots: aiShots.length,
      aiCostUsd: +aiCost.toFixed(2),
      cards,
    },
  };
}

const fmtT = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const esc = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The plan as a document the person can read and approve. */
export function planDocument(plan: Plan, brief: Brief | null, title: string): string {
  const times = shotTimes(plan);
  const at = new Map(times.map((t) => [t.id, t]));
  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  const clips = new Map(plan.clipList.map((c) => [c.id, c]));
  const ai = new Map(plan.aiShots.map((a) => [a.shotId, a]));
  const src = (s: (typeof shots)[number]) => {
    const x = s.source;
    if (x.type === "youtube") return `YouTube · ${x.clipId ?? "?"}${x.section ? ` ${fmtT(x.section.startS)}–${fmtT(x.section.endS)}` : ""}${clips.get(x.clipId ?? "") ? ` (${clips.get(x.clipId!)!.need})` : ""}`;
    if (x.type === "ai") return `AI · ${ai.get(s.id)?.model ?? x.model ?? "default model"}`;
    if (x.type === "card") return "title card";
    return `${x.type}${x.assetId ? ` · ${x.assetId}` : x.hint ? ` · ${x.hint}` : ""}`;
  };
  const L: string[] = [];
  L.push(`# ${title} — plan v${plan.version} (${plan.status})`, "");
  L.push(`**Logline.** ${plan.logline}`, "");
  if (brief?.production.style) {
    const stl = styleById(brief.production.style.id);
    L.push(`**Style.** ${stl ? `${stl.name} — ${stl.oneLine}` : brief.production.style.id}${brief.production.style.notes ? ` (${brief.production.style.notes})` : ""}`, "");
  }
  if (brief?.materials) L.push(`**Material.** The person's own ${brief.materials.kind === "both" ? "script and shot list" : brief.materials.kind === "shots" ? "shot list" : "script"} (${brief.materials.text.trim().split(/\s+/).length} words) — the plan follows it.`, "");
  if (brief) {
    L.push(
      `**Brief.** ${brief.deliverable.kind === "scene" ? "A scene of a longer video" : "A standalone piece"}, ${brief.deliverable.durationS} s, ${brief.deliverable.aspect} ${brief.deliverable.resolution}. ` +
        `${brief.production.scripted ? "Scripted" : "Unscripted"} ${brief.production.genre}${brief.production.form ? ` (${brief.production.form})` : ""}. Sources: ${brief.sources.kinds.join(", ")}. Tone: ${brief.tone}.` +
        (brief.audience ? ` Audience: ${brief.audience}.` : ""),
      "",
      `**Premise.** ${brief.premise}`,
      "",
    );
  }
  L.push("## Beats", "", "| # | beat | time | purpose |", "|---|---|---|---|");
  [...plan.beats].sort((a, b) => a.startS - b.startS).forEach((b, i) => L.push(`| ${i + 1} | ${esc(b.title)} | ${fmtT(b.startS)}–${fmtT(b.endS)} | ${esc(b.purpose ?? "")} |`));
  L.push("", "## Storyboard", "", "| # | at | len | shot | source | sound | text / transition |", "|---|---|---|---|---|---|---|");
  shots.forEach((s, i) => {
    const t = at.get(s.id)!;
    const extra = [s.text ? `"${esc(s.text)}"` : "", s.transition !== "cut" ? s.transition : ""].filter(Boolean).join(" · ");
    L.push(`| ${i + 1} | ${fmtT(t.startS)} | ${s.durationS} s | ${esc(s.description)} | ${esc(src(s))} | ${s.sound} | ${extra} |`);
  });
  if (plan.script.length) {
    L.push("", "## Script", "", "| at | kind | line |", "|---|---|---|");
    [...plan.script].sort((a, b) => a.atS - b.atS).forEach((l) => L.push(`| ${fmtT(l.atS)} | ${l.kind} | ${esc(l.text)}${l.note ? ` _(${esc(l.note)})_` : ""} |`));
  }
  if (plan.clipList.length) {
    L.push("", "## Clips to find", "", "| id | need | search | wanted |", "|---|---|---|---|");
    for (const c of plan.clipList) L.push(`| ${c.id} | ${esc(c.need)} | ${c.queries.map((q) => `"${esc(q)}"`).join(", ")}${c.preferredChannels?.length ? ` (prefer ${c.preferredChannels.join(", ")})` : ""} | ${esc(c.wantedSection ?? "")}${c.durationHintS ? ` ~${c.durationHintS} s` : ""} |`);
  }
  if (plan.aiShots.length) {
    L.push("", "## AI shots", "", "| shot | model | len | prompt |", "|---|---|---|---|");
    for (const a of plan.aiShots) L.push(`| ${a.shotId} | ${a.model ?? "default"} | ${a.durationS} s | ${esc(a.prompt)}${a.negative ? ` — avoid: ${esc(a.negative)}` : ""} |`);
  }
  if (plan.music) L.push("", "## Music", "", `${plan.music.brief}${plan.music.queries.length ? ` — search: ${plan.music.queries.map((q) => `"${q}"`).join(", ")}` : ""}`);
  if (plan.narration) L.push("", "## Narration", "", `Voice: ${plan.narration.voice ?? "default"}${plan.narration.style ? ` — ${plan.narration.style}` : ""}. ${plan.narration.lines.length} line(s).`);
  if (plan.risks.length) L.push("", "## Risks", "", ...plan.risks.map((r) => `- ${r}`));
  if (plan.notes) L.push("", "## Notes", "", plan.notes);
  return L.join("\n") + "\n";
}

const pad = (t: string, n: number) => (t.length >= n ? t : t + " ".repeat(n - t.length));
const wrap = (t: string, width: number, first: string, rest = " ".repeat(first.length)): string[] => {
  const out: string[] = [];
  let prefix = first;
  for (const para of t.split(/\n/)) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if ((line + " " + w).trim().length > width && line) {
        out.push(prefix + line);
        prefix = rest;
        line = w;
      } else line = (line ? line + " " : "") + w;
    }
    out.push(prefix + line);
    prefix = rest;
  }
  return out;
};

/**
 * The plan for a terminal: the script and the storyboard as one time-ordered
 * list (each shot with its source, card and the lines that play over it),
 * then the clip list, AI shots, music, narration and risks. No tables, ~96
 * columns, meant to be shown to the person verbatim.
 */
export function planCli(plan: Plan, brief: Brief | null, title: string): string {
  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  const times = shotTimes(plan);
  const at = new Map(times.map((t) => [t.id, t]));
  const clips = new Map(plan.clipList.map((c) => [c.id, c]));
  const ai = new Map(plan.aiShots.map((a) => [a.shotId, a]));
  const L: string[] = [];
  L.push(`${title}  ·  plan v${plan.version} (${plan.status})`);
  L.push(...wrap(plan.logline, 86, "Logline   "));
  if (brief) {
    const d = brief.deliverable;
    L.push(`Brief     ${d.kind === "scene" ? "scene of a longer video" : "standalone"} · ${d.durationS} s · ${d.aspect} ${d.resolution} · ${brief.production.scripted ? "scripted" : "unscripted"} ${brief.production.genre}${brief.production.form ? ` (${brief.production.form})` : ""}`);
    L.push(`          sources: ${brief.sources.kinds.join(", ")} · tone: ${brief.tone}${brief.audience ? ` · audience: ${brief.audience}` : ""}`);
    if (d.kind === "scene" && d.parentContext) L.push(...wrap(d.parentContext, 86, "          context: "));
    if (brief.production.style) {
      const stl = styleById(brief.production.style.id);
      L.push(...wrap(stl ? `${stl.name} — ${stl.oneLine}` : brief.production.style.id, 86, "Style     "));
    }
    if (brief.materials) L.push(...wrap(`the person's own ${brief.materials.kind === "both" ? "script and shot list" : brief.materials.kind === "shots" ? "shot list" : "script"} (${brief.materials.text.trim().split(/\s+/).length} words) — the plan follows it`, 86, "Material  "));
    L.push(...wrap(brief.premise, 86, "Premise   "));
  }
  L.push("", "BEATS");
  for (const b of [...plan.beats].sort((a, c) => a.startS - c.startS)) L.push(`  ${fmtT(b.startS)}–${fmtT(b.endS)}  ${pad(b.title, 14)} ${b.purpose ?? ""}`.trimEnd());
  L.push("", "SCRIPT + STORYBOARD", `  ${pad("#", 3)} ${pad("at", 6)} ${pad("len", 5)} ${pad("sound", 6)} picture`);
  const placed = new Set<string>();
  const srcOf = (sh: (typeof shots)[number]) => {
    const x = sh.source;
    if (x.type === "youtube") return `YouTube ${x.clipId ?? "?"}${x.section ? ` ${fmtT(x.section.startS)}–${fmtT(x.section.endS)}` : ""}${clips.get(x.clipId ?? "") ? ` — ${clips.get(x.clipId!)!.need}` : ""}`;
    if (x.type === "ai") return `AI · ${ai.get(sh.id)?.model ?? x.model ?? "default model"}${ai.get(sh.id) ? ` — "${ai.get(sh.id)!.prompt}"` : x.prompt ? ` — "${x.prompt}"` : ""}`;
    if (x.type === "card") return "title card";
    return `${x.type}${x.assetId ? ` ${x.assetId}` : x.hint ? ` ${x.hint}` : ""}`;
  };
  shots.forEach((sh, i) => {
    const t = at.get(sh.id)!;
    L.push(...wrap(sh.description, 70, `  ${pad(String(i + 1), 3)} ${pad(fmtT(t.startS), 6)} ${pad(`${sh.durationS}s`, 5)} ${pad(sh.sound, 6)} `, "                         "));
    L.push(...wrap(srcOf(sh), 70, "                         src: "));
    if (sh.text) L.push(`                         CARD "${sh.text.replace(/\n/g, " / ")}"`);
    if (sh.transition && sh.transition !== "cut") L.push(`                         → ${sh.transition}`);
    const lines = plan.script.filter((l) => !placed.has(l.id) && l.atS >= t.startS - 0.05 && l.atS < t.endS - 0.05 && !(l.kind === "text" && sh.text === l.text)).sort((a, b) => a.atS - b.atS);
    for (const l of lines) {
      placed.add(l.id);
      const tag = l.kind === "narration" ? "VO  " : l.kind === "bite" ? "BITE" : l.kind === "text" ? "CARD" : "DIAL";
      L.push(...wrap(`"${l.text}"${l.note ? ` (${l.note})` : ""}`, 62, `                  ${pad(fmtT(l.atS), 6)} ${tag} `));
    }
  });
  const unplaced = plan.script.filter((l) => !placed.has(l.id) && !shots.some((sh) => sh.text === l.text));
  if (unplaced.length) {
    L.push("  lines outside the picture:");
    for (const l of unplaced) L.push(`                  ${pad(fmtT(l.atS), 6)} ${l.kind.toUpperCase().slice(0, 4)} "${l.text}"`);
  }
  if (plan.clipList.length) {
    L.push("", "CLIPS TO FIND");
    for (const c of plan.clipList) {
      L.push(...wrap(c.need, 80, `  ${pad(c.id, 12)} `));
      L.push(`               search: ${c.queries.map((q) => `"${q}"`).join(", ")}${c.preferredChannels?.length ? ` · prefer ${c.preferredChannels.join(", ")}` : ""}`);
      if (c.wantedSection || c.durationHintS) L.push(`               wanted: ${c.wantedSection ?? ""}${c.durationHintS ? ` (~${c.durationHintS} s video)` : ""}`.trimEnd());
    }
  }
  if (plan.aiShots.length) {
    L.push("", "AI SHOTS");
    for (const a of plan.aiShots) L.push(...wrap(`${a.model ?? "default"} · ${a.durationS} s · "${a.prompt}"${a.negative ? ` · avoid: ${a.negative}` : ""}`, 80, `  ${pad(a.shotId, 6)} `));
  }
  if (plan.music) L.push("", "MUSIC", ...wrap(`${plan.music.brief}${plan.music.queries.length ? ` · search: ${plan.music.queries.map((q) => `"${q}"`).join(", ")}` : ""}`, 90, "  "));
  if (plan.narration) L.push("", "NARRATION", `  voice: ${plan.narration.voice ?? "default"}${plan.narration.style ? ` · ${plan.narration.style}` : ""} · ${plan.narration.lines.length} line(s)`);
  if (plan.risks.length) L.push("", "RISKS", ...plan.risks.map((r) => `  - ${r}`));
  if (plan.notes) L.push("", "NOTES", ...wrap(plan.notes, 90, "  "));
  return L.join("\n") + "\n";
}

/** Box-drawing table with word-wrapped cells (widths = inner text widths). */
function table(headers: string[], rows: string[][], widths: number[]): string[] {
  const cellLines = (text: string, w: number): string[] => {
    const out: string[] = [];
    for (const para of text.split(/\n/)) {
      let line = "";
      for (let word of para.split(/\s+/).filter(Boolean)) {
        while (word.length > w) {
          if (line) {
            out.push(line);
            line = "";
          }
          out.push(word.slice(0, w));
          word = word.slice(w);
        }
        if ((line + " " + word).trim().length > w && line) {
          out.push(line);
          line = word;
        } else line = (line ? line + " " : "") + word;
      }
      out.push(line);
    }
    return out.length ? out : [""];
  };
  const bar = (l: string, m: string, r: string) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
  const row = (cells: string[]): string[] => {
    const wrapped = cells.map((c, i) => cellLines(c, widths[i]));
    const h = Math.max(...wrapped.map((c) => c.length));
    const lines: string[] = [];
    for (let k = 0; k < h; k++) lines.push("│" + wrapped.map((c, i) => " " + pad(c[k] ?? "", widths[i]) + " ").join("│") + "│");
    return lines;
  };
  const L = [bar("┌", "┬", "┐"), ...row(headers), bar("├", "┼", "┤")];
  rows.forEach((r, i) => {
    L.push(...row(r));
    if (i < rows.length - 1) L.push(bar("├", "┼", "┤"));
  });
  L.push(bar("└", "┴", "┘"));
  return L;
}

/**
 * The plan as terminal tables: a two-column AV script (VIDEO | AUDIO, one row
 * per shot: picture, source, card on the left; the narration and bite lines
 * that play over it on the right), then beats, clips to find, AI shots.
 * `width` = total columns (≥ 80).
 */
export function planTable(plan: Plan, brief: Brief | null, title: string, width = 110): string {
  const W = Math.max(80, Math.min(200, Math.floor(width)));
  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  const times = shotTimes(plan);
  const at = new Map(times.map((t) => [t.id, t]));
  const clips = new Map(plan.clipList.map((c) => [c.id, c]));
  const ai = new Map(plan.aiShots.map((a) => [a.shotId, a]));
  const L: string[] = [];
  L.push(`${title}  ·  plan v${plan.version} (${plan.status})`);
  L.push(...wrap(plan.logline, W - 10, "Logline   "));
  if (brief) {
    const d = brief.deliverable;
    L.push(`Brief     ${d.kind === "scene" ? "scene of a longer video" : "standalone"} · ${d.durationS} s · ${d.aspect} ${d.resolution} · ${brief.production.scripted ? "scripted" : "unscripted"} ${brief.production.genre}${brief.production.form ? ` (${brief.production.form})` : ""}`);
    L.push(...wrap(`sources: ${brief.sources.kinds.join(", ")} · tone: ${brief.tone}${brief.audience ? ` · audience: ${brief.audience}` : ""}`, W - 10, "          "));
    if (brief.production.style) {
      const stl = styleById(brief.production.style.id);
      L.push(...wrap(stl ? `${stl.name} — ${stl.oneLine}` : brief.production.style.id, W - 10, "Style     "));
    }
    if (brief.materials) L.push(...wrap(`the person's own ${brief.materials.kind === "both" ? "script and shot list" : brief.materials.kind === "shots" ? "shot list" : "script"} (${brief.materials.text.trim().split(/\s+/).length} words) — the plan follows it`, W - 10, "Material  "));
    L.push(...wrap(brief.premise, W - 10, "Premise   "));
  }
  L.push("", "BEATS");
  L.push(...table(["#", "time", "beat", "purpose"], [...plan.beats].sort((a, b) => a.startS - b.startS).map((b, i) => [String(i + 1), `${fmtT(b.startS)}–${fmtT(b.endS)}`, b.title, b.purpose ?? ""]), [2, 13, 16, W - 2 - 13 - 16 - 13]));
  L.push("", "SCRIPT + STORYBOARD");
  const fixed = [2, 6, 4, 5];
  const rest = W - fixed.reduce((a, b) => a + b + 2, 0) - 7 - 4; // 2 pad per remaining col
  const vidW = Math.ceil(rest / 2);
  const audW = rest - vidW;
  const placed = new Set<string>();
  const rows: string[][] = shots.map((sh, i) => {
    const t = at.get(sh.id)!;
    const x = sh.source;
    const src =
      x.type === "youtube"
        ? `src: YouTube ${x.clipId ?? "?"}${x.section ? ` ${fmtT(x.section.startS)}–${fmtT(x.section.endS)}` : ""}${clips.has(x.clipId ?? "") ? "" : " (not in the clip list)"}`
        : x.type === "ai"
          ? `src: AI ${ai.get(sh.id)?.model ?? x.model ?? "default model"}${ai.has(sh.id) ? "" : x.prompt ? ` — "${x.prompt}"` : ""}`
          : x.type === "card"
            ? "src: title card"
            : `src: ${x.type}${x.assetId ? ` ${x.assetId}` : x.hint ? ` ${x.hint}` : ""}`;
    const video = [sh.description, src, sh.text ? `CARD "${sh.text.replace(/\n/g, " / ")}"` : "", sh.transition && sh.transition !== "cut" ? `→ ${sh.transition}` : ""].filter(Boolean).join("\n");
    const lines = plan.script.filter((l) => !placed.has(l.id) && l.atS >= t.startS - 0.05 && l.atS < t.endS - 0.05 && !(l.kind === "text" && sh.text === l.text)).sort((a, b) => a.atS - b.atS);
    const audio = lines
      .map((l) => {
        placed.add(l.id);
        const tag = l.kind === "narration" ? "VO" : l.kind === "bite" ? "BITE" : l.kind === "text" ? "CARD" : "DIAL";
        return `${fmtT(l.atS)} ${tag} "${l.text}"${l.note ? ` (${l.note})` : ""}`;
      })
      .join("\n");
    return [String(i + 1), fmtT(t.startS), `${sh.durationS}s`, sh.sound, video, audio || (sh.sound === "muted" ? "(music bed)" : sh.sound === "sync" ? "(the shot's own sound)" : "")];
  });
  L.push(...table(["#", "at", "len", "sound", "VIDEO", "AUDIO"], rows, [...fixed, vidW, audW]));
  const unplaced = plan.script.filter((l) => !placed.has(l.id) && !shots.some((sh) => sh.text === l.text));
  if (unplaced.length) L.push("  lines outside the picture: " + unplaced.map((l) => `${fmtT(l.atS)} ${l.kind} "${l.text}"`).join(" · "));
  if (plan.clipList.length) {
    L.push("", "CLIPS TO FIND");
    const idW = Math.min(14, Math.max(4, ...plan.clipList.map((c) => c.id.length)));
    const r = W - idW - 13;
    const needW = Math.floor(r * 0.36);
    const searchW = Math.floor(r * 0.34);
    L.push(...table(["id", "need", "search", "wanted"], plan.clipList.map((c) => [c.id, c.need, `${c.queries.map((q) => `"${q}"`).join(", ")}${c.preferredChannels?.length ? `\nprefer ${c.preferredChannels.join(", ")}` : ""}`, `${c.wantedSection ?? ""}${c.durationHintS ? `\n(~${c.durationHintS} s video)` : ""}`]), [idW, needW, searchW, r - needW - searchW]));
  }
  if (plan.aiShots.length) {
    L.push("", "AI SHOTS");
    L.push(...table(["shot", "model", "len", "prompt"], plan.aiShots.map((a) => [a.shotId, a.model ?? "default", `${a.durationS}s`, `${a.prompt}${a.negative ? `\navoid: ${a.negative}` : ""}`]), [6, 24, 4, W - 6 - 24 - 4 - 13]));
  }
  if (plan.music) L.push("", "MUSIC", ...wrap(`${plan.music.brief}${plan.music.queries.length ? ` · search: ${plan.music.queries.map((q) => `"${q}"`).join(", ")}` : ""}`, W - 2, "  "));
  if (plan.narration) L.push("", "NARRATION", `  voice: ${plan.narration.voice ?? "default"}${plan.narration.style ? ` · ${plan.narration.style}` : ""} · ${plan.narration.lines.length} line(s)`);
  if (plan.risks.length) L.push("", "RISKS", ...plan.risks.flatMap((r) => wrap(r, W - 4, "  - ")));
  if (plan.notes) L.push("", "NOTES", ...wrap(plan.notes, W - 2, "  "));
  return L.join("\n") + "\n";
}

export type PlanTask = { id: string; kind: "source" | "ai" | "narration" | "music" | "assemble" | "titles" | "checks" | "draft" | "final"; deps: string[]; spec: Record<string, unknown> };

/** The plan as a dependency graph: everything without deps can run at once. */
export function planTasks(plan: Plan): { tasks: PlanTask[]; parallelNow: string[] } {
  const tasks: PlanTask[] = [];
  const shots = [...plan.shots].sort((a, b) => a.order - b.order);
  for (const c of plan.clipList) {
    const uses = shots.filter((s) => s.source.clipId === c.id).map((s) => ({ shotId: s.id, durationS: s.durationS, section: s.source.section ?? null, description: s.description, sound: s.sound }));
    tasks.push({ id: `source:${c.id}`, kind: "source", deps: [], spec: { ...c, uses } });
  }
  for (const a of plan.aiShots) tasks.push({ id: `ai:${a.shotId}`, kind: "ai", deps: [], spec: a });
  if (plan.narration?.lines.length) {
    const byId = new Map(plan.script.map((l) => [l.id, l]));
    tasks.push({ id: "narration", kind: "narration", deps: [], spec: { voice: plan.narration.voice ?? null, style: plan.narration.style ?? null, lines: plan.narration.lines.map((n) => ({ ...n, atS: byId.get(n.scriptId)?.atS ?? null })) } });
  }
  if (plan.music) tasks.push({ id: "music", kind: "music", deps: [], spec: plan.music });
  const gather = tasks.map((t) => t.id);
  tasks.push({ id: "assemble", kind: "assemble", deps: gather, spec: { shots: shots.map((s) => ({ id: s.id, order: s.order, durationS: s.durationS, source: s.source, sound: s.sound, transition: s.transition })) } });
  tasks.push({ id: "titles", kind: "titles", deps: ["assemble"], spec: { cards: [...shots.filter((s) => s.text).map((s) => ({ shotId: s.id, text: s.text })), ...plan.script.filter((l) => l.kind === "text").map((l) => ({ atS: l.atS, durationS: l.durationS ?? null, text: l.text }))] } });
  tasks.push({ id: "checks", kind: "checks", deps: ["titles"], spec: { tools: ["check_soundtrack", "check_cuts", "pacing_report", "balance_music"] } });
  tasks.push({ id: "draft", kind: "draft", deps: ["checks"], spec: { tools: ["render_draft", "verify_export", "check_mix_levels", "storyboard_sheet"] } });
  tasks.push({ id: "final", kind: "final", deps: ["draft"], spec: { tools: ["render_final", "verify_export"] } });
  return { tasks, parallelNow: tasks.filter((t) => !t.deps.length).map((t) => t.id) };
}
