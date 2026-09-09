# Edgar Wright — the snap

Films: *Shaun of the Dead*, *Hot Fuzz*, *Scott Pilgrim vs. the World*, *Baby Driver*, *Last Night in Soho*; TV *Spaced*.

## The signature

Everything is cut to a sound. A kettle click becomes a car door; a cash-register beep becomes a doorbell. The mundane is shot like an action film: whip pans, crash zooms, a four-shot montage of pouring a drink. Music is diegetic and the world moves on its beat — footsteps, wipers, gunshots on the snare. The comedy is in the rhythm and the repeat.

## Structure — how a scene is built

- A routine shown fast (the montage of getting ready: 8 shots in 4 s), then the same routine with one thing wrong; then the payoff, where an earlier gag returns transformed.
- A song runs through the scene and the action is choreographed to it; the scene ends when the song does.
- Every set-up pays off inside the scene; nothing is introduced that does not return.

## The cut

- Average shot 1–3 s; montages 0.3–0.6 s a shot (RULES 9: deliberate); dialogue two-shots 3–5 s. Cuts on sound effects and on the beat.
- Whip pans (from the source or a fast in-frame move), crash zooms (`imageMotion` fast push), wipes that follow an object; a smash cut on a sound; dissolves never.
- Camera: fast dolly, snap zoom, tracking through doors; the frame is busy and precise; a Steadicam one-er (15–30 s) once per scene as the centrepiece.
- Grade: saturated, punchy, clean; British daylight; no vignette.

## Narration

- None. The dialogue is quick and overlapping; a bite is a set-up line that will return.

## Sound

- Music is a **song**, diegetic (a radio, a jukebox, headphones): the cut and the action hit its beats (`check_beat_alignment` 2 frames); the song is the clock of the scene (search "garage rock instrumental library", "funk breakbeat CC", "1970s soul instrumental").
- Sound effects are the transitions: every cut in a montage has its own hit (a click, a slam, a whoosh) as an audio-only clip; the sound leads the picture by 1–2 frames.
- Sync dialogue kept (`muted: false`); the song ducks lightly under it.

## Picture — sources and text

- Sources: generated shots of ordinary actions ("crash zoom to a hand slamming a kettle, kitchen, morning light, 35 mm, saturated"), archive of the mundane, one long take.
- Text: on-screen graphics that are part of the world (a text message in a bubble, a sound-effect word, a scoreboard) — 1–2 per scene, snappy, 1–2 s; no lower-thirds.

## Do not

- No cut without a sound; no slow dissolves; no shaky handheld realism; no naturalistic pauses.
- No music that is not in the scene; no montage that does not repeat later.
- No gag explained by dialogue.

## Harness parameters

asl 1–3 s (montages 0.3–0.6 s) · min shot 0.2 s (deliberate) · transitions cuts (whips, wipes, smashes) · narration none · music required, song (diegetic) · sync sync-first · text kinetic · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: montage beats list 6–10 shots with durations 0.3–0.6 s and a sound effect each; the centrepiece is one shot of 15–30 s `sound: "sync"`; the payoff repeats an earlier shot id.
- Cut: `apply_edit_list` for the montage; `add_segment audioOnly` for each effect (offset = the cut); `update_segments imageMotion` push for the crash zooms; `check_beat_alignment toleranceFrames 2`.
- Music: `set_music` the song; `balance_music` gap 3 (it is in the room); `audioFadeOutS` 0.
