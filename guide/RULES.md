# Always-on rules (the guide, distilled)

Numbers are for 30 fps. "ch." = chapter of guide/editing-guide.md (read_guide).

**Conduct (ch.37)**
1. Checkpoint before any multi-step change; report a change list (compare_versions) with every result.
2. Structural changes (deleting or reordering scenes, changing a reviewed cut) are propose-and-approve: describe, wait, then apply. Mechanical work (silence removal, verification) is apply-and-verify.
3. If a step cannot be done as specified, stop and report. Never present a partial result as complete.
4. Documentary: no edit that changes the meaning of a spoken statement without the person's review. Removing filler is fine; removing a clause is not (ch.34).
5. Verify by looking and listening (get_frame, get_contact_sheet, detect_silences, verify_export on the draft), not by reading parameters.

**Perceive first (ch.23, ch.34)**
6. Read the whole transcript / contact sheet before cutting anything. Log moments, not coverage.
7. Give the person the cut you chose and why, in one paragraph, plus what you could not do.

**The cut (ch.15–16, ch.20)**
8. Straight cuts by default; a transition needs a nameable reason. Dissolve 6–12 frames = softened cut, 1–2 s = time passing, 3 s+ = a statement. Fade to black ends a chapter; a few per film at most.
9. Minimum readable shot ≈ 10 frames (0.33 s); anything shorter is a deliberate felt-not-read choice. Flash frames (< 6 frames) are errors.
10. Vary shot length on purpose; near-uniform durations read as mechanical. Hold while the shot still gives; cut a few frames before the viewer wants to leave. First cuts are 10–20 % too long.
11. Cut inside movement, on the beat, or in stillness to match the register; not on every beat.
12. Use jump cuts consistently or not at all within a sequence; one accidental one is an error.
13. Enter every scene as late as possible and leave as early as possible (ch.19).

**Dialogue (ch.17)**
14. Cut in the pauses, never inside a word (check_cuts). Tighten the gaps before the lines; keep the pauses that mean something; keep breaths, trim them.
15. Don't over-clean: a speaker who never hesitates sounds scripted. Cut to the listener when the reaction is the story.
16. Prefer split edits where the app allows it (audioOnly clip leading or trailing the picture by 4–24 frames).

**Music and sound (ch.27–29)**
17. Cut the scene dry first; add music only once it works without it. A cue needs a reason to start and to stop; enter late, leave early.
18. Cutting to music: structure (phrases, drops, rests) before beats; land within 2 frames of the beat when you mean to; go off-grid on purpose for contrast (check_beat_alignment).
19. Music ducks under speech (musicDucking). No true silence in a dialogue track (fill with room tone as an audioOnly clip).
20. Loudness: web/social −14 LUFS, broadcast −23, streaming −24 to −27; true peak ≤ −1 dBTP (verify_export; audioNormalize=true).

**Soundtrack composition (Part II §7 "Sound")**
25. Decide the sound design before the first cut: which layer carries the story — sync sound, narration, or music — and write it down.
26. Every video shot's own sound is a decision (`muted`). B-roll under narration or music is muted. Imported clips carry their source's narration and music; unmuted, they bleed through.
27. Keep a shot's sound only where the sound is the point (a machine, a laugh, a line to camera), and only from sources with no music or narration of their own.
28. Narration is an audio-only clip (or the voiceover track), never an unmuted shot. One narrator at a time.
29. One music source: the bed via `set_music` (ducks under narration and voiceover, fades out); a YouTube import is an overlay until it is made the bed. The bed is checked twice: `check_soundtrack` before the render (set when the brief asks for one, audible, long enough for the cut) and `verify_export` on the render (audible where it plays alone) — a file can pass loudness and silence with its score missing.
30. `check_soundtrack` before every `render_draft`; `verify_export` for loudness after.
31. Levels (Part II §7 "Levels"): speech is the anchor at −14…−16 LUFS short-term (−14 program); music alone 4–8 LU under the speech, ≥ 12 LU under it while the voice speaks (≥ 8 in music-driven pieces; < 6 hurts intelligibility). Set `musicVolume` with `balance_music` (measured, not guessed) and read the draft back with `check_mix_levels`. Every voice — narration clips, the VO and unmuted sound bites — should sit within ~3 LU of each other: level a clip with its `volume` (1 = as recorded, 2 ≈ +6 dB). The bed ducks under all of them. True peak ≤ −1 dBTP.

**Short-form (ch.36)**
21. The first second shows what it is; the first three give a reason to stay. Something changes every 1–3 s. Open on the strongest frame.
22. Vertical is reframed, not cropped: subject in the middle third; replace wides. Burned-in captions, phrase by phrase.

**Titles and captions (ch.31)**
23. Hold text for reading time: ½ s per word + 1 s. Lower thirds 3–5 s, never across a cut, inside the inner 90 %.

**Delivery (ch.32)**
24. Draft first, always. Final only when the draft passes check_cuts and verify_export. Report the file path, duration, size, loudness.

**Pre-production (Part II §11, playbook `preproduction`)**
32. A new piece starts with the interview, not with footage: standalone or a scene of a longer video (a scene has no title, no sign-off, no closing fade), scripted or not and the genre, where the footage comes from, the premise, the tone, the audience, narration / music / text wanted. One question at a time, multiple choice, the recommended answer first (`interview_next` + the host's question UI); then `set_brief`.
33. The plan is propose-and-approve: `set_plan` → `check_plan` clean of errors → `plan_document` to the person verbatim → their yes → `approve_plan`. No sourcing, generation or cutting before that.
34. The plan carries the whole piece: contiguous beats that add up to the length, every line the audience hears or reads with its time, every shot with duration / source / sound decision, a clip list for YouTube shots (≤ 180 s per imported section), an AI shot list with prompts and a length the model makes, music and narration.
35. Fan out what is independent: `plan_tasks` → every task in `parallelNow` at once (sub-agents per clip for precision, `source_clips` for speed; `generate_ai_shots`; `generate_narration` per line; music). Sub-agents report ids and timings and never reorder or delete; the lead assembles from one checkpoint.
36. A brief's directing style (`production.style`, guide/styles) is a contract for the cut, the narration and the sound: read `get_style` before planning; `check_plan`, `pacing_report` and `check_soundtrack` hold the piece to its parameters; departures are named in the plan's notes, not slipped in. The style is a form — the claims in the piece remain the person's.
