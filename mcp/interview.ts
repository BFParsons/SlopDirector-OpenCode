/**
 * Shared interview questions and brief assembly. Batch mode gathers every
 * currently applicable unanswered question in one call for local, sequential
 * presentation; the single-question wrapper supports clients without a queue.
 */
import type { Brief } from "../src/lib/validation/brief";
import { styleById, stylesFor } from "../src/lib/styles";

export type Option = { label: string; description?: string; value: string };
export type Question = {
  id: string;
  header: string;
  question: string;
  options: Option[];
  /** Cached style menus: select by genre value locally after the clip-type reply. */
  optionsByGenre?: Record<string, Option[]>;
  /** Guidance for collecting free text or offering context-specific examples. */
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

const CLIP_TYPES: Option[] = [
  { label: "Documentary", value: "scripted documentary" },
  { label: "Trailer", value: "scripted trailer" },
  { label: "Short movie", value: "scripted short film" },
  { label: "Commercial", value: "scripted commercial" },
];

// Deliberate contrasts within each format, rather than the registry's first matches.
const STYLE_MENUS = [
  { genre: "scripted trailer", match: /trailer|teaser/i, ids: ["mark-woollen", "av-squad", "a24"] },
  { genre: "scripted political attack ad", match: /political.*ad|attack ad|campaign|propaganda/i, ids: ["lincoln-project", "tony-schwartz", "frank-capra"] },
  { genre: "scripted commercial", match: /commercial|advert|\bad\b|brand|promo|\bspot\b/i, ids: ["ridley-scott", "spike-jonze", "jonathan-glazer"] },
  { genre: "unscripted observational documentary", match: /observational|verit|interview/i, ids: ["frederick-wiseman", "errol-morris", "werner-herzog"] },
  { genre: "scripted documentary", match: /document|histor|archiv/i, ids: ["adam-curtis", "ken-burns", "werner-herzog"] },
  { genre: "scripted explainer", match: /explainer|essay|education|tutorial/i, ids: ["johnny-harris", "tony-zhou", "veritasium"] },
  { genre: "scripted music video", match: /music video/i, ids: ["michel-gondry", "hype-williams", "anton-corbijn"] },
  { genre: "scripted montage", match: /montage/i, ids: ["edgar-wright", "sergei-eisenstein", "peter-mckinnon"] },
  { genre: "scripted short film", match: /short (film|movie)|drama|fiction|movie/i, ids: ["wes-anderson", "christopher-nolan", "denis-villeneuve"] },
];

function styleOptions(genre: string): Option[] {
  const menu = STYLE_MENUS.find((entry) => entry.match.test(genre));
  const fits = menu ? menu.ids.map((id) => styleById(id)!) : stylesFor(genre).slice(0, 3);
  const suggestions = fits.length ? fits : ["adam-curtis", "wes-anderson", "ridley-scott"].map((id) => styleById(id)!);
  return [
    ...suggestions.map((st) => ({ label: st.name, description: st.oneLine, value: st.id })),
    { label: "House style", description: "A look suited to this piece, without a particular director", value: "none" },
  ];
}

type InterviewResult = { done: false; questions: Question[]; progress: { answered: number; remaining: number } } | { done: true; brief: Brief };

/** All applicable unanswered questions, or the completed brief. No answers are inferred. */
export function interviewBatch(request: string, a: Answers): InterviewResult {
  const kind = (a.kind as string) ?? null;
  const asked = Object.values(a).filter((value) => value != null).length;
  const questions: Question[] = [];
  const q = (question: Question) => { questions.push(question); };

  if (!kind) {
    const g = guessKind(request);
    const opts: Option[] = [
      { label: "One scene of a longer video", description: "No title, no sign-off, no closing fade; it hands off to the next scene", value: "scene" },
      { label: "A standalone piece", description: "Owns its opening and its ending", value: "standalone" },
    ];
    q({ id: "kind", header: "Form", question: "Is this a standalone piece, or one scene of a longer video?", options: opts, recommended: g === "scene" ? 0 : 1 });
  }
  if (kind === "scene" && a.scenePart == null) {
    q({ id: "scenePart", header: "Which scene", question: "Which part of the story is this scene?", options: [{ label: "Other", description: "describe it", value: "other" }], agentFills: "Collect which scene the person wants, with a brief example if helpful. Store it as a sentence.", recommended: 0 });
  }
  if (kind === "scene" && a.context == null) {
    q({ id: "context", header: "Context", question: "What comes right before and after this scene in the film?", options: [{ label: "Other", description: "describe it", value: "other" }], agentFills: "Collect what the previous scene established and what the next one takes up. Store the placement as a sentence.", recommended: 0 });
  }
  if (a.genre == null) {
    q({ id: "genre", header: "Clip type", question: "What type of clip are we making?", options: CLIP_TYPES });
  }
  if (a.style == null) {
    q({
      id: "style", header: "Director", question: "Which director or studio style should guide it?",
      options: styleOptions(str(a.genre) || request),
      ...(a.genre == null ? { optionsByGenre: Object.fromEntries(STYLE_MENUS.map(({ genre }) => [genre, styleOptions(genre)])) } : {}),
      agentFills: "Immediately after clip type, use optionsByGenre[answers.genre] from this cached question. For a custom clip type, use the closest cached genre menu; otherwise use options. Offer three named styles with their short descriptions plus House style, within the host's option limit. Accept another director or film via free text. Skip if a style was already supplied. No style lookup or research between these questions.",
    });
  }
  if (a.materials == null) {
    q(
      {
        id: "materials",
        header: "Your material",
        question: "Do you already have a script or a shot list for this? (if so, the plan is written from it)",
        options: [
          { label: "No — write it for me", description: "the plan proposes the script and the shots", value: "none" },
          { label: "I have a script", description: "include it in your reply; the narration and the bites come from it verbatim", value: "script" },
          { label: "I have a shot list", description: "include it in your reply; the storyboard follows it, shot for shot", value: "shots" },
          { label: "Both", description: "include both in your reply", value: "both" },
        ],
        recommended: 0,
      },
    );
  }
  const mats = str(a.materials);
  if (mats && mats !== "none" && a.materialsText == null) {
    q(
      {
        id: "materialsText",
        header: "Paste it",
        question: mats === "shots" ? "Paste the shot list." : mats === "both" ? "Paste the script and the shot list." : "Paste the script.",
        options: [{ label: "Other", description: "paste the text", value: "other" }],
        agentFills: "Ask the person to paste their text (the script, the shot list, or both) and record it verbatim as the answer — do not summarise or tidy it.",
      },
    );
  }
  if (a.durationS == null) {
    const g = guessDurationS(request);
    const base = g ?? (kind === "scene" ? 120 : 60);
    const cands = [...new Set([base, Math.round(base * 0.75), Math.round(base * 1.5), Math.round(base * 2)])].filter((x) => x >= 5);
    q({ id: "durationS", header: "Length", question: "How long should it run?", options: cands.map((s, i) => ({ label: fmt(s) + (i === 0 && g ? " (as asked)" : ""), value: String(s) })), recommended: 0 });
  }
  if (a.aspect == null) {
    q({ id: "aspect", header: "Frame", question: "Aspect ratio and resolution?", options: [{ label: "16:9 · 1080p", description: "landscape, broadcast/web", value: "16:9|1080p" }, { label: "9:16 · 1080p", description: "vertical, phone-first", value: "9:16|1080p" }, { label: "1:1 · 1080p", description: "square feed", value: "1:1|1080p" }, { label: "16:9 · 720p", description: "faster test renders", value: "16:9|720p" }], recommended: 0 });
  }
  if (a.sources == null) {
    const doc = /document|histor|archiv|news|riot|war|election/i.test(request + " " + str(a.genre));
    q({ id: "sources", header: "Footage", question: "Where does the footage come from? (pick all that apply)", multiSelect: true, options: [{ label: "YouTube: archival and news footage", description: "search, import ≤180 s sections", value: "youtube" }, { label: "AI-generated shots", description: doc ? "not recommended for real events — recreations mislead" : "text-to-video (Wan / Kling / Seedance)", value: "ai" }, { label: "Your own files", description: "paths or already-imported assets", value: "upload" }, { label: "Stock", value: "stock" }], recommended: 0 });
  }
  const srcs = list(a.sources);
  if (srcs.includes("youtube") && a.licence == null) {
    q({ id: "licence", header: "Licence", question: "Any rule for the YouTube footage?", options: [{ label: "Anything usable — internal test render", value: "any" }, { label: "Archives and official channels only", description: "AP, network archives, libraries, C-SPAN", value: "archives" }, { label: "Creative Commons only", value: "cc" }], recommended: 0 });
  }
  if (a.premise == null) {
    q({ id: "premise", header: "Premise", question: "What does the piece say — in one sentence?", options: [{ label: "Other", value: "other" }], agentFills: "Collect the subject, angle and what viewers should take away. Store the premise as a sentence, proposing an angle only if the person delegates it.", recommended: 0 });
  }
  if (a.tone == null) {
    q({ id: "tone", header: "Tone", question: "What tone should it have?", options: [
      { label: "Intense and provocative", value: "intense, provocative, questioning" },
      { label: "Calm and reflective", value: "calm, reflective, measured" },
      { label: "Clear and informative", value: "clear, informative, accessible" },
      { label: "Playful and upbeat", value: "playful, upbeat, lighthearted" },
    ] });
  }
  if (a.audience == null && !str(a.tone).includes(" — ")) {
    q({ id: "audience", header: "Audience", question: "Who is this for?", options: [
      { label: "General viewers", value: "general viewers" },
      { label: "People new to the subject", value: "people new to the subject" },
      { label: "An informed / specialist audience", value: "an informed or specialist audience" },
    ], recommended: 0 });
  }
  if (a.narration == null) {
    q({ id: "narration", header: "Narration", question: "Narration?", options: [{ label: "Sparse", description: "≈ 50 words a minute; the footage carries it", value: "sparse" }, { label: "Full", description: "≈ 100 words a minute; the narrator leads", value: "full" }, { label: "None", description: "sound bites and cards only", value: "none" }], recommended: /document|histor/i.test(str(a.genre)) ? 0 : 1 });
  }
  if (a.music == null) {
    q({ id: "music", header: "Music", question: "What role should music play?", options: [{ label: "A low bed", description: "understated music beneath narration or source sound", value: "bed" }, { label: "A score that drives the cut", description: "music shapes the pacing and changes at story turns", value: "score" }, { label: "None", value: "none" }], recommended: 0 });
  }
  const music = str(a.music);
  const musicSelection = str(a.musicSelection);
  const musicReference = str(a.musicReference);
  if (["bed", "score"].includes(music) && !musicSelection.trim() && !musicReference.trim()) {
    q({
      id: "musicSelection", header: "Music choice", question: "How should we choose the music?",
      options: [
        { label: "Choose for me", description: "select music to suit the directing style and story", value: "choose" },
        { label: "Use a film soundtrack", description: "choose music featured in a film or series I name", value: "soundtrack" },
        { label: "I'll name tracks", description: "use specific artists, songs, links or local files", value: "tracks" },
      ],
      recommended: 0,
      agentFills: "Accept a custom musical direction via free text. If the person already named music, store that wording in musicReference and skip this question. Explicit 'you choose' maps to musicSelection=choose; it is not an automatic default. Research recordings after the interview, not between questions.",
    });
  }
  if (music && music !== "none" && ["soundtrack", "tracks"].includes(musicSelection) && !musicReference.trim()) {
    q({
      id: "musicReference", header: "Which music",
      question: musicSelection === "soundtrack" ? "Which film or series soundtrack should we draw from?" : "Which artists, tracks, links or local files should we use?",
      options: [],
      agentFills: "Collect the reference as free text in musicReference, preserving names, links, file paths and any cue preferences verbatim. A soundtrack name selects its music, not its directing style. Reuse details already supplied; do not ask for them again. Do not search or download during the interview.",
    });
  }
  if (a.text == null) {
    q({ id: "text", header: "On-screen text", question: "On-screen text?", options: [{ label: "Lower-thirds and one card", description: "place · time per shot where it matters; one card for the key moment", value: "lower-thirds+card" }, { label: "Lower-thirds only", value: "lower-thirds" }, { label: "None", value: "none" }], recommended: 0 });
  }
  if (a.guardrails == null) {
    q({ id: "guardrails", header: "Guardrails", question: "Anything that must be in, or must stay out? (pick all that apply)", multiSelect: true, options: [{ label: "Nothing beyond the above", value: "none" }], agentFills: "Collect any must-include or avoid instructions. Store an array with 'include:' or 'avoid:' prefixes, or ['none'] when the person explicitly has no constraints.", recommended: 0 });
  }

  if (questions.length) {
    return { done: false, questions, progress: { answered: asked, remaining: questions.length } };
  }

  // Assemble the brief only after all applicable questions have answers.
  const [aspect, resolution] = str(a.aspect).split("|") as ["16:9" | "9:16" | "1:1", "720p" | "1080p"];
  const genreLabel = str(a.genre);
  const scripted = !/^\s*unscripted/i.test(genreLabel);
  const picks = list(a.guardrails).filter((x) => x !== "none");
  const mustInclude = picks.filter((x) => /^include:/i.test(x)).map((x) => x.replace(/^include:\s*/i, ""));
  const avoid = picks.filter((x) => /^avoid:/i.test(x)).map((x) => x.replace(/^avoid:\s*/i, ""));
  const licence = str(a.licence);
  const narration = str(a.narration);
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
    ...(mats && mats !== "none" && str(a.materialsText).trim() ? { materials: { kind: mats as "script" | "shots" | "both", text: str(a.materialsText) } } : {}),
    premise: str(a.premise),
    tone: toneOnly.trim(),
    ...(str(a.audience) || audience ? { audience: (str(a.audience) || audience!).trim() } : {}),
    ...(mustInclude.length ? { mustInclude } : {}),
    ...(avoid.length ? { avoid } : {}),
    narration: { wanted: narration !== "none", ...(narration === "sparse" ? { style: "sparse, ≈50 words a minute; measured, no editorializing" } : narration === "full" ? { style: "full narration, ≈100 words a minute" } : {}) },
    music: music === "none" ? { wanted: false } : {
      wanted: true,
      brief: [
        music === "bed" ? "Understated music beneath narration or source sound." : music === "score" ? "Music shapes the pacing and story turns; use selected musical accents for cuts." : music,
        musicSelection === "choose" ? "Music selection delegated: choose for the directing style and story." : musicSelection === "soundtrack" ? "Select music featured in this film or series soundtrack:" : musicSelection === "tracks" ? "Use these artists, tracks, links or local files:" : musicSelection,
        musicReference,
      ].filter(Boolean).join("\n"),
    },
    text: { wanted: text !== "none", ...(text === "lower-thirds+card" ? { style: "place · time lower-thirds; one card for the key moment" } : text === "lower-thirds" ? { style: "place · time lower-thirds only" } : {}) },
    status: "draft",
  };
  return { done: true, brief };
}

/** Compatibility mode for clients that cannot retain a question queue. */
export function nextQuestion(request: string, a: Answers): { done: false; question: Question; progress: { answered: number; remaining: number } } | { done: true; brief: Brief } {
  const result = interviewBatch(request, a);
  if (result.done) return result;
  return { done: false, question: result.questions[0], progress: result.progress };
}
