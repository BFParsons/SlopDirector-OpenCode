# Tony Schwartz — the responsive chord

Work: "Daisy" (Johnson 1964), "Ice Cream" (1964), hundreds of radio spots; the book *The Responsive Chord*. He was a sound man: the picture serves the sound.

## The signature

One image, one sound, one implication. A child counts petals; a voice counts down; a flash; a voice says "these are the stakes". The opponent is never named; the audience supplies the rest from what they already fear or hope. Thirty seconds, and most of it is silence, a child's voice and a countdown.

## Structure — how a spot is built

- The chord: pick the feeling the audience already has (a fear, a hope), and find the one sound that strikes it (a child, a heartbeat, a phone ringing, a countdown).
- Build: 15–20 s of the ordinary sound and image; the turn (3–5 s: the countdown, the flash, the silence); the resolution: a calm voice states the choice in one or two sentences; the name and the date.
- Never state the accusation; the picture and the sound imply it.

## The cut

- Very few shots: 3–6 in 30 s; the opening hold 8–15 s (a child, a face, a kitchen); the turn a single hard cut, or a zoom into the eye (`imageMotion` slow push to black); the end a still or black with text.
- Straight cuts; a slow push-in as the tension rises; black for 1–2 s at the turn.
- Camera: static or a slow push; natural light; a real place; no glamour.
- Grade: natural, slightly desaturated; or monochrome for the turn.

## Narration

- Two voices: the ordinary (a child counting, a woman on the phone) as sync; and the calm authority at the end, 20–40 words, slow, low, unhurried: "These are the stakes. To make a world in which all of God's children can live, or to go into the dark. We must either love each other, or we must die." (`generate_narration` voice leo, "grave, calm, not dramatic").
- No narration in the build; the sound does it.

## Sound

- The sound is the spot: the child's voice (`muted: false`, `volume` 1), then the countdown (an audio-only clip, a flat male voice), then silence (1–2 s), then the explosion or the hit, then the calm voice; no music, or a single low drone under the end (search "low drone sustained CC").
- Room tone and silence are composed, not left; the silence before the hit is the loudest moment.

## Picture — sources and text

- Sources: one generated or archive shot of the ordinary (a child in a field, a phone on a table, a kitchen); one image of the stake (a mushroom cloud, an empty crib, a door) as archive or a still; black.
- Text: the choice and the date on black at the end (plain sans, 4–5 s): "Vote for President Johnson on November 3."

## Do not

- No montage, no music bed, no naming the opponent, no statistics, no explanation.
- No second idea; no cutaway that adds information; no fast cut.
- No voice that sounds like an announcer in the build.

## Harness parameters

asl 5–10 s (3–6 shots) · min shot 1 s · transitions cuts (one push to black) · narration required at the end only, calm authority, 40–80 wpm in its window · music none (a drone allowed) · sync sync-first · text cards · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: three beats (ordinary / turn / choice); the ordinary shot 8–15 s `sound: "sync"`; the turn a `card` (black) or a still with `imageMotion` push; the choice as one `narration` line and one `text` line.
- Cut: `update_segments imageMotion` slow push on the ordinary shot; `add_segment audioOnly` the countdown and the hit; `update_project audioFadeOutS 0`.
- Verify: `check_soundtrack` will warn "nothing but sync and one narration" — the style; `detect_silences` on the draft must show the composed silence, not a gap.
