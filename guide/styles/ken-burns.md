# Ken Burns — the chronicle

Films: *The Civil War*, *Baseball*, *Jazz*, *The War*, *The Vietnam War*, *The American Revolution*.

## The signature

Photographs that breathe. The camera drifts across a still, finds a face, rests. A measured narrator tells the story in the third person; then a letter or a diary, read in the first person by another voice, with the writer's name and date spoken or shown. Period music, played on period instruments, under nearly everything. Dissolves between images; fades to black at the end of a chapter. Lit, unhurried talking heads who speak as if remembering.

## Structure — how a scene is built

- The scene is a chapter: it opens on a wide (a landscape, a map, a street), states its date and place in the first line, and moves through 3–5 images per idea.
- A first-person document sits at the centre of the scene: a letter, a report, a diary entry, read by a different voice, introduced by the narrator ("…wrote to his wife.") and closed with the name ("— Sullivan Ballou").
- Talking heads (one or two per scene, 10–20 s each) interpret, never narrate facts.
- The chapter ends on an image held over the last line of music, then a fade to black.

## The cut

- Average shot 6–12 s; a still with motion needs 6 s minimum to breathe; nothing under 3 s.
- Stills carry `imageMotion`: a slow pan to a face, a slow push-in on a detail, a slow pull-out from a detail to the whole. One move per image; it starts and ends on something.
- Dissolves (1–2 s) between images inside a beat; a straight cut into and out of a talking head; fade to black (2–3 s) at the chapter's end only.
- Archive film, when it exists, is treated as a still would be: slowed slightly, held, not chopped.

## Narration — two voices

- The narrator: third person, past tense, even, unhurried, never ironic; sentences of 10–18 words; place and date early ("In the spring of 1862, at Shiloh, …"). Numbers are spoken as people ("thirteen thousand men"). 70–105 words a minute overall, with room for the readings.
- The readings: first person, in the writer's register, introduced by the narrator and signed at the end; a different voice (`generate_narration` a second voice — the narrator sal or leo, the readings ara, eve or rex depending on the writer).
- No questions, no "imagine", no judgement; the sadness is in the facts and the music.

## Sound

- Music is **period**: fiddle, piano, brass band, hymns, a solo violin — of the story's own time and place, sparse and acoustic (search "traditional fiddle 1860s", "solo piano hymn public domain", "brass band march 1900s", CC / public-domain recordings).
- The bed runs under narration and readings (ducking on, gap 6–8) and comes up on the image holds; it ends with the chapter (`audioFadeOutS` 3–4).
- Sync sound is rare: a talking head's room; an archive film's own sound as a texture under narration at −20 dB; ambient beds (birds, wind, a crowd) added as audio-only clips under stills.

## Picture — sources and text

- Sources: photographs (archives, libraries, museums; YouTube compilations of stills from official channels; uploads), paintings and maps, archive film, produced talking heads (generated: soft key light, dark neutral background, three-quarter angle, the speaker looking just off lens).
- Text: sparse — a name and a date under a reading, in a serif face, lower-left, 3 s; a chapter title card only at the start of a standalone piece.

## Do not

- No fast cutting, no music with drums, no modern stock footage, no drone shots.
- No irony, no first-person filmmaker, no confrontation.
- No image that moves without a reason (a move that starts nowhere and ends nowhere).
- No still that is cropped so hard it loses its grain and period.

## Type

**The signature.** A book serif in the period's manner: names and dates lower-left under a reading, chapter titles in spaced capitals, ivory on black, slow fades.

**Stand-ins.** EB Garamond for the Garamond-class serifs of the PBS films. Faces: EB Garamond 400, EB Garamond 700. Case: sentence. Colour #F2E9D8 on #000000. Entrance: fade.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **date (default)** — the writer's name and the date under a reading. EB Garamond · 3.6 % · bottom-left · shadow 3 % · hold 3.5 s.
- **quote** — a line of a letter over the photograph. EB Garamond · 4.2 %.
- **card** — a chapter title in spaced capitals on black. EB Garamond · spaced capitals · 4.6 % · hold 4 s.
- **label** — a talking head's name, once. EB Garamond · 3.2 % · bottom-left · shadow 3 %.
- **title** — the film's title. EB Garamond Bold · spaced capitals · 7 %.

**Never:** caption, callout, lower-third, intertitle.

**Survey note.** Assumption: the exact faces vary by film and were not documented in the survey; the manner (serif, ivory, lower-left names, spaced capitals for titles) is consistent across the PBS films.

## Harness parameters

asl 6–12 s · min shot 3 s · transitions dissolves · narration required, third person + readings, 70–105 wpm · music required, period · sync muted · text sparse · stills yes · interviews produced

## Applying it in SlopStudio

- Plan: shots with `source.type: "upload"` or `"youtube"` stills, description naming the move ("push-in to the boy's face"); `transition: "dissolve"` inside beats, `"fadeToBlack"` on the last shot of a standalone chapter (not on a scene of a longer film); readings are `narration` lines with `note: "reading — voice ara"`.
- Cut: `update_segments imageMotion` on stills; `update_project transition DISSOLVE transitionMs 1500` for the beat interiors.
- Music: `set_music` a period track; `balance_music` gap 7.
- Verify: `pacing_report` with the style (the norm is 6–12 s); `check_cuts` will not complain about dissolves here.
