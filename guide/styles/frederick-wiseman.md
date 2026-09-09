# Frederick Wiseman — the observation

Films: *Titicut Follies*, *High School*, *Hospital*, *Welfare*, *Ex Libris*, *City Hall*.

## The signature

No narrator, no interviews, no music, no titles, no one telling you what to think. A camera inside an institution — a school, a hospital, a welfare office, a city hall — watching people do their jobs and argue, in long sequences that run past the point where a television editor would have cut. The argument of the film is entirely in which sequences follow which.

## Structure — how a scene is built

- The scene is a sequence: one room, one situation, one set of people, played from the moment the camera settles until the situation resolves or exhausts itself. 40 s to several minutes. It is not summarised; it is watched.
- Between sequences: exteriors of the institution — corridors, façades, the street, signage — 3–6 s each, silent but for their own sound. These are the punctuation and the only "editorial" images.
- The order of sequences is the argument: a meeting about budgets, then a patient waiting. Never say it; place it.
- A scene of a longer film ends on an exterior, not on a resolution.

## The cut

- Average shot 8–30 s inside a sequence (internal cuts follow the conversation: who speaks, who reacts, a hand, a document); exteriors 3–6 s. Nothing under 3 s except a reaction cut inside a sequence.
- Straight cuts only. No dissolves, no fades inside the film; black only at the very end of a standalone piece.
- Cut on action and on speech: in-points at the start of a phrase, out-points after the reaction (`check_cuts` clean is mandatory; a cut inside a word is the loudest possible mistake here).
- The camera is handheld but still; zooms are slow and rare. No slow motion, no speed changes, no grade.

## Narration

- None, ever. No text either. If the plan needs context, it is not a Wiseman scene; choose another style or accept one exterior with a sign in frame.

## Sound

- No music. `set_music` is not called; if the brief asks for a score, the style overrides it and the plan says so.
- Every shot keeps its own sound (`muted: false`, `volume` 1): speech, rooms, corridors, traffic. The sound is continuous across internal cuts — an audio-only clip of the sequence's own room tone under the picture cuts when the source sound jumps.
- Silence is the room's silence, never true silence (RULES 19).

## Picture — sources

- Sources: observational footage with continuous sync sound — archive of institutions (council meetings, courts, hospitals, schools, official channels and public-record uploads), long unedited uploads (meetings, hearings, ceremonies), generated shots only for exteriors (static wide, natural light, no people, no movement).
- Interviews, stand-ups, talking heads and reporter pieces are not usable as content; a reporter in frame is a sign the source is a news package, not observation.

## Do not

- No narration, no music, no text, no interviews, no stills, no archive montage.
- No cut that shortens a person's statement into a point (RULES 4); if it is too long, it is the sequence.
- No shot under 3 s except a reaction; no dissolves; no black inside the film.
- No "beautiful" shot for its own sake; the exteriors are plain.

## Type

**The signature.** The film's name in plain white sans on black; nothing else, ever.

**Stand-ins.** Liberation Sans for the plain grotesk. Faces: Liberation Sans 400. Case: sentence. Colour #FFFFFF on #000000. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **title (default)** — the title of a standalone film. Liberation Sans · 5 % · none.

**No text.** Beyond a title, this style puts nothing on the frame; `check_text` warns on any overlay.

**Never:** lower-third, caption, callout, citation, label, card, intertitle, quote, date.

**Survey note.** Wiseman's titles are a plain name on black; no captions, no names, no dates inside the film.

## Harness parameters

asl 8–30 s · min shot 3 s · transitions cuts · narration none · music none · sync sync-first · text none · interviews none

## Applying it in SlopStudio

- Plan: `script` is `bite` lines only (what is said in the sequences, for the record) — no `narration`, no `text`; every shot `sound: "sync"`; `music: null`; beats are sequences, exteriors are their own short beats.
- Clip list: queries for whole events ("city council meeting full 1992", "public hearing unedited", "hospital documentary archive 1970s") and the `wantedSection` names the minutes to fetch.
- Cut: `update_segments muted:false volume:1` on everything; `add_segment audioOnly` room tone under internal cuts if the source sound jumps; no `set_music`.
- Verify: `check_cuts` must be clean; `check_soundtrack` shows every shot as a sound bite and no bed — that is the style, not a fault; `check_mix_levels` will report no music-only stretch — correct.
