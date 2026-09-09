# Tom Scott — the single take on location

Work: "Things You Might Not Know", "Amazing Places", "The Basics"; "This Video Has X Views"; the red T-shirt; a decade of weekly videos.

## The signature

One presenter, one place, one idea, one take. He stands in front of the thing (a lighthouse, a dam, a border stone, a server hall) and explains it from memory, walking a little, in three to six minutes, without a cut if he can help it. Drone shots and a few inserts show what he is pointing at. No music until the end card. The authority is the location and the clarity.

## Structure — how a video is built

- Open on the presenter in the place, the hook in the first sentence ("This is the only place in the world where…").
- The explanation in one continuous argument: what it is, why it is here, the surprising detail, what it means; each step matched by a small move or a gesture toward the thing.
- Inserts (a drone wide, a detail, an archive still, a diagram) only where the words need them, 3–6 s each, returning to the take.
- The ending: the presenter's last line to camera, a beat of silence, the end card with the music.

## The cut

- The main take runs 60–180 s; inserts 3–6 s; the drone establishing 6–10 s; nothing under 2 s.
- Straight cuts to and from inserts only; a jump cut inside the take never (it is a single take); a slow fade to the end card.
- Camera: a locked or a slow-tracking medium wide of the presenter, eye level, the location filling the background, natural light; drone wides; a handheld detail insert.
- Grade: natural; the red shirt is the only designed element.

## Narration — the presenter

- The presenter's sync speech is the narration: second person, present tense, clear, quick, precise, British; a joke every minute, dry; 150–170 wpm. If generated: `generate_narration` voice leo, "quick, clear, British, matter-of-fact, slightly amused".
- No voice-over over the take; the inserts are narrated by the take's continuing audio.

## Sound

- Sync sound: the presenter (`muted: false`, `volume` 1) with the location's ambience (wind, water, a machine) live behind; no bed; music only in the end card (search "short upbeat sting library").
- The location sound stays under the inserts (the take's audio continues; the insert is `muted`).
- No sound effects.

## Picture — sources and text

- Sources: generated presenter shots ("a man in a red T-shirt standing in front of a large concrete dam, medium wide, overcast, natural light, 16:9, handheld-stable"), drone wides (archive or generated), archive stills and diagrams as inserts.
- Text: a short on-screen caption for a name or a number the first time (small sans, bottom-left, 2–3 s); a "correction" or a source in small type when needed; the end card (name, place, credits).

## Do not

- No cuts inside the take, no music under the speech, no dramatic drone move, no captions repeating the words, no b-roll for pace.
- No claim without a source in the description or on screen.
- No fake enthusiasm; the interest is in the fact.

## Harness parameters

asl 6–12 s overall (one take 60–180 s, inserts 3–6 s) · min shot 2 s · transitions cuts (inserts only) · narration required as sync speech, presenter to camera, 150–170 wpm · music none (end card only) · sync sync-first · text sparse (captions for names / numbers) · interviews direct-address · beat-cut no

## Applying it in SlopStudio

- Plan: one long shot (`sound: "sync"`) as the spine, split in the plan into segments where inserts go (the take's audio continues via an audio-only clip of the take under the inserts); inserts `sound: "muted"` 3–6 s; `music: null`.
- Cut: `split_segment` the take at the insert points and `add_segment audioOnly` the take's audio for continuity; `add_text_overlay` captions; `check_cuts` clean.
- Verify: `check_soundtrack` shows one sound bite spanning the piece and no bed — the style; `pacing_report` will show a long ASL — correct.
