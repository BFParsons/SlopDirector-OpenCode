# Anaïs Bimpel — the rhythmic trailer

Work: the "rhythmic trailer" trend — trailers and spots cut so that the picture's own sounds (a door, a step, a gunshot, a breath) become the beat of the music; work through the LA trailer houses on studio campaigns and streaming spots.

## The signature

The trailer is a piece of music made from the film's sound effects. A car door, a footstep, a slap, a cash drawer, a heartbeat — each a percussion hit, sequenced into a rhythm that grows into the cue. The picture cuts on its own sounds; the music enters late, already in time with them; the tempo builds to a drop where the score takes over and the images go wide.

## Structure — how a trailer is built

- Part 1 (0–25 s): the situation — 4–6 shots with a single sound each, spaced widely (a rhythm at 60–70 BPM), no music.
- Part 2 (25–60 s): the obstacle — the sounds double (two hits per bar), a pulse enters under them, a line of dialogue lands on a rest.
- Part 3 (60–90 s): the drop — the cue takes over the rhythm, the shots go wide and short, sound effects continue on the downbeats; a stopdown; the title on a final hit made from a picture sound (a door slam).
- Notebook first: set up a character and a situation, then a conflict, then pace and style; choose a music selection for each part.

## The cut

- Average shot 1.5–3 s in part 1, 1–2 s in part 2, 0.5–1 s in part 3; nothing under 0.25 s.
- Every cut is on a sound from the picture; the sound may be pulled 2–4 frames ahead of the cut; the same sound may be repeated as a stutter (3 quick cuts) once per part.
- Straight cuts; a black frame after the loudest hit; no dissolves.
- Grade: the film's; a slight lift of contrast for the drop.

## Narration

- None. Dialogue lines are placed on rests in the rhythm (silence around them, 0.5 s each side).

## Sound

- The **rhythm** is built from the shots' own sounds (`muted: false` on the hit shots, `volume` 1.2; or the sound extracted and placed as an audio-only clip on the grid); a metronome grid is set first (`analyze_audio` on the chosen cue for its BPM, or a chosen tempo).
- Music is a **cue** that enters in part 2 already on the grid (search "trailer percussion build library", "minimal pulse cue CC", "hybrid trailer drop"); it must match the picture-sound tempo — pick the cue for the tempo, not the tempo for the cue.
- Silence is a rest: at least one bar of nothing before the drop.

## Picture — sources and text

- Sources: the film's footage with strong single sounds; for a synthetic piece, generated shots of actions with a clear sound ("a hand slamming a car door, close, dusk, 35 mm"), wides for the drop.
- Text: cards on the rests (2–3 words, bold sans, 1–1.5 s); the title on the final hit; nothing over picture.

## Do not

- No cut without a sound; no sound without a cut; no music before the rhythm is established.
- No dissolves, no long dialogue, no voice-over, no wall-to-wall score.
- No tempo change except the doubling between parts.

## Type

**The signature.** Condensed bold capitals on the rests, the title on the final picture-sound.

**Stand-ins.** Oswald Bold for the condensed trailer gothics. Faces: Oswald 700. Case: upper. Colour #FFFFFF on #000000. Entrance: pop.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — two or three words on a rest. Oswald Bold · capitals · 5.5 % · pop · hold 1.5 s.
- **title** — the title on the last hit. Oswald Bold · spaced capitals · 9 % · pop.

**Never:** lower-third, quote, citation, label, intertitle, callout.

**Survey note.** Assumption: the rhythmic trailers use the trailer houses' condensed gothics.

## Harness parameters

asl 1–3 s (part 3 0.5–1 s) · min shot 0.25 s · transitions cuts · narration none · music required, cue entering late · sync sync-first (the picture's sounds are the beat) · text cards · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: three beats with the BPM written in `notes`; each shot's description names its sound; part 1 shots on beats 1 of each bar, part 2 on 1 and 3, part 3 on every beat; dialogue on rests.
- Cut: `apply_edit_list` from the grid; `update_segments muted:false volume 1.2` on hit shots (or `add_segment audioOnly` for extracted sounds); `check_beat_alignment toleranceFrames 1` on the whole piece.
- Music: `set_music` the cue placed as an audio-only clip at the part-2 entry (offset on the grid) so it starts late; or `set_music` with the cue trimmed to begin at the entry.
