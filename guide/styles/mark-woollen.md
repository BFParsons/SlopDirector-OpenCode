# Mark Woollen — the mood piece

Work: trailers for *The Social Network*, *A Serious Man*, *The Tree of Life*, *Gone Girl*, *12 Years a Slave*, *Little Children*, *Schindler's List* (re-release), *A Hidden Life*; Mark Woollen & Associates.

## The signature

A trailer that maps the film's mood, not its plot. A choir sings a slow cover of a pop song; ordinary images (a screen, a hand, a field) run under it for a minute before anyone speaks; dialogue is used as poetry — one line, then silence, then a card; the title arrives when the song breaks. It sits you in the film's world and withholds the story.

## Structure — how a trailer is built

- Act 1 (0–40 s): the world, in quiet images under the song's first verse; one line of dialogue that is a question or a confession; a card ("From the director of…") only if it earns the pause.
- Act 2 (40–90 s): the fracture — the song's chorus lifts; dialogue lines alternate with silent shots; the cut quickens slightly; a card with one word or a date.
- Act 3 (90–120 s): the song strips back to a single voice or drops out; a sequence of 6–10 wordless shots; the title on black; one last line or image as a button.
- No montage of the film's best moments; no stakes explained.

## The cut

- Average shot 2–4 s; act 1 holds 4–6 s; act 3 quickens to 1.5–2 s; nothing under 0.8 s.
- Straight cuts, and cuts to black (0.5–1 s) between lines — the black is the trailer's breath; a dissolve never.
- Sound leads: a line of dialogue starts over black, the picture follows; a shot ends on a sound, not a movement.
- Grade: the film's own; no trailer-house sweetening.

## Narration

- None. Dialogue lines only: 6–10 in two minutes, each one alone, each a complete thought; a card may carry a line ("You don't get to 500 million friends without making a few enemies.").

## Sound

- Music is a **cover**: a slow, sparse, choral or solo-voice version of a known song, starting quietly, building, ending in a cliff (search "choir cover slow" + a title, "solo piano cover CC", "cinematic cover version library"); it is the trailer's spine and the cuts follow its phrases, not its beats.
- Sync dialogue at full level, clean, with the room; the song ducks under lines and returns in the gaps.
- Sound design: one designed silence before the title; a low hit under the title; no braams, no risers.

## Picture — sources and text

- Sources: the film's footage (uploads or the project's own shots); for a generated trailer, quiet images of the world (a room, a walk, a screen) rather than action.
- Text: cards in a thin serif or the film's type, white on black, 2–3 s: a quote, a date, a name; the title card 3–4 s; nothing over picture.

## Do not

- No voice-over ("In a world…"), no explanation, no braam, no riser, no fast montage, no dissolve, no lower-thirds.
- No line of dialogue that gives away the plot; the lines are mood.
- No card that says what the picture already says.

## Harness parameters

asl 2–4 s (act 1 holds 4–6 s) · min shot 0.8 s · transitions cuts-and-black · narration none · music required, cover song · sync sync-first (dialogue) · text cards · interviews none · beat-cut no (phrase-cut)

## Applying it in SlopStudio

- Plan: three beats with the song's structure written in `notes` (verse / chorus / strip-back); dialogue bites as `script` `bite` lines with `atS`; cards as `card` shots with `transition: "fadeToBlack"` before them; the title as the last card.
- Cut: `apply_edit_list` with black gaps (a `card` shot with empty text, 0.5–1 s); `check_cuts` clean on every bite.
- Music: `set_music` the cover; `balance_music` gap 4; `audioFadeOutS` 0 (the song ends on its own cliff, trimmed to land on the title).
