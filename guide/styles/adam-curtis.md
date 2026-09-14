# Adam Curtis — the archive essay

Films: *The Century of the Self*, *The Power of Nightmares*, *HyperNormalisation*, *Can't Get You Out of My Head*.

## Reference and mechanism

The archive essay as built in The Century of the Self, The Power of Nightmares, HyperNormalisation and Can't Get You Out of My Head; a reference for narrated archive construction, not a universal documentary template.

A calm, certain narration is set against strange archive, and the distance between them carries the argument.

## Evidence

The title survey reproduced in this repository establishes the two-register typography: a Bitter Lake title frame in large turquoise capitals, identified by its publication context, and Can't Get You Out of My Head artwork in cyan capitals with a yellow offset. The construction, shot-length ranges and pause discipline are editorial translations of the archive-essay form as practised in the named films.

**Basis:** Derived from this repository's hand-written profile (guide/styles/adam-curtis.md) and its 2026-09-09 title survey, not from a fresh literature review. The sources below are a reproduced title frame, its publication context and promotional artwork; they establish the title-and-caption distinction and identify the films, and nothing further. Shot-length ranges, narration rate, pause lengths and the exact hex colour are editorial harness defaults, not measurements of the films.

## Material prerequisites

**Production fit:** Archive-dependent. Broadcast archive, newsreel, home-movie or corporate film with texture and oddness, inspected across its whole source window; a thesis about power that can be stated in plain declaratives; and music, usually from other decades than the pictures, that you are able to use.

## The signature

A story about power, told over other people's footage. The narrator is calm and certain; the archive is strange, often beautiful, often nothing to do with the words; the music is somebody else's record, played against the picture. Cuts to black are punctuation. The film keeps saying "but then something strange happened".

## Structure — how a scene is built

- One idea per scene, stated in the first line and turned over once: *set-up → the turn ("but") → consequence*. The turn lands on a cut to black or a card.
- After a particularly important statement, leave a pregnant pause: the narrator stops and attention passes to a compelling archival shot. Choose the statement and the shot together; the pause is part of the argument, not leftover time between paragraphs.
- Reserve these moments before writing or timing the narration. As harness starting points, allow 3–6 s without narration in a short trailer, 6–12 s in a longer essay, and 10–20 s when the archive sustains it. A three-minute trailer should normally plan two or three such moments, scaled to the material. These are design defaults, not measured rules for Curtis's films. Vary the holds; do not pause after every paragraph.
- The archive must earn the silence: a strange gesture, a ritual unfolding, an uneasy face, a machine performing an unexpected action, or an image whose meaning changes after the line. Inspect the entire source window, including its internal cuts and payoff. Generic establishing footage, a static title or black alone does not satisfy an archive-led pause. If the shot cannot hold attention without explanation, find another shot.
- Let the important line finish, then let the image and music or selected sync sound carry the thought. The shot may begin beneath the final words or arrive as they end. Hold through its revealing action before the next line; avoid a flurry of cuts or explanatory text that takes attention back from the image.
- The scene ends on an image, not a sentence: the last narration line comes 5–10 s before the out, and the picture runs on.
- For a scene of a longer film: no title, no sign-off; the last shot hands off (a hold, or black).

## The cut

- Average shot 4–9 s; the montage runs 3–5 s a shot, the holds 10–20 s. Nothing under 1.5 s.
- Straight cuts. Between beats, a hard cut to black (0.5–1.5 s of black, silent or with the music running). No dissolves.
- Shots are chosen for texture and oddness, not illustration: a 1970s shopping centre, a computer room, a ballroom, a helicopter over suburbs, people looking at the camera. Two literal shots in a row is a failure.
- Archive keeps its scratches, its timecode burn-ins and its VHS colour. Do not grade it clean; `colorLook` NONE.

## Narration — the essayist

- Third person, past tense, plain declaratives, one clause per sentence. Names are given once, then "he", "they", "the men who…".
- Openings: "This is a story about…", "At the same time…", "What nobody noticed was…". Turns: "But then something strange happened.", "But it didn't work out like that." Consequences: "And out of that came…".
- 60–95 words a minute for the long-form essay, delivered slowly and evenly, no questions or adjectives of judgement. Budget the meaningful pauses separately from speaking time. For shorter trailers, use a natural delivery pace and protect the chosen pauses rather than mechanically inserting 5–15 s after every paragraph.
- Split narration at the selected statements and place the next clip after the reserved hold. Recheck timings against the recorded takes. When writing the script, reduce words to fit the speech budget; when the user supplied a verbatim script and fixed runtime, flag any conflict in the plan instead of silently removing the holds or speeding up the voice.
- Voice: measured, English, unhurried (`generate_narration` voice sal or leo; never a "documentary announcer").

## Sound

- Music is **found**: pop, library, film scores, classical, often from other decades than the pictures. Counterpoint remains useful — a love song under a riot, a waltz under a computer — but a narrative turn can deliberately align music with the new emotion. A specific recording's uneasy texture can signal danger or foreboding. Avoid automatic horror stings, trailer risers and interchangeable tension loops.
- Plan each song transition as an emotional event. Name the feeling before and after (reassurance → unease, triumph → emptiness, intimacy → threat), the triggering line/image, the outgoing phrase, and the incoming source passage. Select the passage by its audible character, not just its title or inclusion in a Curtis playlist. When Curtis-used songs are requested, verify that provenance separately from whether the passage works here.
- At a threat reveal, an outgoing warm song can end on the preceding phrase; hold the revealing archive image while a colder, unstable or unresolved passage enters. Give the new cue time to register before the next explanation. This is an opportunity to consider, not an automatic moral label for whoever appears on screen.
- Choose the handoff deliberately: a hard replacement for rupture; a brief, explicitly timed music-free gap with appropriate room tone/sync sound for exposure; or a short crossfade for a creeping change. A seamless crossfade is not the default. Do not change songs merely because the file ends, stop every cue at black, or always wait until a new shot to introduce the next cue. The music can lead the image if anticipation is the intent.
- Keep narration and music on independent tracks. Duck music under speech and let it become more present during the selected pauses, without an automatic dramatic swell. A narration pause normally retains music or meaningful sync sound; any music-free interval must be a deliberate cue-sheet decision, not a gap inherited from the voice track.
- Sync sound returns only when it contributes to the hold: an old interview sentence, room tone, applause, a machine. Inspect/listen to the source before setting `muted: false` and level it against the mix. Otherwise keep the archive muted and let the separate music carry the image. Never introduce accidental source speech under the narrator.

## Picture — sources and text

- Sources: broadcast archive, newsreels, home movies, corporate films, old television, from many eras. `licence` archives / official channels first; the more obscure the upload, the better the texture.
- Supporting text: plain white sans, sentence case, straight over archive or on black, held 3–4 s: a place and a year, or a sentence of the argument. Keep this separate from the film title.
- Film title: big, bold and deliberately colored. Use the title role, not a larger supporting card. The Bitter Lake-informed default uses turquoise capitals; select a particular film reference and palette rather than treating all Curtis titles as identical.

## Do not

- No talking heads, no reporter stand-ups as content (a reporter is archive, treated like any other shot).
- No drone shots, no stock footage, no modern graphics, no maps.
- No decorative song swaps or reflexive swell under the climax. Emotional alignment at a meaningful turn is allowed; state what the change makes the viewer feel and why it belongs at that moment.
- No narration that judges ("shockingly", "tragically"); the arrangement judges.

## Type

**The signature.** Two registers: plain supporting text and an assertive film identity. Large bold colored lettering is appropriate for the title; the white sentence-case caption rule does not describe the full title system.

**Stand-ins.** Liberation Sans Regular for supporting text; Liberation Sans Bold for the title's heavy neutral sans. These are bundled approximations, not verified original font identifications. Supporting case/color: sentence/#FFFFFF. Title: uppercase/#00DED4. Hard on/off remains the harness default.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — a place and a year, or one sentence of the argument, on black. Liberation Sans · 5.2 % · center · no box · none · hold 4 s.
- **caption** — the same sentence, straight over the archive, no box, no outline. Liberation Sans · 4.6 % · center · no box · none · hold 4 s.
- **date** — a place · a year, top-left, the archive's own timecode left in. Liberation Sans · 3.8 % · top-left · no box · none.
- **title** — film name, large bold turquoise capitals, centred and line-broken deliberately as needed. Liberation Sans Bold · 16% landscape / 11% portrait frame height · no box/outline/shadow · hold 4 s. Color and scale are adaptable design defaults.

**Never:** lower-third, callout, citation, intertitle.

**Survey note (2026-09-09).** Inspected the reproduced [Bitter Lake title frame](https://entitleblogdotorg3.wordpress.com/wp-content/uploads/2015/03/adam-curtis-bitter-lake-2015.jpg): very large turquoise sans capitals on two lines, with a thin warm-colored edge, over desert footage. Its [publication context](https://undisciplinedenvironments.org/2015/03/16/bitter-lake-and-waves-of-a-fever-adam-curtis-on-chaos-complexity-and-crisis/) identifies the film. Also inspected [Can't Get You Out of My Head artwork](https://www.stranger-fiction.com/stories-to-watch/adam-curtis-cant-get-you-out-of-my-head): large cyan capitals with a yellow offset against red. Treat the latter as artwork, not proof of the exact episode title sequence. These visual references correct the earlier conflation of captions and titles. They do not establish a universal font, exact hex colors or animation timing. The native preset captures weight, scale and color; it does not reproduce the colored edge/offset effect. A different Curtis film may call for a different treatment.

## Harness parameters (mirror of `src/lib/styles`)

asl 4–9 s · min shot 1.5 s · transitions cuts-and-black · narration required, essayist, 60–95 wpm · music required, found · sync mixed · text cards · interviews none

## Evaluation

Cut a 30-second passage in which the narration states one idea and then stops, and a single archive shot holds the screen after it; a viewer should feel the claim land without the narrator explaining it.

**Failure mode:** Portentous narration over generic stock footage with a song swapped in for mood: attitude in place of an argument, and archive that illustrates the words instead of unsettling them.

The duration above is a suggested experiment length. Plan the test within the approved production scope; it is not a new approval gate or a claim that the test has passed.

## Applying it in SlopStudio

- Plan: put a compact **Pause map** and **Music turns** table in existing plan `notes`; carry their timing into `script.atS`, shot durations/descriptions and `music.brief`. Do not invent schema fields. For each pause record the preceding line/script id, timeline in/out, shot/clip id, the visible action/payoff and the sound choice. For each music turn record the trigger, before/after emotion, outgoing/incoming cue, timeline handoff and transition method. Source windows may be provisional in the plan; replace them with inspected timecodes in the production cue sheet before assembly.
- Timing: reserve the holds first, then allocate speech time. Generate separate narration clips around them; adjust offsets to the measured takes. Use `sound: "sync"` only for deliberate source sound and `sound: "muted"` for music-led holds. A hard cut to a black/card shot uses a straight cut; `fadeToBlack` creates a different transition. Black punctuation does not replace the interesting archive required by the pause map.
- Clip list: queries name actions, eras and textures ("1980s shopping mall archive", "computer room 1970s BBC"), not events only. For each pause, specify what must remain interesting over its full duration and a fallback visual idea; source these shots as priorities. Do not stretch a weak shot or add pan-and-scan to manufacture interest.
- Music: use `set_music` for a single continuous bed, or separate audio-only music clips with explicit `offsetS`, `trimStartS`, `durationS` and gain for multiple cues. Use independent A1 narration and A2 music; apply ducking/automation for that routing and avoid doubling the same cue in the special bed slot. A zero project fade does not schedule a song change: trim/place the actual cue and explicitly construct any intended gap or crossfade.
- Verify each planned pause against measured narration ends and the rendered timeline: no stray words, the selected action remains visible for the whole hold, and music/sync continues as intended. Review a moving, audible excerpt; a contact sheet cannot establish that the hold sustains attention. If listening is unavailable, report that limit rather than claiming an emotional audition.
- Review each music handoff with several seconds of context on both sides: does the intended emotion change, does the new passage register, and are gaps/overlaps deliberate? Metering and beat alignment alone cannot answer this. `pacing_report` may flag intentional long holds; preserve justified holds instead of shortening them to meet the average. `check_soundtrack`/`verify_export` currently may mistake A2 audio-only music for narration or report the special bed missing; verify track placement and rendered music continuity independently and document the limitation.

**Feedback incorporated from Everything is under control (2026-09-09):** the song boundary around 01:26 and the following Trump shot offered a stronger reassurance-to-threat turn. For future films, deliberately audition an incoming passage that makes that shift felt and allow the archive to carry it before narration resumes. Generalize the storytelling decision; do not hardcode this timestamp, person, political role or pair of songs into later films.

## Sources

- [Bitter Lake title frame (reproduced still)](https://entitleblogdotorg3.wordpress.com/wp-content/uploads/2015/03/adam-curtis-bitter-lake-2015.jpg) — Entitle Blog; 2015-03. Reproduced title frame. Very large turquoise sans capitals on two lines with a thin warm edge, over footage; the title register as distinct from plain white captions.
- [Bitter Lake and waves of a fever: Adam Curtis on chaos, complexity and crisis](https://undisciplinedenvironments.org/2015/03/16/bitter-lake-and-waves-of-a-fever-adam-curtis-on-chaos-complexity-and-crisis/) — Undisciplined Environments; 2015-03-16. Publication context. Identifies the film to which the reproduced title frame belongs.
- [Adam Curtis - Can't Get You Out of My Head](https://www.stranger-fiction.com/stories-to-watch/adam-curtis-cant-get-you-out-of-my-head) — Stranger Fiction; 2021. Promotional artwork. Large cyan capitals with a yellow offset against red; treated as artwork rather than proof of the episode title sequence.
