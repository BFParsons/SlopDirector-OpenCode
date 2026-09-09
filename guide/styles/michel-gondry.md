# Michel Gondry — the handmade loop

Work: Björk "Human Behaviour" and "Bachelorette", Daft Punk "Around the World", Kylie Minogue "Come Into My World", The White Stripes "Fell in Love with a Girl" and "The Hardest Button to Button", Chemical Brothers "Star Guitar"; features *Eternal Sunshine of the Spotless Mind*.

## The signature

The song's structure made visible, by hand. Each instrument is a character; each bar is a loop; each chorus a multiplication. A street repeats and the singer is cloned every time she passes; the scenery of a train ride lands on the beat; a drum kit multiplies across a city. Effects are done in camera or in the edit, never as gloss.

## Structure — how a video is built

- Find the song's system (verse / chorus / bridge, the instruments, the count) and give each element a visual rule. Write the rule down before choosing a shot ("every snare: a new copy of the object").
- The video is a loop that grows: the first pass is plain; each repeat adds one thing; the bridge breaks the rule; the last chorus is the full stack.
- No story beyond the rule; the pleasure is watching the rule hold.

## The cut

- Cuts on the beat or on the bar; average shot equals a bar or a half-bar at the song's tempo (at 120 BPM, 2 s or 1 s). Cuts are on the grid to the frame (`check_beat_alignment`).
- Straight cuts. Repetition of the same shot with one change is the main device; a shot may recur 8–16 times.
- Camera locked or on a strict rail; the same framing every pass; the change is inside the frame.
- Speed changes and reverse are allowed when they are the rule (`speed` 2 on the double-time section).

## Narration

- None. The lyric is the text.

## Sound

- The **song** is the whole soundtrack; no sync sound, no effects unless they are in the record. The bed is the track at full level (`set_music` volume 1, ducking off).
- The cut is built from the song's map: `analyze_audio` / `detect_tempo` for the grid; the plan lists the bars.

## Picture — sources and text

- Sources: generated shots that can repeat exactly (static frame prompts, the same seed, one variable), archive with a strong repeating motion (trains, factories, loops), stills animated by the rule (pixilation: a new still per beat).
- Text: none, except the lyric as an on-screen object when it is the rule.

## Do not

- No cut off the grid; no drift in the rule; no "beauty" cutaway that has no place in the system.
- No dissolves, no lens flares, no colour grade beyond a flat, slightly saturated look.
- No narrative that needs explaining.

## Harness parameters

asl 1–2 s (one bar) · min shot 0.25 s (a beat) · transitions cuts · narration none · music required, the song · sync muted · text none · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: `notes` state the rule; beats are song sections with bar counts; shots are one bar each with the recurrence written in the description ("copy 3 of 8").
- Cut: `apply_edit_list` from a bar grid (start = bar × 60/BPM × 4); `check_beat_alignment toleranceFrames 1` must be nearly 100 % on grid.
- Music: `set_music` the track, `volume 1`, `ducking false`; nothing else on the sound.
