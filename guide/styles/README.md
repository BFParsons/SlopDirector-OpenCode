# Directing styles

A style is a real filmmaker's (or house's) way of building a piece, written as instructions the harness can follow and check. The brief names one (`production.style.id`, asked in the interview after the genre); the plan is checked against its parameters (`check_plan`), the cut against its pacing (`pacing_report`) and its sound policy (`check_soundtrack`), and the agent reads the file with `get_style` before writing the plan. `src/lib/styles/index.ts` holds the mechanical parameters; each file here holds the prose.

Every file has the same sections: the signature · structure · the cut · narration · sound · picture and text · do not · type (generated from `src/lib/typography/styleType.ts` by `scripts/gen-style-type.ts`: the surveyed faces, the stand-ins, the case, the roles) · harness parameters · applying it in SlopStudio.


## Documentary

- [Adam Curtis](adam-curtis.md) — the archive essay: raided archive, an essayist's narration, found music against the picture, hard cuts to black
- [Michael Moore](michael-moore.md) — the first-person polemic: sardonic narration, ironic pop against grim archive, confrontations with sync sound
- [Errol Morris](errol-morris.md) — the interrogation: subjects speak straight to the lens, stylised reenactments, a minimalist looping score, no narrator
- [Ken Burns](ken-burns.md) — the chronicle: photographs that move, a measured narrator and a chorus of letters, period music, dissolves
- [Werner Herzog](werner-herzog.md) — the ecstatic truth: long takes, the director's own meditative voice, choral music, silence, the unanswerable question
- [Frederick Wiseman](frederick-wiseman.md) — the observation: no narrator, no music, no text, no interviews — long sequences of sync sound inside an institution
- [Humphrey Jennings](humphrey-jennings.md) — the country listening: sequences of real sound handed one to the next, found music from inside the picture, no commentary
- [LEMMiNO](lemmino.md) — the dark documentary: maps, documents and photographs on black, a calm archivist's narration, an ambient score

## Advertising

- [Ridley Scott](ridley-scott.md) — the cinematic spot: an epic world, one figure who breaks the pattern, the product arriving late and once
- [Spike Jonze](spike-jonze.md) — the playful idea: one absurd premise taken completely seriously, a sincere song, a deadpan turn
- [Jonathan Glazer](jonathan-glazer.md) — the sensory spot: monochrome, slow motion, one physical event become a myth, a drum that the cut sits on
- [Hal Riney](hal-riney.md) — Morning in America: soft sunlit moments, a warm neighbourly voice with numbers folded in, strings that climb

## Music video

- [Michel Gondry](michel-gondry.md) — the handmade loop: the song's structure made visible, one rule per element, repetition that grows
- [Hype Williams](hype-williams.md) — the gloss: fisheye, saturated colour per section, split screens, the performer at the centre of a bending world
- [Anton Corbijn](anton-corbijn.md) — the grain: black and white, a performer alone in a landscape, the band to camera in a bare room, still frontal portraits
- [Chris Cunningham](chris-cunningham.md) — the uncanny: a bleak real place, something slightly wrong, a drop cut to the track's stutters, technically exact

## Dramatic scripted

- [Wes Anderson](wes-anderson.md) — the diorama: planimetric symmetry, chapter cards, whip pans, deadpan faces, a storybook narrator, found 1960s pop
- [Christopher Nolan](christopher-nolan.md) — the clockwork: parallel strands intercut faster and faster, enormous steady images, a score that only rises
- [Denis Villeneuve](denis-villeneuve.md) — the monolith: a tiny figure against something vast, shots held past information, a drone score, one hue per world
- [Edgar Wright](edgar-wright.md) — the snap: every cut on a sound, whip pans and crash zooms, a diegetic song the world moves on, set-ups that pay off
- [Terrence Malick](terrence-malick.md) — the whisper: magic hour, a drifting camera, fragments of a day, a whispered question to someone absent, choral music

## Patriotic, political and propaganda

- [Frank Capra](frank-capra.md) — the case for the fight: the enemy's own footage turned against him, a neighbourly narrator with numbers, maps that move, contrast pairs
- [Sergei Eisenstein](sergei-eisenstein.md) — the collision: meaning made by hitting two shots together, motifs returning faster, overlapping action, intertitles
- [Tony Schwartz](tony-schwartz.md) — the responsive chord: one image, one sound, one implication — the audience completes the message
- [The Lincoln Project](lincoln-project.md) — the prosecution: the subject's own words against the pictures of what they cost, a grim narrator, bold captions, a dread cue

## Trailers and teasers

- [Mark Woollen](mark-woollen.md) — the mood piece: a slow choral cover, quiet images, dialogue as poetry, black between lines, the title when the song breaks
- [Buddha Jones](buddha-jones.md) — the dread: a warped pop song, black frames between accelerating shots, a sound that stops, the monster withheld
- [AV Squad](av-squad.md) — the blockbuster rise: a cold open, a riser that never stops, tempo doubling to a beat-locked money sequence, a stopdown, the title, a button
- [A24](a24.md) — the cryptic teaser: shows almost everything, tells almost nothing — one sound idea, one typeface, the film sold as an object
- [Anaïs Bimpel](anais-bimpel.md) — the rhythmic trailer: the picture's own sounds sequenced into the beat, the cue entering late already in time

## Video essay and explainer

- [Tony Zhou](tony-zhou.md) — Every Frame a Painting: one idea about film form, the clips as evidence shown twice with the point marked, every clip cited
- [Johnny Harris](johnny-harris.md) — the map essay: a journalist in front of a paper wall, label-free maps that zoom and orbit, kinetic type that answers the narration

## Comedy

- [Christopher Guest](christopher-guest.md) — the mockumentary: sincere interviews in front of a wall, stolen observational footage, the joke in the gap and the pause

## YouTube creators

- [MrBeast](mrbeast.md) — retention: the premise in the first sentence, a new visual event every few seconds, risers and hits on every reveal, nothing skippable
- [Casey Neistat](casey-neistat.md) — the cinematic vlog: a day told like a short film — wide-angle walking, time-lapses, jump-cut monologues, a track the day is cut to
- [MKBHD](mkbhd.md) — the clean review: a dark studio with one red accent, gliding macro b-roll, a calm exact voice, specs on screen when spoken
- [Tom Scott](tom-scott.md) — the single take on location: one presenter, one place, one idea, no cuts if he can help it, no music until the end card
- [Veritasium](veritasium.md) — the misconception: what everyone believes said on camera, a demonstration that contradicts it, diagrams drawn on the words
- [Vsauce](vsauce.md) — the tangent: a simple question walked backwards through five others, engravings and props, snap zooms, a plucked eerie bed
- [Mark Rober](mark-rober.md) — the build: problem, plan, build montage, a test that fails, a fix, slow-motion success, a payoff seen from the air
- [Emma Chamberlain](emma-chamberlain.md) — the chaotic self-edit: snap zooms on her own mistakes, sound effects on a sip, captions that argue with her, outtakes as commentary
- [Peter McKinnon](peter-mckinnon.md) — the cinematic vlog: every shot a moving photograph — shallow depth, speed ramps, whip pans that land on the next scene, a warm LUT

## Adding a style

Write `guide/styles/<id>.md` in the same sections, then add a `style(...)` entry in `src/lib/styles/index.ts` with the parameters that mirror the file's *Harness parameters* line. The interview offers the style for any genre its regex matches; `list_styles` shows the registry.
