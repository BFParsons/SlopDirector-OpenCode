# Anton Corbijn — the grain

Work: Depeche Mode "Enjoy the Silence", "Personal Jesus", "Walking in My Shoes"; Nirvana "Heart-Shaped Box"; Joy Division "Atmosphere"; U2 "One"; Metallica "Hero of the Day"; features *Control*, *A Most Wanted Man*.

## The signature

Black and white, or colour so desaturated it might as well be. Super 8 and 16 mm grain, slow shutter, hard daylight and long shadows. A performer alone in a landscape — a king with a deckchair on a hill, a man walking a road — photographed like a portrait: still, frontal, unsmiling. The band plays to camera in a bare room. Surreal props, deadpan.

## Structure — how a video is built

- Two strands intercut: the portrait strand (the singer alone in a place, one action, one costume, walking) and the performance strand (the band in a bare interior, playing straight to lens). The strands never meet.
- Each verse advances the walk; each chorus returns to the performance; the bridge is a single held portrait.
- No story is explained; the props are metaphors left alone (a chair, a crown, a mirror, a bird).

## The cut

- Average shot 3–6 s; portraits hold 6–10 s; performance cuts on the phrase, not the beat. Nothing under 1 s.
- Straight cuts; a slow fade to black at the very end only.
- Camera: static tripod or a slow, wide handheld; frontal framing; the horizon flat and low; hard sun or window light.
- Grade: monochrome (`colorLook` MONO) or a heavy desaturation with a sepia lean; grain heavy (`grain` 0.4); slight overexposure; `speed` 0.7–0.8 for the walk.

## Narration

- None. Occasionally a spoken line by the singer to camera, unamplified.

## Sound

- The **song** at full level; sync sound is nothing but wind, if anything (an audio-only clip at −25 dB under the portraits).

## Picture — sources and text

- Sources: generated shots ("black and white 16 mm film, heavy grain, a man in a long coat walking alone on a mountain road, hard sunlight, wide static frame"), archive landscapes, performance shots in a bare room.
- Text: none; the title and artist as small white text bottom-left for 4 s at the start, if at all.

## Do not

- No colour saturation, no fast cutting, no lens flares, no smooth gimbal moves, no dissolves.
- No smiling, no dancing, no crowd.
- No performance shot that pretends to be a concert.

## Type

**The signature.** Photobook captions: tiny spaced capitals in a plain grotesk, white, once.

**Stand-ins.** Liberation Sans for the plain grotesk. Faces: Liberation Sans 400. Case: spaced capitals. Colour #FFFFFF on #000000. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **credit (default)** — artist · song, tiny spaced capitals, lower-left. Liberation Sans · spaced capitals · 2.6 % · no box · none · hold 4 s.
- **title** — a title, small. Liberation Sans · spaced capitals · 4 %.

**Never:** lower-third, caption, callout, card, intertitle, quote, date, label.

**Survey note.** Assumption: Control's title face was not documented; the manner follows the photobooks.

## Harness parameters

asl 3–6 s · min shot 1 s · transitions cuts · narration none · music required, the song · sync muted · text sparse · interviews none · beat-cut optional

## Applying it in SlopStudio

- Plan: two beats alternating (portrait / performance) across the song's sections; portrait shots 6–10 s, performance 3–4 s; the last shot `transition: "fadeToBlack"` on a standalone piece.
- Cut: `update_project colorLook MONO grain 0.4`; `update_segments speed 0.75` on the walk; `check_cuts` on the phrase boundaries of the performance shots (the singer's mouth, if generated with lip-sync, must land on the lyric).
- Music: `set_music volume 1 ducking false`.
