/**
 * Directing styles: a real filmmaker's (or house's) way of building a piece,
 * translated into parameters the harness can check (check_plan,
 * pacing_report, check_soundtrack) and prose the agent follows
 * (guide/styles/<id>.md, read with get_style). The brief names one
 * (production.style.id) during the interview; the plan and the cut are then
 * reviewed against its selected reference and creative treatment.
 *
 * The parameters are deliberately blunt — a range, a policy, a kind — so a
 * plan receives advisory checks; these are not historical measurements. The nuance (sentence shapes, what a cut
 * to black means, which music) lives in the markdown next to each entry.
 * guide/styles/README.md is the index by category.
 */
import research from "./research.json";

export type StyleCraft = (typeof research)[keyof typeof research];
const craftById: Readonly<Record<string, StyleCraft | undefined>> = research;

export type Policy = "required" | "optional" | "none";
export type Category = "documentary" | "advertising" | "music-video" | "drama" | "political" | "trailer" | "essay" | "comedy" | "youtube";

export interface StyleParams {
  /** suggested starting average shot length (seconds), not a measured signature */
  aslS: [number, number];
  /** review shorter shots against the selected reference; this is not a prohibition */
  minShotS: number;
  /** cuts · cuts-and-black (hard cuts; black between beats) · dissolves (dissolves and fades are the grammar) · kinetic (whips, snap zooms, wipes, jump cuts) */
  transitions: "cuts" | "cuts-and-black" | "dissolves" | "kinetic";
  /** Preference for the starting reference; departures are review findings. */
  narration: Policy;
  /** essayist (third person, "this is a story about") · first-person (the filmmaker as a character, or a whisper) · director (the director's own meditative voice) · third-person (a measured reader) · presenter (a host to camera, sync) · chant · none */
  narrationVoice: "essayist" | "first-person" | "director" | "third-person" | "presenter" | "chant" | "none";
  /** narrated words per minute the style sits in; null when there is no narration */
  narrationWpm: [number, number] | null;
  music: Policy;
  /** found (library, pop and classical used against the picture) · score (composed) · period (the story's own time) · choral (sacred, drone, slow) · song (the track is the piece) · cue (a trailer / tension cue) · bed (a low library bed under a voice) · none */
  musicKind: "found" | "score" | "period" | "choral" | "song" | "cue" | "bed" | "none";
  /** muted (the shots' sound is off under the layers) · mixed (bursts of sync inside a narrated cut) · sync-first (the piece is made of the shots' own sound) */
  sync: "muted" | "mixed" | "sync-first";
  text: "none" | "sparse" | "cards" | "lower-thirds" | "kinetic";
  /** still photographs / documents with slow motion are a primary source */
  stills: boolean;
  /** none · direct-address (the subject or host speaks to the lens) · produced (lit talking heads, off-lens) · confrontation (the filmmaker in frame) */
  interviews: "none" | "direct-address" | "produced" | "confrontation";
  /** rhythmic editing is a tendency; selected passages may use beat analysis, never a required alignment percentage */
  beatCut: boolean;
}

export interface Style {
  id: string;
  /** the director's or house's name, as shown to the person */
  name: string;
  category: Category;
  /** the one line under the name in the interview */
  oneLine: string;
  /** genres / forms the style is offered for (tested against the brief's genre and form) */
  genres: RegExp;
  params: StyleParams;
  /** Editorial starting ranges, not measured career-wide limits. */
  parameterBasis: "editorial-defaults";
  craft?: StyleCraft;
  /** guide/styles/<file> — the prose instructions */
  file: string;
}

type P = [
  aslS: [number, number],
  minShotS: number,
  transitions: StyleParams["transitions"],
  narration: Policy,
  narrationVoice: StyleParams["narrationVoice"],
  narrationWpm: [number, number] | null,
  music: Policy,
  musicKind: StyleParams["musicKind"],
  sync: StyleParams["sync"],
  text: StyleParams["text"],
  stills: boolean,
  interviews: StyleParams["interviews"],
  beatCut: boolean,
];
const style = (id: string, name: string, category: Category, oneLine: string, genres: RegExp, p: P): Style => ({
  id,
  name: craftById[id]?.name ?? name,
  category,
  oneLine: craftById[id]?.mechanism ?? oneLine,
  parameterBasis: "editorial-defaults",
  craft: craftById[id],
  genres,
  params: { aslS: p[0], minShotS: p[1], transitions: p[2], narration: p[3], narrationVoice: p[4], narrationWpm: p[5], music: p[6], musicKind: p[7], sync: p[8], text: p[9], stills: p[10], interviews: p[11], beatCut: p[12] },
  file: `${id}.md`,
});

const DOC = /document|histor|archiv|essay|chronicle|observ|verit|institution|portrait|true crime|investig/i;
const AD = /commercial|advert|\bspot\b|brand|promo|launch|\bad\b|psa/i;
const MV = /music video|promo video|\bsong\b|visualizer|lyric/i;
const DRAMA = /drama|narrative|short film|scene|scripted fiction|fiction|thriller|romance|heist|sci-?fi|science fiction/i;
const POL = /propaganda|patriotic|national|campaign|political|rally|recruit|anthem|attack|polemic|wartime|revolution|protest/i;
const TRAILER = /trailer|teaser|sizzle|preview/i;
const ESSAY = /essay|explainer|analysis|education|tutorial|journalis|geopolitic/i;
const COMEDY = /comedy|sketch|satir|parody|mockumentary/i;
const YT = /youtube|vlog|social|creator|challenge|review|tech|product|unboxing|science|experiment|build|engineering|maker|lifestyle|travel|day in the life|curiosity|mystery/i;
const any = (...rs: RegExp[]) => new RegExp(rs.map((r) => r.source).join("|"), "i");

export const STYLES: Style[] = [
  // --- documentary
  style("adam-curtis", "Adam Curtis", "documentary", "A calm, certain narration is set against strange archive, and the distance between them carries the argument.", any(DOC, /politic|power/), [[4, 9], 1.5, "cuts-and-black", "required", "essayist", [60, 95], "required", "found", "mixed", "cards", false, "none", false]),
  style("michael-moore", "Michael Moore", "documentary", "A public claim becomes a concrete, often absurd encounter.", any(DOC, POL, /expos/), [[3, 6], 1, "cuts", "required", "first-person", [90, 130], "required", "found", "sync-first", "lower-thirds", false, "confrontation", false]),
  style("errol-morris", "Errol Morris", "documentary", "Testimony and recurring images expose uncertainty instead of closing it too soon.", any(DOC, /crime|interview/), [[5, 10], 1.5, "cuts-and-black", "optional", "third-person", null, "required", "score", "sync-first", "sparse", false, "direct-address", false]),
  style("ken-burns", "Ken Burns", "documentary", "An image changes meaning as its context and human stakes become visible.", any(DOC, /biograph|heritage|\bwar\b/), [[6, 12], 3, "dissolves", "required", "third-person", [70, 105], "required", "period", "mixed", "sparse", true, "produced", false]),
  style("werner-herzog", "Werner Herzog", "documentary", "A concrete observation opens a larger, unsettling question.", any(DOC, /nature|landscape|expedition|science/), [[8, 20], 4, "cuts", "required", "director", [30, 60], "required", "choral", "mixed", "none", false, "produced", false]),
  style("frederick-wiseman", "Frederick Wiseman", "documentary", "Procedures and relationships reveal how an institution works.", any(DOC, /fly on the wall|cinema/), [[8, 30], 3, "cuts", "none", "none", null, "none", "none", "sync-first", "none", false, "none", false]),
  style("humphrey-jennings", "Humphrey Jennings", "documentary", "Sound connects separate lives into a larger social picture.", any(DOC, POL), [[4, 8], 1.5, "cuts", "optional", "third-person", null, "optional", "found", "sync-first", "none", false, "none", false]),
  style("lemmino", "LEMMiNO", "documentary", "A confusing event becomes a set of inspectable claims, positions and uncertainties.", any(DOC, /mystery|youtube/), [[5, 10], 2, "dissolves", "required", "third-person", [110, 130], "required", "score", "mixed", "cards", true, "none", false]),
  // --- advertising
  style("ridley-scott", "Ridley Scott", "advertising", "A believable visual world makes a brief action feel consequential.", AD, [[2, 4], 0.7, "cuts", "optional", "third-person", [10, 50], "required", "score", "mixed", "sparse", false, "none", true]),
  style("spike-jonze", "Spike Jonze", "advertising", "An ordinary emotional state becomes a physical transformation.", any(AD, MV), [[2, 5], 0.7, "cuts", "optional", "third-person", [0, 30], "required", "song", "mixed", "sparse", false, "none", false]),
  style("jonathan-glazer", "Jonathan Glazer", "advertising", "One precise visual analogy becomes a forceful sensory event.", AD, [[2, 4], 0.4, "cuts", "optional", "chant", [20, 60], "required", "cue", "mixed", "sparse", false, "none", true]),
  style("hal-riney", "Hal Riney", "advertising", "A simple spoken idea gains force from a carefully chosen everyday or symbolic image.", any(AD, POL), [[4, 6], 2, "dissolves", "required", "third-person", [70, 100], "required", "score", "muted", "sparse", false, "none", false]),
  // --- music video
  style("michel-gondry", "Michel Gondry", "music-video", "A simple visual rule produces accumulating surprise.", MV, [[1, 2], 0.25, "cuts", "none", "none", null, "required", "song", "muted", "none", false, "none", true]),
  style("hype-williams", "Hype Williams", "music-video", "The performer becomes an unmistakable visual icon matched to the music.", MV, [[0.8, 2], 0.25, "cuts", "none", "none", null, "required", "song", "muted", "lower-thirds", false, "none", true]),
  style("anton-corbijn", "Anton Corbijn", "music-video", "A performer, a landscape and a recurring emblem imply an inner condition.", MV, [[3, 6], 1, "cuts", "none", "none", null, "required", "song", "muted", "sparse", false, "none", false]),
  style("chris-cunningham", "Chris Cunningham", "music-video", "An apparently physical body behaves according to an unfamiliar musical logic.", MV, [[2, 6], 0.1, "cuts", "none", "none", null, "required", "song", "mixed", "none", false, "none", true]),
  // --- dramatic scripted
  style("martin-scorsese", "Martin Scorsese", "drama", "An insider's account draws us into a world of status and appetite, then behavior and consequences expose the cost.", any(DRAMA, TRAILER, DOC, /crime|gangster|biograph|rise and fall|character study/), [[2, 6], 0.33, "cuts", "optional", "first-person", [70, 120], "optional", "found", "mixed", "sparse", false, "none", false]),
  style("wes-anderson", "Wes Anderson", "drama", "Composition and performance timing turn social relationships into visible arrangements.", any(DRAMA, COMEDY, /whimsical/), [[3, 7], 1, "kinetic", "optional", "third-person", [60, 100], "required", "found", "sync-first", "cards", false, "none", false]),
  style("christopher-nolan", "Christopher Nolan", "drama", "Separate strands acquire urgency as their relationship becomes intelligible.", any(DRAMA, /action/), [[3, 6], 0.8, "cuts", "optional", "third-person", [20, 50], "required", "score", "sync-first", "cards", false, "none", false]),
  style("denis-villeneuve", "Denis Villeneuve", "drama", "A small human perception or gesture gains force against a vast environment.", DRAMA, [[6, 15], 2, "cuts", "optional", "first-person", [15, 40], "required", "score", "mixed", "none", false, "none", false]),
  style("edgar-wright", "Edgar Wright", "drama", "Setup, action, sound and payoff form a pattern the audience can recognize and anticipate.", any(DRAMA, COMEDY, /action|montage/), [[1, 3], 0.2, "kinetic", "optional", "third-person", null, "required", "song", "sync-first", "kinetic", false, "none", true]),
  style("terrence-malick", "Terrence Malick", "drama", "Image, gesture and voice suggest an experience larger than any literal illustration.", any(DRAMA, /memory|poetic|elegy/), [[2, 5], 1, "cuts", "required", "first-person", [20, 50], "required", "choral", "mixed", "none", false, "none", false]),
  // --- patriotic / political
  style("frank-capra", "Frank Capra", "political", "A clearly stated argument is developed through organized archival evidence and explanation.", any(POL, /\bwar\b|explainer/), [[3, 6], 1, "cuts", "required", "presenter", [100, 140], "required", "period", "mixed", "cards", false, "none", false]),
  style("sergei-eisenstein", "Sergei Eisenstein", "political", "Relationships between images and bodily forms create an idea or conflict.", any(POL, DRAMA, /montage/), [[1, 3], 0.3, "cuts", "optional", "third-person", null, "required", "score", "muted", "cards", false, "none", true]),
  style("tony-schwartz", "Tony Schwartz", "political", "A familiar sound changes meaning through a sharply designed association.", any(POL, AD), [[5, 10], 1, "cuts", "required", "third-person", [40, 80], "optional", "cue", "sync-first", "cards", false, "none", false]),
  style("lincoln-project", "The Lincoln Project", "political", "Existing statements are organized to make a contradiction or consequence easy to follow.", any(POL, /satir|spot/), [[2, 4], 0.7, "cuts-and-black", "required", "third-person", [100, 130], "required", "cue", "sync-first", "kinetic", false, "none", false]),
  // --- trailers
  style("mark-woollen", "Mark Woollen", "trailer", "A distinctive music-and-image proposition sells the film's emotional experience.", TRAILER, [[2, 4], 0.8, "cuts-and-black", "optional", "third-person", null, "required", "song", "sync-first", "cards", false, "none", false]),
  style("buddha-jones", "Buddha Jones", "trailer", "Controlled information and changing sonic pressure build anticipation and reversal.", any(TRAILER, /horror|thriller/), [[1.5, 3], 0.15, "cuts-and-black", "optional", "third-person", null, "required", "cue", "mixed", "cards", false, "none", true]),
  style("av-squad", "AV Squad", "trailer", "A named execution sells one experience: a hook, escalating moments and a genuinely distinctive payoff arranged for the requested duration.", any(TRAILER, /action|blockbuster/), [[1, 4], 0.2, "cuts", "optional", "none", null, "required", "cue", "mixed", "cards", false, "none", false]),
  style("a24", "A24", "trailer", "Campaign specificity is the useful starting point; there is no defensible single-director system.", any(TRAILER, /art|indie/), [[2, 5], 0.4, "cuts", "optional", "third-person", null, "optional", "found", "mixed", "cards", false, "none", false]),
  style("anais-bimpel", "Anaïs Bimpel", "trailer", "Character moments, source sounds and musical phrases are arranged into a rhythm that carries the story's change in pressure.", any(TRAILER, /rhythm|spot/), [[1, 3], 0.25, "cuts", "optional", "none", null, "required", "cue", "mixed", "cards", false, "none", false]),
  // --- essay / explainer
  style("tony-zhou", "Taylor Ramos & Tony Zhou", "essay", "The viewer sees an argument demonstrated through the audiovisual evidence itself.", any(ESSAY, /film|cinema/), [[3, 6], 1, "cuts", "required", "first-person", [110, 140], "optional", "bed", "sync-first", "lower-thirds", false, "none", false]),
  style("johnny-harris", "Johnny Harris", "essay", "A question is developed through visual explanation with a clear promise to the viewer.", any(ESSAY, DOC, /youtube/), [[3, 6], 1, "kinetic", "required", "first-person", [140, 160], "required", "bed", "mixed", "kinetic", true, "direct-address", false]),
  // --- comedy
  style("christopher-guest", "Christopher Guest", "comedy", "Committed characters reveal the gap between their self-image and observable behavior.", COMEDY, [[4, 8], 1.5, "cuts", "none", "none", null, "none", "none", "sync-first", "lower-thirds", false, "produced", false]),
  // --- youtube creators
  style("mrbeast", "MrBeast", "youtube", "A legible objective, stakes and changing progress sustain attention.", any(YT, /entertainment|stunt/), [[1, 3], 0.3, "kinetic", "required", "presenter", [150, 180], "required", "bed", "sync-first", "kinetic", false, "direct-address", false]),
  style("casey-neistat", "Casey Neistat", "youtube", "A personal intention becomes an improvised journey with a visible result.", YT, [[2, 4], 0.7, "kinetic", "required", "presenter", [130, 160], "required", "song", "sync-first", "sparse", false, "direct-address", true]),
  style("mkbhd", "MKBHD", "youtube", "A clear judgment is supported by an immediately relevant demonstration.", YT, [[3, 6], 1, "cuts", "required", "presenter", [130, 150], "required", "bed", "sync-first", "lower-thirds", false, "direct-address", false]),
  style("tom-scott", "Tom Scott", "youtube", "A surprising proposition leads to an understandable mechanism and its limit.", any(YT, ESSAY, /places|fact/), [[6, 12], 2, "cuts", "required", "presenter", [150, 170], "none", "none", "sync-first", "sparse", false, "direct-address", false]),
  style("veritasium", "Veritasium", "youtube", "A plausible mental model is tested and revised through evidence.", any(YT, ESSAY), [[3, 6], 1.5, "cuts", "required", "presenter", [130, 150], "required", "bed", "sync-first", "kinetic", false, "produced", false]),
  style("vsauce", "Vsauce", "youtube", "A small question opens a chain of meaningful conceptual connections.", any(YT, ESSAY, /philosoph/), [[2, 4], 0.7, "kinetic", "required", "presenter", [140, 160], "required", "bed", "sync-first", "cards", true, "direct-address", false]),
  style("mark-rober", "Mark Rober", "youtube", "A playful objective becomes a visible engineering problem and a satisfying test.", YT, [[2, 4], 0.5, "kinetic", "required", "presenter", [140, 160], "required", "bed", "sync-first", "kinetic", false, "direct-address", true]),
  style("emma-chamberlain", "Emma Chamberlain", "youtube", "The edit reveals the gap between a performed self and a more candid thought.", YT, [[1.5, 3], 0.3, "kinetic", "required", "presenter", [150, 180], "required", "bed", "sync-first", "kinetic", false, "direct-address", false]),
  style("peter-mckinnon", "Peter McKinnon", "youtube", "Tactile supplementary footage gives an everyday activity sensory appeal and continuity.", any(YT, /cinematic|photograph/), [[2, 4], 0.5, "kinetic", "required", "presenter", [130, 150], "required", "song", "sync-first", "lower-thirds", false, "direct-address", true]),
];

export const styleById = (id: string | null | undefined): Style | undefined => (id ? STYLES.find((s) => s.id === id) : undefined);

/** Styles offered for a genre / form ("scripted historical documentary" → the documentary set). Empty when none fits. */
export const stylesFor = (genre: string): Style[] => STYLES.filter((s) => s.genres.test(genre));

export const CATEGORIES: { id: Category; title: string }[] = [
  { id: "documentary", title: "Documentary" },
  { id: "advertising", title: "Advertising" },
  { id: "music-video", title: "Music video" },
  { id: "drama", title: "Dramatic scripted" },
  { id: "political", title: "Patriotic, political and propaganda" },
  { id: "trailer", title: "Trailers and teasers" },
  { id: "essay", title: "Video essay and explainer" },
  { id: "comedy", title: "Comedy" },
  { id: "youtube", title: "YouTube creators" },
];

/** One line for a plan header or an interview option. */
export const styleLabel = (s: Style) => `${s.name} — ${s.oneLine}`;
