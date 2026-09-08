# Music-driven montage

**Goal.** Shots cut to a music bed's structure and beat (ch.19, ch.28).

1. Music first: `set_music` (or `list_media` for an existing bed); `analyze_audio` kinds tempo → bpm and beat grid; note the phrase boundaries (every 16 beats in 4/4 is a reasonable first guess; listen for drops and rests).
2. Map the energy: where the music rises, drops and rests decides where the montage turns (rule 17–18). Decide which is master: for a montage, the music.
3. Choose shots that each mark a distinct step (rule: every shot has a specific reason). `get_contact_sheet` across the sources; `detect_scenes` to find the shots.
4. Plan durations from the beat grid: cut on phrase boundaries first, then on beats for two or three shots, then across, then back (rule 18). Break the pattern at least once with a longer hold.
5. `apply_edit_list` with the shots — every shot muted (the default): the music is the soundtrack; keep a shot's sound only for a deliberate hit or a line, and only from a source without its own music. Narration, if any, as audio-only clips (they duck the bed). `check_soundtrack`; if there is narration, `balance_music` (gapLu 4–6: the music is a co-star) — then `check_beat_alignment` — nudge `durationS` of the preceding shot by the reported offset to land the cuts you mean to land; keep the off-grid ones on purpose.
6. End the music on picture: set `audioFadeOutS` or trim the last shot so the cue resolves, never trails.
7. `render_draft`; `check_mix_levels` (musicDriven true); `pacing_report`; `verify_export`. Report the beat map and the cut list.
