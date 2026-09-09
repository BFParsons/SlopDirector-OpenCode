# Christopher Nolan — the clockwork

Films: *Memento*, *The Prestige*, *The Dark Knight*, *Inception*, *Interstellar*, *Dunkirk*, *Oppenheimer*.

## The signature

Three timelines cut against each other, each ticking at its own speed, all arriving at the same second. Enormous, real images — an aircraft, a mountain, a city street — shot large-format and steady. Exposition delivered fast by clever people while walking. A score that is one rising line: a tick, a Shepard tone, a brass blast, that never resolves until the cut to black.

## Structure — how a scene is built

- Parallel action: two or three strands (A: the plan; B: the execution; C: the consequence), each with its own clock, intercut with strictly increasing frequency. The scene converges: the last 20 s cut between all strands every 1–2 s, then one hold, then black.
- Open on the largest image with the ticking already running; explain the rules of the scene in the first third through dialogue in motion; execute in the second third; break the rule in the last.
- Endings withhold: cut to black one beat before the answer.

## The cut

- Average shot 3–6 s, falling to 1–2 s at the convergence; the establishing wides hold 6–10 s. Nothing under 0.8 s.
- Straight cuts only; no dissolves; the strands are distinguished by light and palette, never by a transition. Black between the largest movements only.
- Camera: steady — dolly, crane, aerial, IMAX-style wides; handheld only inside the action strand; the horizon level; faces close and lit from one side.
- Grade: cool steel and warm skin, high contrast, clean (`colorLook` cinematic, no grain, slight vignette); the strands may carry different colour temperatures.

## Narration

- None as narration; the exposition is dialogue (a bite from a source, or generated dialogue lines) spoken over action. If the brief requires a narrator, one calm third-person voice, sparing (20–50 wpm), stating rules and stakes, never feelings.

## Sound

- Music is a **score** built on a pulse: a ticking clock, a rising synth line, low brass hits at the strand switches (search "ticking clock tension cue", "Shepard tone riser library", "low brass hit braam CC"). It runs continuously and grows; it does not stop until the black.
- Sync sound is big and specific: engines, wind, boots, a lock; audio-only clips at the strand switches; dialogue kept intelligible above the score (`check_mix_levels` ratio ≥ 12 LU).
- Silence: one, at the moment before the cut to black.

## Picture — sources and text

- Sources: archive of real machinery, aviation, cities, crowds, weather; generated shots ("IMAX wide, aircraft over the sea at dawn, steady aerial, 65 mm, high contrast, no grain"); dialogue shots close and side-lit.
- Text: a title card for each timeline's clock at its first appearance ("The Mole — one week", "The Sea — one day", "The Air — one hour"), plain sans, 2–3 s; nothing else.

## Do not

- No dissolves, no slow motion for pathos, no montage set to a song, no lens flares.
- No explanation in voiceover of what the cut already shows; no jokes at the convergence.
- No strand that stops advancing; every return to a strand shows progress.

## Harness parameters

asl 3–6 s (converging to 1–2 s) · min shot 0.8 s · transitions cuts · narration optional, third person, 20–50 wpm · music required, score (pulse) · sync sync-first · text cards · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: beats are the strands (A/B/C) with the intercut order written in `notes`; each shot's description names its strand; the last beat's shots are 1–2 s; the final shot `transition: "fadeToBlack"` on a standalone piece.
- Cut: `reorder_segments` to the intercut order; `check_cuts` clean on dialogue; `pacing_report` will show a falling ASL — correct.
- Music: `set_music` a rising pulse cue; `balance_music` gap 6; `audioFadeOutS` 0 (the black cuts the score).
