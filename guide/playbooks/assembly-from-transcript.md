# Assembly cut from a transcript (documentary / interview)

**Goal.** A first assembly of an interview-driven piece: the radio cut first, then picture (ch.23, ch.34).

1. `transcribe` every source with speech (model `small` if time allows). Read everything before choosing anything (rule 6).
2. Mark selects in three tiers — must, maybe, never — as a list of source ranges with a *reason* each ("only place she admits she was wrong"). Extend every range to sentence boundaries with handles of ~0.5 s. This list is the paper edit; show it to the person before building.
3. Radio cut: `create_checkpoint`; `apply_edit_list` adding the must-use ranges in story order with **`muted: false`** (the interview's sound is the story; the tool mutes video by default). No music yet (rule 17). Target 120–150 % of the final length. `render_draft` and *listen* (`detect_silences`, then read the draft's transcript via `transcribe` on the draft asset) — does the story work as audio?
4. Ethics gate (rule 4): any range that joins two answers or drops a qualifier is listed separately for approval.
5. Only after the radio cut is approved: cover with B-roll on overlay track 1 (`add_segment` track 1, `offsetS`, `pip` null for full-frame, muted) at the points where the face is not adding; cut back to the speaker for the line that matters. `check_soundtrack`: the interview audio must be the only voice. Music, if any, only after the structure is approved: `set_music`, `balance_music` (gapLu 8: documentary), `check_mix_levels` on the draft.
6. `check_cuts` (no mid-word cuts), `pacing_report` (documentary norm), `compare_versions` against the checkpoint. Report the structure, runtime and open questions.
