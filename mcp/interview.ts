/**
 * The interview as a state machine: given the person's request and the
 * answers so far, the next question — one at a time, multiple choice, the
 * recommended option first — or the finished brief. The agent presents each
 * question through the host's question UI (Claude Code: AskUserQuestion) and
 * records the chosen value under the question id. Some questions are about
 * the subject itself (which scene, the premise, the tone); for those the tool
 * says `agentFills` and the agent writes 3–4 concrete options from what it
 * knows, still one question, still a pick.
 */
import type { Brief } from "../src/lib/validation/brief";
import { styleById, stylesFor } from "../src/lib/styles";

export type Option = { label: string; description?: string; value: string };
export type Question = {
  id: string;
  header: string;
  question: string;
  options: Option[];
  /** the agent writes the options (instructions here); `options` then holds only the fallback "Other" */
  agentFills?: string;
  multiSelect?: boolean;
  /** index of the option to mark "(Recommended)" and list first */
  recommended?: number;
};
export type Answers = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.map(String).join(", ") : v == null ? "" : String(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split(/\s*[,;]\s*|\n/).map((x) => x.trim()).filter(Boolean) : []);

function guessKind(request: string): "scene" | "standalone" {
  return /\b(scene|chapter|segment|section|part) (of|for|in)\b|\bscene\b/i.test(request) ? "scene" : "standalone";
}
function guessDurationS(request: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(minute|min|second|sec|s)\b/i.exec(request);
  if (!m) return null;
  const n = Number(m[1]);
  return /min/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
}
const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`);

/** The next question, or the brief when every needed answer is in. */
export function nextQuestion(request: string, a: Answers): { done: false; question: Question; progress: { answered: number; remaining: number } } | { done: true; brief: Brief } {
  const kind = (a.kind as string) ?? null;
  const asked = Object.keys(a).length;
  const q = (question: Question, remaining: number) => ({ done: false as const, question, progress: { answered: asked, remaining } });

  if (!kind) {
    const g = guessKind(request);
    const opts: Option[] = [
      { label: "One scene of a longer video", description: "No title, no sign-off, no closing fade; it hands off to the next scene", value: "scene" },
      { label: "A standalone piece", description: "Owns its opening and its ending", value: "standalone" },
    ];
    return q({ id: "kind", header: "Form", question: "Is this a standalone piece, or one scene of a longer video?", options: opts, recommended: g === "scene" ? 0 : 1 }, 9);
  }
  if (kind === "scene" && a.scenePart == null) {
    return q({ id: "scenePart", header: "Which scene", question: "Which part of the story is this scene?", options: [{ label: "Other", description: "describe it", value: "other" }], agentFills: "Propose 3–4 candidate scenes from the subject — each one movement with a beginning and an end that fits the length — and recommend one. Store the chosen scene as a sentence.", recommended: 0 }, 8);
  }
  if (kind === "scene" && a.context == null) {
    return q({ id: "context", header: "Context", question: "What comes right before and after this scene in the film?", options: [{ label: "Other", description: "describe it", value: "other" }], agentFills: "Propose 3 plausible placements (what the previous scene established, what the next one takes up) so this scene neither re-explains nor sums up; recommend one. Store it as a sentence.", recommended: 0 }, 7);
  }
  if (a.materials == null) {
    return q(
      {
        id: "materials",
        header: "Your material",
        question: "Do you already have a script or a shot list for this? (if so, the plan is written from it)",
        options: [
          { label: "No — write it for me", description: "the plan proposes the script and the shots", value: "none" },
          { label: "I have a script", description: "paste it next; the narration and the bites come from it verbatim", value: "script" },
          { label: "I have a shot list", description: "paste it next; the storyboard follows it, shot for shot", value: "shots" },
          { label: "Both", description: "paste both next", value: "both" },
        ],
        recommended: 0,
      },
      10,
    );
  }
  const mats = str(a.materials);
  if (mats && mats !== "none" && a.materialsText == null) {
    return q(
      {
        id: "materialsText",
        header: "Paste it",
        question: mats === "shots" ? "Paste the shot list." : mats === "both" ? "Paste the script and the shot list." : "Paste the script.",
        options: [{ label: "Other", description: "paste the text", value: "other" }],
        agentFills: "Ask the person to paste their text (the script, the shot list, or both) and record it verbatim as the answer — do not summarise or tidy it.",
      },
      9,
    );
  }
  if (a.durationS == null) {
    const g = guessDurationS(request);
    const base = g ?? (kind === "scene" ? 120 : 60);
    const cands = [...new Set([base, Math.round(base * 0.75), Math.round(base * 1.5), Math.round(base * 2)])].filter((x) => x >= 5);
    return q({ id: "durationS", header: "Length", question: "How long should it run?", options: cands.map((s, i) => ({ label: fmt(s) + (i === 0 && g ? " (as asked)" : ""), value: String(s) })), recommended: 0 }, 6);
  }
  if (a.aspect == null) {
    return q({ id: "aspect", header: "Frame", question: "Aspect ratio and resolution?", options: [{ label: "16:9 · 1080p", description: "landscape, broadcast/web", value: "16:9|1080p" }, { label: "9:16 · 1080p", description: "vertical, phone-first", value: "9:16|1080p" }, { label: "1:1 · 1080p", description: "square feed", value: "1:1|1080p" }, { label: "16:9 · 720p", description: "faster test renders", value: "16:9|720p" }], recommended: 0 }, 5);
  }
  if (a.genre == null) {
    return q({ id: "genre", header: "Genre", question: "Scripted or unscripted, and what kind of piece?", options: [{ label: "Other", value: "other" }], agentFills: "Offer 3–4 forms that fit the request (e.g. 'scripted historical documentary: narration over archival footage', 'unscripted verité from found footage', 'explainer', 'commercial'), each starting with 'scripted' or 'unscripted'; recommend one. Store the chosen label.", recommended: 0 }, 4);
  }
  if (a.style == null) {
    const fits = stylesFor(`${str(a.genre)} ${request}`);
    if (fits.length) {
      const top = fits.slice(0, 3);
      return q(
        {
          id: "style",
          header: "Style",
          question: `Whose eye? A directing style sets the cut, the narration and the sound${fits.length > 3 ? ` (${fits.length} fit this genre — list_styles shows them all; offer the three that fit the request and the tone best)` : ""}.`,
          options: [...top.map((st) => ({ label: st.name, description: st.oneLine, value: st.id })), { label: "House style", description: "no particular director — the guide's defaults for the genre", value: "none" }],
          recommended: 0,
        },
        8,
      );
    }
  }
  if (a.sources == null) {
    const doc = /document|histor|archiv|news|riot|war|election/i.test(request + " " + str(a.genre));
    return q({ id: "sources", header: "Footage", question: "Where does the footage come from? (pick all that apply)", multiSelect: true, options: [{ label: "YouTube: archival and news footage", description: "search, import ≤180 s sections", value: "youtube" }, { label: "AI-generated shots", description: doc ? "not recommended for real events — recreations mislead" : "text-to-video (Wan / Kling / Seedance)", value: "ai" }, { label: "Your own files", description: "paths or already-imported assets", value: "upload" }, { label: "Stock", value: "stock" }], recommended: 0 }, 3);
  }
  const srcs = list(a.sources);
  if (srcs.includes("youtube") && a.licence == null) {
    return q({ id: "licence", header: "Licence", question: "Any rule for the YouTube footage?", options: [{ label: "Anything usable — internal test render", value: "any" }, { label: "Archives and official channels only", description: "AP, network archives, libraries, C-SPAN", value: "archives" }, { label: "Creative Commons only", value: "cc" }], recommended: 0 }, 3);
  }
  if (a.premise == null) {
    return q({ id: "premise", header: "Premise", question: "What does the piece say — in one sentence?", options: [{ label: "Other", value: "other" }], agentFills: "Write 3 one-sentence premises for it, each a different angle (e.g. chronological account, one person's vantage, a thesis), and recommend one. Store the chosen sentence.", recommended: 0 }, 3);
  }
  if (a.tone == null) {
    return q({ id: "tone", header: "Tone", question: "What is the tone, and who is it for?", options: [{ label: "Other", value: "other" }], agentFills: "Offer 3 tone palettes (three adjectives each, plus the audience it implies, e.g. 'sober, observational, unhurried — general documentary viewers'); recommend one. Store the chosen line.", recommended: 0 }, 2);
  }
  if (a.narration == null) {
    return q({ id: "narration", header: "Narration", question: "Narration?", options: [{ label: "Sparse", description: "≈ 50 words a minute; the footage carries it", value: "sparse" }, { label: "Full", description: "≈ 100 words a minute; the narrator leads", value: "full" }, { label: "None", description: "sound bites and cards only", value: "none" }], recommended: /document|histor/i.test(str(a.genre)) ? 0 : 1 }, 2);
  }
  if (a.music == null) {
    return q({ id: "music", header: "Music", question: "Music?", options: [{ label: "A low bed", description: "sustained, no drums, out under the key sound bites", value: "bed" }, { label: "A score that drives the cut", description: "the edit sits on the beat", value: "score" }, { label: "None", value: "none" }], recommended: 0 }, 1);
  }
  if (a.text == null) {
    return q({ id: "text", header: "On-screen text", question: "On-screen text?", options: [{ label: "Lower-thirds and one card", description: "place · time per shot where it matters; one card for the key moment", value: "lower-thirds+card" }, { label: "Lower-thirds only", value: "lower-thirds" }, { label: "None", value: "none" }], recommended: 0 }, 1);
  }
  if (a.guardrails == null) {
    return q({ id: "guardrails", header: "Guardrails", question: "Anything that must be in, or must stay out? (pick all that apply)", multiSelect: true, options: [{ label: "Nothing beyond the above", value: "none" }], agentFills: "Propose 3–4 must-include moments and 2 things to avoid as separate options (prefix each with 'include:' or 'avoid:'); the person picks any. Store the picks as the list of their values.", recommended: 0 }, 0);
  }

  // Assemble the brief.
  const [aspect, resolution] = str(a.aspect).split("|") as ["16:9" | "9:16" | "1:1", "720p" | "1080p"];
  const genreLabel = str(a.genre);
  const scripted = !/^\s*unscripted/i.test(genreLabel);
  const picks = list(a.guardrails).filter((x) => x !== "none");
  const mustInclude = picks.filter((x) => /^include:/i.test(x)).map((x) => x.replace(/^include:\s*/i, ""));
  const avoid = picks.filter((x) => /^avoid:/i.test(x)).map((x) => x.replace(/^avoid:\s*/i, ""));
  const licence = str(a.licence);
  const narration = str(a.narration);
  const music = str(a.music);
  const text = str(a.text);
  const tone = str(a.tone);
  const [toneOnly, audience] = tone.includes(" — ") ? tone.split(" — ", 2) : [tone, undefined];
  const brief: Brief = {
    deliverable: {
      kind: kind as "scene" | "standalone",
      ...(kind === "scene" ? { parentContext: [str(a.scenePart), str(a.context)].filter(Boolean).join(" ") } : {}),
      durationS: Number(a.durationS),
      aspect: aspect ?? "16:9",
      resolution: resolution ?? "1080p",
    },
    production: {
      scripted,
      genre: genreLabel.replace(/^\s*(un)?scripted[:\s-]*/i, "").trim() || genreLabel,
      form: genreLabel,
      ...(styleById(str(a.style)) ? { style: { id: str(a.style) } } : {}),
    },
    sources: {
      kinds: (srcs.length ? srcs : ["youtube"]) as ("youtube" | "ai" | "upload" | "stock")[],
      ...(licence ? { notes: licence === "archives" ? "archives and official channels only" : licence === "cc" ? "Creative Commons only" : "internal test render; any usable footage" } : {}),
    },
    ...(mats && mats !== "none" && str(a.materialsText).trim() ? { materials: { kind: mats as "script" | "shots" | "both", text: str(a.materialsText).trim() } } : {}),
    premise: str(a.premise),
    tone: toneOnly.trim(),
    ...(audience ? { audience: audience.trim() } : {}),
    ...(mustInclude.length ? { mustInclude } : {}),
    ...(avoid.length ? { avoid } : {}),
    narration: { wanted: narration !== "none", ...(narration === "sparse" ? { style: "sparse, ≈50 words a minute; measured, no editorializing" } : narration === "full" ? { style: "full narration, ≈100 words a minute" } : {}) },
    music: { wanted: music !== "none", ...(music === "bed" ? { brief: "low sustained bed, no drums, drops out under the key sound bites" } : music === "score" ? { brief: "a score that drives the cut; edit on the beat" } : {}) },
    text: { wanted: text !== "none", ...(text === "lower-thirds+card" ? { style: "place · time lower-thirds; one card for the key moment" } : text === "lower-thirds" ? { style: "place · time lower-thirds only" } : {}) },
    status: "draft",
  };
  return { done: true, brief };
}
