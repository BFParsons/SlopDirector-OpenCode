/**
 * Directing styles: a real filmmaker's (or house's) way of building a piece,
 * translated into parameters the harness can check (check_plan,
 * pacing_report, check_soundtrack) and prose the agent follows
 * (guide/styles/<id>.md, read with get_style). The brief names one
 * (production.style.id) during the interview; the plan and the cut are then
 * held to it.
 *
 * The parameters are deliberately blunt — a range, a policy, a kind — so a
 * plan can be checked mechanically. The nuance (sentence shapes, what a cut
 * to black means, which music) lives in the markdown next to each entry.
 * guide/styles/README.md is the index by category.
 */
export type Policy = "required" | "optional" | "none";
export type Category = "documentary" | "advertising" | "music-video" | "drama" | "political" | "trailer" | "essay" | "comedy" | "youtube";

export interface StyleParams {
  /** average shot length the style lives in (seconds) */
  aslS: [number, number];
  /** a shot shorter than this is out of style (seconds) */
  minShotS: number;
  /** cuts · cuts-and-black (hard cuts; black between beats) · dissolves (dissolves and fades are the grammar) · kinetic (whips, snap zooms, wipes, jump cuts) */
  transitions: "cuts" | "cuts-and-black" | "dissolves" | "kinetic";
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
  /** the cut sits on a beat grid (check_beat_alignment is part of verification) */
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
  name,
  category,
  oneLine,
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
  style("adam-curtis", "Adam Curtis", "documentary", "the archive essay: raided archive, an essayist's narration, found music against the picture, hard cuts to black", any(DOC, /politic|power/), [[4, 9], 1.5, "cuts-and-black", "required", "essayist", [60, 95], "required", "found", "mixed", "cards", false, "none", false]),
  style("michael-moore", "Michael Moore", "documentary", "the first-person polemic: sardonic narration, ironic pop against grim archive, confrontations with sync sound", any(DOC, POL, /expos/), [[3, 6], 1, "cuts", "required", "first-person", [90, 130], "required", "found", "sync-first", "lower-thirds", false, "confrontation", false]),
  style("errol-morris", "Errol Morris", "documentary", "the interrogation: subjects speak straight to the lens, stylised reenactments, a minimalist looping score, no narrator", any(DOC, /crime|interview/), [[5, 10], 1.5, "cuts-and-black", "none", "none", null, "required", "score", "sync-first", "sparse", false, "direct-address", false]),
  style("ken-burns", "Ken Burns", "documentary", "the chronicle: photographs that move, a measured narrator and a chorus of letters, period music, dissolves", any(DOC, /biograph|heritage|\bwar\b/), [[6, 12], 3, "dissolves", "required", "third-person", [70, 105], "required", "period", "muted", "sparse", true, "produced", false]),
  style("werner-herzog", "Werner Herzog", "documentary", "the ecstatic truth: long takes, the director's own meditative voice, choral music, silence, the unanswerable question", any(DOC, /nature|landscape|expedition|science/), [[8, 20], 4, "cuts", "required", "director", [30, 60], "required", "choral", "mixed", "none", false, "produced", false]),
  style("frederick-wiseman", "Frederick Wiseman", "documentary", "the observation: no narrator, no music, no text, no interviews — long sequences of sync sound inside an institution", any(DOC, /fly on the wall|cinema/), [[8, 30], 3, "cuts", "none", "none", null, "none", "none", "sync-first", "none", false, "none", false]),
  style("humphrey-jennings", "Humphrey Jennings", "documentary", "the country listening: sequences of real sound handed one to the next, found music from inside the picture, no commentary", any(DOC, POL), [[4, 8], 1.5, "cuts", "none", "none", null, "optional", "found", "sync-first", "none", false, "none", false]),
  style("lemmino", "LEMMiNO", "documentary", "the dark documentary: maps, documents and photographs on black, a calm archivist's narration, an ambient score", any(DOC, /mystery|youtube/), [[5, 10], 2, "dissolves", "required", "third-person", [110, 130], "required", "score", "muted", "cards", true, "none", false]),
  // --- advertising
  style("ridley-scott", "Ridley Scott", "advertising", "the cinematic spot: an epic world, one figure who breaks the pattern, the product arriving late and once", AD, [[2, 4], 0.7, "cuts", "optional", "third-person", [10, 50], "required", "score", "muted", "sparse", false, "none", true]),
  style("spike-jonze", "Spike Jonze", "advertising", "the playful idea: one absurd premise taken completely seriously, a sincere song, a deadpan turn", any(AD, MV), [[2, 5], 0.7, "cuts", "optional", "third-person", [0, 30], "required", "song", "mixed", "sparse", false, "none", false]),
  style("jonathan-glazer", "Jonathan Glazer", "advertising", "the sensory spot: monochrome, slow motion, one physical event become a myth, a drum that the cut sits on", AD, [[2, 4], 0.4, "cuts", "optional", "chant", [20, 60], "required", "cue", "mixed", "sparse", false, "none", true]),
  style("hal-riney", "Hal Riney", "advertising", "Morning in America: soft sunlit moments, a warm neighbourly voice with numbers folded in, strings that climb", any(AD, POL), [[4, 6], 2, "dissolves", "required", "third-person", [70, 100], "required", "score", "muted", "sparse", false, "none", false]),
  // --- music video
  style("michel-gondry", "Michel Gondry", "music-video", "the handmade loop: the song's structure made visible, one rule per element, repetition that grows", MV, [[1, 2], 0.25, "cuts", "none", "none", null, "required", "song", "muted", "none", false, "none", true]),
  style("hype-williams", "Hype Williams", "music-video", "the gloss: fisheye, saturated colour per section, split screens, the performer at the centre of a bending world", MV, [[0.8, 2], 0.25, "cuts", "none", "none", null, "required", "song", "muted", "lower-thirds", false, "none", true]),
  style("anton-corbijn", "Anton Corbijn", "music-video", "the grain: black and white, a performer alone in a landscape, the band to camera in a bare room, still frontal portraits", MV, [[3, 6], 1, "cuts", "none", "none", null, "required", "song", "muted", "sparse", false, "none", false]),
  style("chris-cunningham", "Chris Cunningham", "music-video", "the uncanny: a bleak real place, something slightly wrong, a drop cut to the track's stutters, technically exact", MV, [[2, 6], 0.1, "cuts", "none", "none", null, "required", "song", "mixed", "none", false, "none", true]),
  // --- dramatic scripted
  style("wes-anderson", "Wes Anderson", "drama", "the diorama: planimetric symmetry, chapter cards, whip pans, deadpan faces, a storybook narrator, found 1960s pop", any(DRAMA, COMEDY, /whimsical/), [[3, 7], 1, "kinetic", "optional", "third-person", [60, 100], "required", "found", "sync-first", "cards", false, "none", false]),
  style("christopher-nolan", "Christopher Nolan", "drama", "the clockwork: parallel strands intercut faster and faster, enormous steady images, a score that only rises", any(DRAMA, /action/), [[3, 6], 0.8, "cuts", "optional", "third-person", [20, 50], "required", "score", "sync-first", "cards", false, "none", false]),
  style("denis-villeneuve", "Denis Villeneuve", "drama", "the monolith: a tiny figure against something vast, shots held past information, a drone score, one hue per world", DRAMA, [[6, 15], 2, "cuts", "optional", "first-person", [15, 40], "required", "score", "mixed", "none", false, "none", false]),
  style("edgar-wright", "Edgar Wright", "drama", "the snap: every cut on a sound, whip pans and crash zooms, a diegetic song the world moves on, set-ups that pay off", any(DRAMA, COMEDY, /action|montage/), [[1, 3], 0.2, "kinetic", "none", "none", null, "required", "song", "sync-first", "kinetic", false, "none", true]),
  style("terrence-malick", "Terrence Malick", "drama", "the whisper: magic hour, a drifting camera, fragments of a day, a whispered question to someone absent, choral music", any(DRAMA, /memory|poetic|elegy/), [[2, 5], 1, "cuts", "required", "first-person", [20, 50], "required", "choral", "mixed", "none", false, "none", false]),
  // --- patriotic / political
  style("frank-capra", "Frank Capra", "political", "the case for the fight: the enemy's own footage turned against him, a neighbourly narrator with numbers, maps that move, contrast pairs", any(POL, /\bwar\b|explainer/), [[3, 6], 1, "cuts", "required", "presenter", [100, 140], "required", "period", "mixed", "cards", false, "none", false]),
  style("sergei-eisenstein", "Sergei Eisenstein", "political", "the collision: meaning made by hitting two shots together, motifs returning faster, overlapping action, intertitles", any(POL, DRAMA, /montage/), [[1, 3], 0.3, "cuts", "none", "none", null, "required", "score", "muted", "cards", false, "none", true]),
  style("tony-schwartz", "Tony Schwartz", "political", "the responsive chord: one image, one sound, one implication — the audience completes the message", any(POL, AD), [[5, 10], 1, "cuts", "required", "third-person", [40, 80], "optional", "cue", "sync-first", "cards", false, "none", false]),
  style("lincoln-project", "The Lincoln Project", "political", "the prosecution: the subject's own words against the pictures of what they cost, a grim narrator, bold captions, a dread cue", any(POL, /satir|spot/), [[2, 4], 0.7, "cuts-and-black", "required", "third-person", [100, 130], "required", "cue", "sync-first", "kinetic", false, "none", false]),
  // --- trailers
  style("mark-woollen", "Mark Woollen", "trailer", "the mood piece: a slow choral cover, quiet images, dialogue as poetry, black between lines, the title when the song breaks", TRAILER, [[2, 4], 0.8, "cuts-and-black", "none", "none", null, "required", "song", "sync-first", "cards", false, "none", false]),
  style("buddha-jones", "Buddha Jones", "trailer", "the dread: a warped pop song, black frames between accelerating shots, a sound that stops, the monster withheld", any(TRAILER, /horror|thriller/), [[1.5, 3], 0.15, "cuts-and-black", "none", "none", null, "required", "cue", "mixed", "cards", false, "none", true]),
  style("av-squad", "AV Squad", "trailer", "the blockbuster rise: a cold open, a riser that never stops, tempo doubling to a beat-locked money sequence, a stopdown, the title, a button", any(TRAILER, /action|blockbuster/), [[1.5, 3], 0.3, "cuts", "none", "none", null, "required", "cue", "sync-first", "cards", false, "none", true]),
  style("a24", "A24", "trailer", "the cryptic teaser: shows almost everything, tells almost nothing — one sound idea, one typeface, the film sold as an object", any(TRAILER, /art|indie/), [[2, 5], 0.4, "cuts", "none", "none", null, "optional", "found", "mixed", "cards", false, "none", false]),
  style("anais-bimpel", "Anaïs Bimpel", "trailer", "the rhythmic trailer: the picture's own sounds sequenced into the beat, the cue entering late already in time", any(TRAILER, /rhythm|spot/), [[1, 3], 0.25, "cuts", "none", "none", null, "required", "cue", "sync-first", "cards", false, "none", true]),
  // --- essay / explainer
  style("tony-zhou", "Tony Zhou", "essay", "Every Frame a Painting: one idea about film form, the clips as evidence shown twice with the point marked, every clip cited", any(ESSAY, /film|cinema/), [[3, 6], 1, "cuts", "required", "first-person", [110, 140], "optional", "bed", "sync-first", "lower-thirds", false, "none", false]),
  style("johnny-harris", "Johnny Harris", "essay", "the map essay: a journalist in front of a paper wall, label-free maps that zoom and orbit, kinetic type that answers the narration", any(ESSAY, DOC, /youtube/), [[3, 6], 1, "kinetic", "required", "first-person", [140, 160], "required", "bed", "mixed", "kinetic", true, "direct-address", false]),
  // --- comedy
  style("christopher-guest", "Christopher Guest", "comedy", "the mockumentary: sincere interviews in front of a wall, stolen observational footage, the joke in the gap and the pause", COMEDY, [[4, 8], 1.5, "cuts", "none", "none", null, "none", "none", "sync-first", "lower-thirds", false, "produced", false]),
  // --- youtube creators
  style("mrbeast", "MrBeast", "youtube", "retention: the premise in the first sentence, a new visual event every few seconds, risers and hits on every reveal, nothing skippable", any(YT, /entertainment|stunt/), [[1, 3], 0.3, "kinetic", "required", "presenter", [150, 180], "required", "bed", "sync-first", "kinetic", false, "direct-address", false]),
  style("casey-neistat", "Casey Neistat", "youtube", "the cinematic vlog: a day told like a short film — wide-angle walking, time-lapses, jump-cut monologues, a track the day is cut to", YT, [[2, 4], 0.7, "kinetic", "required", "presenter", [130, 160], "required", "song", "sync-first", "sparse", false, "direct-address", true]),
  style("mkbhd", "MKBHD", "youtube", "the clean review: a dark studio with one red accent, gliding macro b-roll, a calm exact voice, specs on screen when spoken", YT, [[3, 6], 1, "cuts", "required", "presenter", [130, 150], "required", "bed", "sync-first", "lower-thirds", false, "direct-address", false]),
  style("tom-scott", "Tom Scott", "youtube", "the single take on location: one presenter, one place, one idea, no cuts if he can help it, no music until the end card", any(YT, ESSAY, /places|fact/), [[6, 12], 2, "cuts", "required", "presenter", [150, 170], "none", "none", "sync-first", "sparse", false, "direct-address", false]),
  style("veritasium", "Veritasium", "youtube", "the misconception: what everyone believes said on camera, a demonstration that contradicts it, diagrams drawn on the words", any(YT, ESSAY), [[3, 6], 1.5, "cuts", "required", "presenter", [130, 150], "required", "bed", "sync-first", "kinetic", false, "produced", false]),
  style("vsauce", "Vsauce", "youtube", "the tangent: a simple question walked backwards through five others, engravings and props, snap zooms, a plucked eerie bed", any(YT, ESSAY, /philosoph/), [[2, 4], 0.7, "kinetic", "required", "presenter", [140, 160], "required", "bed", "sync-first", "cards", true, "direct-address", false]),
  style("mark-rober", "Mark Rober", "youtube", "the build: problem, plan, build montage, a test that fails, a fix, slow-motion success, a payoff seen from the air", YT, [[2, 4], 0.5, "kinetic", "required", "presenter", [140, 160], "required", "bed", "sync-first", "kinetic", false, "direct-address", true]),
  style("emma-chamberlain", "Emma Chamberlain", "youtube", "the chaotic self-edit: snap zooms on her own mistakes, sound effects on a sip, captions that argue with her, outtakes as commentary", YT, [[1.5, 3], 0.3, "kinetic", "required", "presenter", [150, 180], "required", "bed", "sync-first", "kinetic", false, "direct-address", false]),
  style("peter-mckinnon", "Peter McKinnon", "youtube", "the cinematic vlog: every shot a moving photograph — shallow depth, speed ramps, whip pans that land on the next scene, a warm LUT", any(YT, /cinematic|photograph/), [[2, 4], 0.5, "kinetic", "required", "presenter", [130, 150], "required", "song", "sync-first", "lower-thirds", false, "direct-address", true]),
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
