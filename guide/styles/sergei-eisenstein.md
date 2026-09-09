# Sergei Eisenstein — the collision

Films: *Strike*, *Battleship Potemkin* (the Odessa Steps), *October*, *Alexander Nevsky*, *Ivan the Terrible*.

## The signature

Meaning made by hitting two shots together. A crowd fleeing down steps; a soldier's boots; a mother; a pram; a lion statue that seems to rise. Time is stretched by overlapping the same action from several angles, then compressed by cutting faster than the eye. Faces are types, not people: the worker, the priest, the officer. The cut is the argument; the audience makes the third meaning.

## Structure — how a scene is built

- A state (order) → an intrusion (the boots) → the collision (the massacre, the strike, the charge) → a metaphor (the lion, the slaughtered ox) → the aftermath.
- The collision is built from five or six motifs (the boots, the pram, the mother, the steps, the guns, the crowd), each returning 4–8 times, faster each time.
- Overlapping action: the same movement shown from two or three angles in a row, so a fall takes three times as long; then a brutal ellipsis.
- The metaphor shot is not in the scene's space (a statue, an animal, a machine) and comes at the climax.

## The cut

- Average shot 1–3 s; the collision 0.5–1.5 s a shot; the metaphor 2–3 s; establishing 4–6 s. Nothing under 0.3 s (RULES 9: deliberate flurries are allowed at the peak).
- Straight cuts only. No dissolves, no fades inside; iris or black between chapters if at all.
- Graphic matches and clashes: a diagonal against a vertical, a face against a machine, light against dark; movement in opposite directions on consecutive shots.
- Camera: fixed, formal, often low; the frame is a composition first; monochrome, high contrast (`colorLook` MONO, `contrast` up); intertitles between sequences in a standalone piece.

## Narration

- None. Intertitles carry the words (a single line in capitals, 2–3 s, between sequences: "AND SUDDENLY —").

## Sound

- Music is a **score** built for the cut: percussive, orchestral, driving (Prokofiev is the reference; search "orchestral percussion driving public domain", "1920s silent film score piano CC"); the cut rhythm and the music are composed together (`check_beat_alignment` on the collision).
- Sync sound: none as sync; designed hits (a gunshot, a scream, boots) placed as audio-only clips on the motif returns.
- Silence for one shot at the peak, then the loudest cut.

## Picture — sources and text

- Sources: archive of crowds, machinery, soldiers, statues, animals; generated shots as "types" ("extreme close-up, an old woman's face screaming, black and white, high contrast, 1925 Soviet film"), the same action from several angles.
- Text: intertitles as `card` shots (black, white capitals, serif), 2–3 s, between sequences; no overlays on picture.

## Do not

- No continuity editing for its own sake; no reaction shot that explains; no naturalistic pacing.
- No colour, no dissolve, no camera move beyond a slow pan.
- No individual psychology; the face is a class.

## Harness parameters

asl 1–3 s (collision 0.5–1.5 s) · min shot 0.3 s · transitions cuts · narration none · music required, score (percussive) · sync muted · text cards (intertitles) · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: beats state / intrusion / collision / metaphor / aftermath; the collision lists its 5–6 motifs and their return counts; the metaphor shot's source is stated; intertitles as `card` shots.
- Cut: `apply_edit_list` from the motif schedule; `update_project colorLook MONO contrast 1.25`; `check_beat_alignment` on the collision.
- Music: `set_music` the percussive score; `balance_music` gap 3; `add_segment audioOnly` for the hits on motif returns.
