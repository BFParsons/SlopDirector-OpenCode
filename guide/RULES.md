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
27. **Film dialogue must be music-free before adding a new cue:** select clean dialogue or isolate and review the voice. Mute the original when using a stem. Transcription, EQ, ducking and loudness checks do not prove music removal. Track the audible asset/range and pending/listened review in plan.shots[].sourceAudio; follow [Film dialogue](playbooks/film-dialogue.md).

27a. Keep a shot's sound only where the sound is the point (a machine, a laugh, a line to camera), and only from sources with no music or narration of their own.
28. Narration is an audio-only clip (or the voiceover track), never an unmuted shot. One narrator at a time.
    Across every directing style, the final sentence of a monologue or film must be performed as a closing thought. Identify the actual narrative ending before generating individual lines; the last sentence of a TTS chunk is not necessarily an ending. Give the narrator an explicit closing-delivery cue suited to the tone (resolved, reflective, ominous, questioning or deliberately unresolved), with intentional final-word emphasis, cadence and room to land. Preserve the script's meaning and question inflection; do not force every ending into a low pitch or a whisper. Keep performance directions out of spoken text, preserve the voice's natural tail, and review the closing passage in context. Duration and loudness checks cannot establish whether it sounds finished.
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
32. A new piece starts with the interview, not with footage: standalone or a scene of a longer video (a scene has no title, no sign-off, no closing fade), scripted or not and the genre, where the footage comes from, the premise, the tone, the audience, narration / music / text wanted. Prefetch `interview_batch` once, then ask one short question at a time, multiple choice where practical, including directing style. Between replies only record the answer and advance the cached queue; no per-answer tool calls or research. Refresh when the queue is exhausted or changed answers invalidate it. Review all answers together after collection and clarify material contradictions, then `set_brief`. Use `interview_next` only if the client cannot cache questions. Silence and defaults are not answers; explicitly delegated choices may be filled and stated in the plan.
33. The plan is propose-and-approve: `set_plan` → `check_plan` clean of errors → `plan_document` to the person verbatim → their yes → `approve_plan`. No sourcing, generation or cutting before that.
34. The plan carries the whole piece: contiguous beats that add up to the length, every line the audience hears or reads with its time, every shot with duration / source / sound decision, a clip list for YouTube shots (≤ 180 s per imported section), an AI shot list with prompts and a length the model makes, music and narration.
35. Fan out what is independent: `plan_tasks` → every task in `parallelNow` at once (sub-agents per clip for precision, `source_clips` for speed; `generate_ai_shots`; `generate_narration` per line; music). Sub-agents report ids and timings and never reorder or delete; the lead assembles from one checkpoint.
36. A brief's directing style is a reference for a concrete creative treatment.
Read get_style before planning. Record reference, mechanism, materialPlan, rhythm,
sound, typography, exceptions and evaluation in plan.styleTreatment. The shared
director-style playbook explains the fields. Catalogue numbers and type palettes
are starting defaults, not measured career-wide limits. check_plan and pacing_report
raise review findings for creative departures; technical validity and the person's
explicit constraints still apply. Keep evidence, quotes and source context intact.
37. Distinguish the film's title (`role: title`) from supporting text: statements, chapters, captions, names and CTAs. Design the title's font, palette, composition and reveal separately; it may use its own display face. Start titles around 8–12% landscape height (6–8% portrait), cards 4–6%, names/callouts 3–4.5%; restrained styles can create prominence through empty space and timing. Keep supporting typography consistent, with a repeatable entrance and purposeful accents. All text stays within title-safe, with readable holds and no unintended overlap. A no-text style can still have its film title or specified credits. Record both treatments in the plan; see `typography-and-motion`. Run `check_text` before rendering and inspect the result afterward.
38. A script or shot list the person supplies (`brief.materials`) is the plan's spine: their lines verbatim, their shots in their order; the plan proposes only what they left open and names its additions in notes.

