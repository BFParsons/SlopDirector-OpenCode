# Interview / talking-head cleanup

**Goal.** Remove dead air, fillers and stumbles from a spoken piece without making the speaker sound scripted (ch.17, ch.34). Output is the same story, tighter.

**Pattern.** Apply-and-verify for silence removal; propose-and-approve for anything that removes words.

1. `get_project`, then `create_checkpoint` ("before cleanup").
2. Perceive: `transcribe` the source (model `base` or better), `detect_silences` (noise −35 dB, min 0.5 s), `get_contact_sheet` to see the framing. Read the whole transcript first.
3. Plan the keeps: the `speech` ranges from `detect_silences`, then extend each to the nearest word boundary from the transcript (never start or end inside a word). Keep pauses that mean something (a thought before an answer); keep breaths but trim them to ≈ 0.3 s.
4. Fillers ("um", "uh", repeated starts) are a *proposal*: list them with times; remove only the ones the person approves, and only where the cut is hidden — a jump cut is acceptable if the piece uses jump cuts throughout (rule 12), otherwise cover with an overlay clip (`add_segment` on track 1 with `offsetS`).
5. Build the cut in one `apply_edit_list`: `clear_timeline`, then one `add_segment` per keep with `trimStartS`, `durationS`, **`muted: false`** — here the clip's sound *is* the content (the tool mutes video by default). Any B-roll on the overlay track stays muted. `check_soundtrack` before the draft.
6. `render_draft`, then `check_cuts` (transcribe=true) — zero mid-word errors — and `detect_silences` on the draft (no silence ≥ 0.75 s unless intentional). `get_frame` at two cut points to confirm the framing did not jump.
7. Report: before/after runtime (`compare_versions`), what was removed, the fillers left in on purpose, and the draft path. Ask before `render_final`.
