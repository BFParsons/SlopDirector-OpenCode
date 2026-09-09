# Jonathan Glazer — the sensory spot

Work: Guinness "Surfer" and "Swimblack", Levi's "Odyssey", Stella Artois "Ice Skating Priests", Sony Bravia "Paint"; music videos "Karma Police", "Virtual Insanity", "Rabbit in Your Headlights"; features *Under the Skin*, *The Zone of Interest*.

## The signature

Monochrome or near-monochrome, slow motion, one physical event that becomes a myth — waves become horses, a man runs through walls, paint explodes over a housing estate. A voice, if any, is a chant or a poem. The spot is a single sensation stretched to 60 s and cut to a rhythm you feel in the chest.

## Structure — how a spot is built

- One event, one location, one build: waiting → the event in slow motion → the aftermath; the product line as the last breath.
- The waiting is long (a third of the spot): faces, a held wide, a rhythm beginning under it.
- The event runs on the music's peak; the aftermath is quiet and quick.

## The cut

- Average shot 2–4 s; the build accelerates: 5 s → 3 s → 1.5 s → flurries of 0.5 s at the peak; then a 6–8 s hold. Nothing under 0.4 s.
- Straight cuts, cut on the drum; slow motion (`speed` 0.3–0.5) on the event, real time on the faces.
- Monochrome or a single-colour palette (`colorLook` mono / desaturated); heavy grain; high contrast; wide lenses close to bodies.
- Camera: static wides and handheld details; no drone.

## Narration

- A chant, a quotation, a few lines of poetry ("Tick, follow, tock, follow…"), spoken by a rough voice under the build; or nothing. 20–60 wpm, rhythmic, repeating one phrase.

## Sound

- Music is **rhythm**: drums, a tribal or industrial loop, a heartbeat that accelerates (search "tribal drums build library", "industrial percussion loop CC"); it is the spot's spine and the cuts sit on it (`check_beat_alignment`).
- Sync sound designed: the sea, breath, a crack — big, close, mono; audio-only clips at the beats.
- Silence before the peak (0.5–1 s), then the event lands with the loudest hit.

## Picture — sources and text

- Sources: generated shots ("black and white, slow motion, wave breaking, surfers waiting, heavy film grain, high contrast, wide lens"), archive of natural forces, faces close.
- Text: the line and the logo at the end on black, 3 s. Nothing else.

## Do not

- No colour for its own sake, no explanation, no product demonstration, no dialogue.
- No smooth dissolves; no orchestral swell (the drum is the swell).
- No cut that is not on a beat inside the build.

## Harness parameters

asl 2–4 s (accelerating) · min shot 0.4 s · transitions cuts · narration optional, chant, 20–60 wpm · music required, rhythm cue · sync mixed · text sparse · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: beats waiting / event / aftermath with shot durations that halve across the build; the event shots note `speed 0.4`; the chant is one `narration` line repeated with gaps.
- Cut: `update_segments speed` on the event; `colorLook` MONO, `grain 0.3`, `contrast +`; `check_beat_alignment toleranceFrames 2` must be mostly on grid.
- Music: `set_music` the drum loop; `balance_music` gap 3–4 (the drum is loud); `audioFadeOutS` 0.
