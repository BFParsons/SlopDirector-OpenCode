# Buddha Jones — the dread

Work: trailers for *Nope*, *Get Out*, *Us*, *Hereditary*, *The Last of Us*, *The Walking Dead*, *A Quiet Place*; the horror-trailer house of the last decade.

## The signature

A pop song slowed and warped until it is a threat; a sound design that ticks, breathes and stops; a countdown of images — a hallway, a smile held a second too long, a shape in a window — with a black frame between each, and the tempo doubling until the title hits on silence. It explains nothing; it makes you watch the corners of the frame.

## Structure — how a trailer is built

- Act 1 (0–30 s): normality with something wrong; the song plays innocently; one line of dialogue; the first black.
- Act 2 (30–75 s): the rule of the horror hinted, never stated; the song degrades (pitch down, filter); the black frames come more often; a line that is a warning.
- Act 3 (75–105 s): the sound stops; a rhythmic sequence of 10–20 shots, each 0.5–1 s, each separated by black, the hits accelerating; silence; the title; a button (a scream, a smile, a door).
- Withhold the monster; show the reaction.

## The cut

- Average shot 1.5–3 s; act 3 0.4–1 s; black frames of 4–12 frames between shots in the rhythmic sequence; nothing under 0.15 s (a single black is fine).
- Straight cuts to and from black; no dissolves, no wipes; a slow push-in (`imageMotion`) on a still face.
- Shots end early — before the thing is seen; a shot may return two or three times, slightly longer each time.
- Grade: cool, desaturated, crushed blacks (`saturation` 0.75, `contrast` 1.2, `vignette` 0.35); one warm shot of normality at the start.

## Narration

- None. Two or three lines of dialogue, each a warning or a question, spoken over black.

## Sound

- Music is a **warped song**: a familiar pop or children's song, slowed, pitched down, reverbed, that becomes the trailer's pulse (search "slowed reverb cover", "music box eerie CC", "lullaby dark cover library"); or a pulse cue of sub-bass and ticks.
- Sound design is the cut: a tick, a breath, a rising whine, a heartbeat that doubles, then a hard stop; hits on every black in act 3 as audio-only clips (a low boom, a click); silence for 1–2 s before the title; the title lands with the loudest hit.
- Sync: the dialogue lines clean; ambience of the wrong place under act 1 (`muted: false` at 0.5).

## Picture — sources and text

- Sources: the film's footage; generated shots for a synthetic trailer ("a dark hallway, a figure standing perfectly still at the end, a single overhead light, 35 mm, desaturated, static wide"), faces reacting, doors, windows, a smile.
- Text: cards in a distressed or thin sans, white on black, 1–2 s, single words ("Watch." "Listen." "Run."); the title card 3–4 s; a date on black.

## Do not

- No monster reveal, no explanation, no jump-scare sting on every cut (one, at the end), no voice-over.
- No dissolves, no lens flares, no warm colour after act 1.
- No shot that finishes its action; every shot is interrupted by black.

## Harness parameters

asl 1.5–3 s (act 3 0.4–1 s with black) · min shot 0.15 s · transitions cuts-and-black · narration none · music required, warped song / pulse cue · sync mixed · text cards (single words) · interviews none · beat-cut yes (act 3 on the hits)

## Applying it in SlopStudio

- Plan: three beats; act 3 lists 10–20 shots of 0.4–1 s with a black `card` (0.15–0.4 s) after each and a hit on each; the title card and the button after silence.
- Cut: `apply_edit_list` for the rhythmic sequence; `add_segment audioOnly` hits at each black; `update_project saturation 0.75 contrast 1.2 vignette 0.35`; `check_beat_alignment` against the hit grid.
- Music: `set_music` the warped song; `balance_music` gap 5; `update_segments speed 0.8` on the song if it is placed as an audio-only clip instead, for the pitch-down.
