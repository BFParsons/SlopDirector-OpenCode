# Spike Jonze — the playful idea

Work: Ikea "Lamp", Apple HomePod "Welcome Home", Adidas "Hello Tomorrow", Gap "Khakis A Go-Go", Kenzo "My Mutant Brain"; music videos "Sabotage", "Weapon of Choice", "Praise You"; features *Being John Malkovich*, *Her*.

## The signature

One idea, taken completely seriously, until it is absurd. A lamp is thrown away and you feel sorry for it. An office worker dances through a hotel because the song is good. A woman in a party dress sabotages a gala. The camera is simple and honest; the joke is that nobody in the frame thinks it is a joke.

## Structure — how a spot is built

- Set up an ordinary situation in one shot (3–5 s). Introduce the idea. Follow it all the way; escalate twice; end on a deadpan turn (the Swede who tells you the lamp has no feelings; the product mentioned as an afterthought).
- The product is either the hero of the absurd idea or a footnote after it — never explained.
- 30–60 s; the idea needs room; do not cut to fit — trim the set-up.

## The cut

- Average shot 2–5 s; one continuous performance take of 8–20 s at the centre (a dance, a walk, a gesture) — the film's honesty depends on it.
- Straight cuts; a whip pan or a smash cut allowed once as a gag. No dissolves.
- Camera: eye level, wide-ish lens, handheld or simple dolly; no "beauty" shots; the location is real (a street, an office, a kitchen).
- Grade: natural; slightly warm; no vignette.

## Narration

- Rare: one deadpan voice at the end (accented, unimpressed, or a child's), 1–2 sentences. 0–30 wpm. The turn is spoken flatly.
- Dialogue in the spot is naturalistic and half-heard.

## Sound

- Music is a **song** or a sincere score: an emotional cue played straight under the absurd idea (a sad piano for the lamp), or a pop song the character dances to (search "melancholy piano CC", "funk instrumental library").
- Sync sound is part of the joke: the rain, the thump of the lamp, the shoes on the marble; keep it (`muted: false`) and mix the song under it.
- The music stops dead for the turn.

## Picture — sources and text

- Sources: generated performance shots ("medium wide, real office corridor, fluorescent light, a man in a suit dancing awkwardly, handheld 16 mm"), real locations, product on a table.
- Text: none inside; the logo or a plain line at the very end, 2–3 s.

## Do not

- No irony in the camera (no winks, no fast zooms, no comedy music); the actors and the idea are sincere.
- No montage of features; no voiceover explaining the idea; no slow motion for beauty.
- No fantasy environments; the strangeness happens in ordinary places.

## Harness parameters

asl 2–5 s (one long performance take) · min shot 0.7 s · transitions cuts · narration optional, deadpan, 0–30 wpm · music required, song · sync mixed · text sparse · interviews none · beat-cut optional

## Applying it in SlopStudio

- Plan: beats set-up / the idea / the escalation / the turn; the central shot is the long take (`durationS` 8–20, `sound: "sync"`); the turn is a `narration` line in the last 4 s or a `text` line.
- AI shots: `generate_ai_shots` with plain, real-location prompts; the performer's action stated simply.
- Music: `set_music` the sincere cue; `balance_music` gap 4–6; cut it with `update_project audioFadeOutS 0` and end the bed on the turn by trimming the music-bearing range or placing the cue as an audio-only clip.
