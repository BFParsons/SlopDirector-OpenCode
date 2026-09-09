# Tony Zhou — Every Frame a Painting

Work: *Every Frame a Painting* (with Taylor Ramos, 2014–16): "Edgar Wright — How to Do Visual Comedy", "Akira Kurosawa — Composing Movement", "The Marvel Symphonic Universe", "Jackie Chan — How to Do Action Comedy", "The Coen Brothers — Shot | Reverse Shot".

## The signature

A film editor explaining one idea about film form, with the films themselves as the evidence. A calm, precise voice; a clip shown, then shown again with the point marked (a freeze, a circle, a counter, a side-by-side); a joke exactly where the point lands. Nine minutes, one thesis, every clip cited on screen. The essay is cut like the thing it explains.

## Structure — how an essay is built

- The thesis in the first 30 s, stated plainly, with one clip that shows it.
- Three or four sections, each a facet of the thesis, each built as claim → clip → the clip again with the mark → the counter-example → the joke.
- A "look at this" moment: a clip played twice, the second time with sound removed or a graphic over it.
- The last section widens (why it matters), then a short coda: one clip, no words, the title.

## The cut

- Average shot 3–6 s; clips run 6–15 s when the point needs the whole beat; graphics 2–4 s; nothing under 1 s (except when the essay is about fast cutting — then the cut copies the subject).
- Straight cuts; a freeze-frame with a drawn mark (a circle, an arrow, a line) is the main device (`imageMotion` none, a `text` overlay or a card); a side-by-side comparison (V2 overlay track) for two clips.
- The essay's own cut imitates the subject when it is about editing: rhythm, whip pans, match cuts — then returns to plain.
- Grade: none (the clips are shown as they are, with their aspect ratio).

## Narration — the editor

- First person, present tense, plain, unhurried, specific: "Here's the shot. Now watch it again, and look at the door." 110–140 wpm, but with clips left to play un-narrated for 5–10 s at a time (the point must be seen).
- A joke is a flat line delivered straight ("It's a ceiling.").
- Voice: calm, conversational, not a presenter (`generate_narration` voice rex, "even, curious, unhurried").

## Sound

- The clips' **own sound** is the evidence (`muted: false`, `volume` 0.8 under narration, 1 when the clip plays alone); ducked under the voice.
- Music: light, from the films or library, only in the coda and under the sections' openings (search "light jazz piano library", "minimal guitar loop CC"); never under a clip's own music.
- No sound effects.

## Picture — sources and text

- Sources: the films discussed (archive, official channels, uploads; `licence` per the brief); graphics as `card` shots (a black card with the citation, 2 s) and text overlays (the mark, the counter).
- Text: the citation for every clip (film, year, small, bottom-left, 2–3 s: lower-third); the thesis and each section title as a plain card (white on black, sans, 2–3 s); marks over freezes; the counter ("cut 14") in a corner.

## Do not

- No clip without its citation; no narration over the key beat of the clip; no stock footage; no music under a clip's dialogue.
- No fast cutting for its own sake; no "content" pacing; no jokes without a point.
- No section that does not return to the thesis.

## Harness parameters

asl 3–6 s (clips 6–15 s) · min shot 1 s · transitions cuts (freezes, side-by-sides) · narration required, first-person editor, 110–140 wpm with gaps · music optional, light · sync sync-first (the clips) · text lower-thirds + cards · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: beats = sections; each section's shots follow claim / clip / clip-with-mark / counter / joke; clips `sound: "sync"`; every clip's description names its citation; the mark as a `text` line on the freeze.
- Sourcing: `youtube_captions` to find the exact beat in each film before importing only that section.
- Cut: `add_text_overlay` citations (OUTLINE, bottom-left, 2.5 s) and marks; `split_segment` for the freeze (a 1–2 s shot with `speed 0.01` or a still); overlays on track 1 for side-by-sides.
- Music: `set_music` only for the coda, or none; `balance_music` gap 8.
