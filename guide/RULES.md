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

**Short-form (ch.36)**
21. The first second shows what it is; the first three give a reason to stay. Something changes every 1–3 s. Open on the strongest frame.
22. Vertical is reframed, not cropped: subject in the middle third; replace wides. Burned-in captions, phrase by phrase.

**Titles and captions (ch.31)**
23. Hold text for reading time: ½ s per word + 1 s. Lower thirds 3–5 s, never across a cut, inside the inner 90 %.

**Delivery (ch.32)**
24. Draft first, always. Final only when the draft passes check_cuts and verify_export. Report the file path, duration, size, loudness.
