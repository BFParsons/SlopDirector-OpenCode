# Leni Riefenstahl — the monument

Films: *Triumph of the Will* (1935), *Olympia* (1938). The craft is documented here as craft — the geometry of crowds, the low angle, the cut to the anthem; the harness applies it to whatever the brief says, and the brief's claims remain the person's responsibility.

## The signature

The individual dissolved into a shape: columns, squares, a stadium, a sea of flags. Low angles that make a speaker a statue against the sky; high angles that make a crowd a pattern. Cameras on rails, lifts and towers; long slow moves. Cuts timed to a march or an anthem. A body in motion (an athlete, a diver) shot against the sky in slow motion. No narration — the ceremony narrates itself.

## Structure — how a scene is built

- Arrival (from the air, from the road: the place seen from above, then the crowds waiting), the entrance (the figure, the vehicle, the flags), the ceremony (massed formations, the address, the response), the exaltation (faces, a torch, the sky).
- The scene grows in scale: each beat's widest shot is wider than the last.
- Speech is shown as ritual, not content: fragments of a voice, the crowd's answer, the salute; the words matter less than the rhythm.

## The cut

- Average shot 4–8 s; the formations hold 8–15 s; the montage of faces runs 1.5–2.5 s a shot; nothing under 1 s.
- Straight cuts on the music's phrases; a dissolve (1–2 s) between two aerials; a fade to black at the end of the ceremony only.
- Camera: low angle for the figure, high angle for the mass, slow tracking along a line of people, a crane rise over a square; every move is smooth and long; slow motion (`speed` 0.5) on athletic bodies against sky.
- Grade: monochrome or a silver-toned desaturation (`colorLook` MONO or `saturation` 0.5), high contrast, strong skies (`contrast` up).

## Narration

- None; if the brief demands it, a single declarative line at the start and the end (10–20 words each), not inside the ceremony.

## Sound

- Music is **martial and orchestral**: marches, Wagnerian brass, anthems, drums (search "military march brass public domain", "orchestral anthem library", "snare drum cadence CC"). It runs continuously; the cut lands on its phrases (`check_beat_alignment` on the montage).
- Sync sound: the crowd's roar, boots, drums, bells, a voice's fragment — bursts of 3–6 s (`muted: false`) over which the music dips.
- No effects design; the sound of the event is the effect.

## Picture — sources and text

- Sources: archive of parades, rallies, stadium ceremonies, mass gymnastics, aerials of crowds; generated shots ("low angle, a single figure on a podium against a bright sky, thousands in ranks below, black and white, 1930s newsreel, slow crane rise").
- Text: none inside; a title card on black at the start of a standalone piece.

## Do not

- No handheld, no close intimacy, no humour, no reaction shots of individuals as individuals.
- No fast cutting except the face montage; no dialogue; no lower-thirds.
- No shot in which the mass is not in order.

## Harness parameters

asl 4–8 s (holds 8–15 s) · min shot 1 s · transitions cuts (rare dissolves) · narration none · music required, march / orchestral · sync mixed · text none · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: four beats (arrival / entrance / ceremony / exaltation) with the widest shot of each beat named; face montage shots 1.5–2.5 s; sync bursts marked `sound: "sync"`.
- Cut: `update_project colorLook MONO contrast 1.2`; `update_segments speed 0.5` on the body-against-sky shot; `check_beat_alignment` on the montage.
- Music: `set_music` the march; `balance_music` gap 4; `audioFadeOutS` 3 at the end of a standalone piece.
