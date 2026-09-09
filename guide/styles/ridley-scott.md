# Ridley Scott — the cinematic spot

Work: Apple "1984", Hovis "Bike Round" (1973), Chanel No. 5 "Share the Fantasy", Pepsi "Archaeology"; features *Blade Runner*, *Gladiator*.

## The signature

A commercial shot like the first two minutes of an epic. Smoke, backlight, shafts of light through dust, a crowd moving in unison, one figure who breaks the pattern. The product arrives late and once. The picture is so large that the spot needs almost no words.

## Structure — how a spot is built

- One image-idea, told as a myth: a world in order, a disruption, a release. 30 s: 8 s world, 14 s disruption, 6 s release and the line, 2 s logo.
- No dialogue; one voice at the end (a line or a slogan), or a single on-screen sentence.
- The product is the release, not the subject: it appears in the last 20 % of the running time.

## The cut

- Average shot 2–4 s in the build, one long shot (6–10 s) at the centre, quick cuts (1–1.5 s) at the release. Nothing under 0.7 s.
- Straight cuts. One slow dissolve allowed to open. No wipes, no whip pans.
- Wide shots dominate; every third shot is a detail (a face, a hand, a machine part) lit from behind. Camera moves are slow and mechanical (dolly, crane), never handheld.
- Grade: smoky teal and amber; deep blacks; `colorLook` cinematic, `vignette` on, `grain` light.

## Narration

- Almost none: a single line of copy at the end, spoken low and slow (`generate_narration` voice leo), or on-screen text only. 10–25 words in 30 s.

## Sound

- Music is a **score**: orchestral or synth, slow build, one hit at the release (search "epic orchestral build library", "synth swell cinematic CC"). It carries the spot; ducking only for the closing line.
- Sync sound: designed effects (wind, machinery, footsteps in unison, a shatter) as audio-only clips at the beats; no location chatter.
- Silence for 0.5–1 s before the release beat.

## Picture — sources and text

- Sources: generated shots ("wide shot, cavernous industrial hall, hundreds of identical figures, volumetric backlight through smoke, anamorphic, 35 mm, teal and amber"), archive of crowds and industry, product shots on black.
- Text: one sentence of copy at the end, centred, serif or clean sans, 3–4 s; then the logo on black.

## Do not

- No jokes, no presenter, no montage of happy customers, no lower-thirds.
- No product before the release; no packshot longer than 3 s.
- No handheld, no natural-light realism, no pop song.

## Harness parameters

asl 2–4 s (one hero hold) · min shot 0.7 s · transitions cuts · narration optional, third person, 10–50 wpm · music required, score · sync muted · text sparse · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: three beats (world / disruption / release); the release beat's first shot is the product; the `script` has one `narration` or one `text` line at the end.
- AI shots: `generate_ai_shots` with the prompt shape above; 4–6 s each, wides first.
- Music: `set_music` a building cue; `balance_music` gap 4; `audioFadeOutS` 0 (the logo lands on the hit); `check_beat_alignment` on the release cuts.
- Grade: `update_project colorLook` cinematic, `vignette 0.3`, `grain 0.1`.
