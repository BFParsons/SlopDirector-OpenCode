# Repurpose long-form into a vertical short

**Goal.** A 15–60 s standalone vertical (9:16) cut of a moment from a longer piece (ch.36).

1. Find candidates: `transcribe` + `detect_scenes` on the source; list 3–5 standalone moments (complete on their own, no setup needed) with times. Propose; the person picks.
2. `create_project` with preset `vertical`; `import_media` the source (or reuse the asset if the project already has it via `list_media`).
3. Hook first: the first second must show what the short is (rule 21). If the chosen moment's best line is late, open on it and let the setup follow.
4. Reframe, don't crop (rule 22): `add_segment` then `update_segments` with `transform` (scale/pan keyframes) so the subject sits in the middle third; replace wides with closer coverage or drop them. Verify every shot with `get_frame`.
5. Something must change every 1–3 s: split long holds (`split_segment`) and vary durations; add burned-in captions (`update_project` captionsEnabled, captionStyle BOX or POP, voScript = the transcript of the kept lines) or `add_text_overlay` phrase by phrase.
6. `render_draft`; `verify_export` target `social` (loudness −14 LUFS); `check_cuts`; `get_contact_sheet` of the draft to confirm framing and caption legibility.
7. Report the manifest: source times of every kept range, the hook, runtime, draft path.
