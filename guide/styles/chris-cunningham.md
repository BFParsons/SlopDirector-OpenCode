# Chris Cunningham — the uncanny

Work: Aphex Twin "Come to Daddy" and "Windowlicker", Björk "All Is Full of Love", Squarepusher "Come On My Selector", Portishead "Only You", Madonna "Frozen"; installation *flex*.

## The signature

The familiar made wrong. A council estate in wet grey light; children with a grown man's face; a machine that loves; a limousine in a city that is slightly too long. Technically exact — every effect is invisible until it is impossible — and cut to the electronic track's stutters and drops so precisely that the picture seems to be the source of the sound.

## Structure — how a video is built

- Establish a real, bleak, ordinary place in long quiet shots (30–40 s of near-silence or the track's intro); let something small be wrong; escalate the wrongness with the music until the drop, where the picture becomes fully impossible; return to the quiet.
- The horror is in faces and bodies; the camera does not flinch and does not cut away early.
- A joke is allowed inside the horror (the sneer, the dance) but it is never signposted.

## The cut

- Two speeds: the quiet passages 4–10 s a shot; the drops cut on the track's stutter, 0.2–0.5 s a shot, sometimes single frames (`speed` 2–4, reverse allowed). Nothing outside those two speeds.
- Straight cuts; a whip or a smash to black on the loudest hit; no dissolves.
- Camera: locked wides in the quiet; handheld and close in the chaos; slow motion (`speed` 0.3) on one impossible motion.
- Grade: desaturated blue-grey daylight, or clinical white; a single colour spike (a red mouth, a green screen glow); `grain` medium.

## Narration

- None. A voice from the track (a scream, a laugh, a sampled phrase) is placed exactly on its picture.

## Sound

- The **track** at full level; its stutters dictate the drop's cuts (`detect_tempo` is not enough — map the hits by ear from `analyze_audio` and the waveform).
- Sync sound in the quiet: rain, wind through an estate, a television, a dog — real, close, uncomfortable (audio-only clips, −18 dB); nothing under the drop but the track.

## Picture — sources and text

- Sources: generated shots ("wet grey council estate, overcast, wide static, a small child standing perfectly still looking at the camera, 16 mm, desaturated"), archive of ordinary places, a machine or a body in a white room; the impossible element as an AI shot with an unnerving prompt ("the child's face is an adult's face, smiling, no other change").
- Text: none. No title card.

## Do not

- No music stings other than the track; no jump-scare sound design; no fog, no horror lighting; the light is daylight.
- No dissolves, no montage of "cool" images; no explaining shot.
- No cut away from the face too early — the discomfort is the content (hold 2 s past comfort).

## Harness parameters

asl 4–10 s in the quiet, 0.2–0.5 s in the drops · min shot 0.1 s (a frame flurry, deliberate) · transitions cuts · narration none · music required, the track · sync mixed · text none · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: beats quiet / wrong / drop / quiet with the two shot-length regimes stated; the drop shots list the exact hit times from the track's map; one `speed 0.3` shot and one `speed 3` shot.
- Cut: `apply_edit_list` from the hit map; `check_beat_alignment` (expect 1–2 frames on the drop cuts); `pacing_report` will flag shots < 0.33 s — the plan's `notes` justify them (RULES 9: deliberate).
- Music: `set_music volume 1 ducking false`; quiet-passage ambience as audio-only clips.
