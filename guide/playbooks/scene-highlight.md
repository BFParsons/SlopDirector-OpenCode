# Highlight reel from shots

**Goal.** A short, watchable selection of a longer piece: the best of each shot, in order, at a target length (ch.16, ch.19).

1. `create_checkpoint`. `detect_scenes` (threshold 0.3–0.4) and `get_contact_sheet` across the whole clip; `detect_silences` if there is speech.
2. Decide the target length and the pace (rule 10: vary durations; rule 13: enter late, leave early). For N shots and T seconds, plan per-shot durations that sum to T but are not all equal — longer on the shots that carry information, shorter on the ones that only carry energy.
3. For each kept shot, choose an in-point inside movement or after the frame settles (look at `get_frame` at shot start + 0.5 s). Avoid the first and last 6 frames of a shot (camera settles, cut residue).
4. Decide the sound first (rule 25): a highlight under music mutes every shot (the tool's default); a highlight that lives on its sync sound keeps `muted:false` only for shots whose source has no music or narration of its own. `apply_edit_list` with one `add_segment` per shot (`trimStartS`, `durationS`, `muted`). Straight cuts unless the piece has a named reason for a transition (rule 8).
5. `check_soundtrack` — no clashes — then continue.
6. `render_draft`; `pacing_report` (compare against the genre norm); `check_cuts`; `detect_scenes` on the draft should find one cut per boundary you made.
7. Report runtime, shot list with source times, and the draft path.
