# Hype Williams — the gloss

Work: Missy Elliott "The Rain (Supa Dupa Fly)", Busta Rhymes "Put Your Hands Where My Eyes Could See", Notorious B.I.G. "Mo Money Mo Problems", TLC "No Scrubs", Kanye West "Gold Digger" and "Stronger", Beyoncé "Drunk in Love".

## The signature

The fisheye lens, the metallic suit, the tunnel of light. Everything is bigger, shinier and closer than life: colour saturated to the edge, frames doubled or stacked, a performer in the centre of a distorted world that bends around them. Split screens, letterboxed widescreen, a single colour per section.

## Structure — how a video is built

- Sections by colour: each verse or chorus owns a set, a palette and a lens (verse 1 gold fisheye tunnel; chorus white cyc, split screen; verse 2 blue rain).
- The performer addresses the lens; there is no story, only presence; the hook returns to the widest, most saturated set.
- Wealth and scale are the subject: cars, jewellery, crowds, a single figure in a huge space.

## The cut

- Cuts on the beat and on the lyric's stresses; average shot 0.8–2 s; the hook runs faster (0.5–1 s); a performance line may hold 3–4 s. Nothing under 0.25 s.
- Straight cuts; split-screen (2–3 panels) on the hook; a strobe of 3–5 frames' cuts at the drop once per song.
- Fisheye and ultra-wide lenses close to the face; slow, glossy dolly moves; slow motion (`speed` 0.5) on the walk and the pour.
- Grade: saturated, high-key, one dominant colour per section (`saturation` up, `contrast` up); letterbox.

## Narration

- None; the lyric and the ad-libs are the voice.

## Sound

- The **song** is the soundtrack at full level; a sound-designed hit on the section change (a whoosh, a reverse cymbal) as an audio-only clip is allowed. No sync sound.

## Picture — sources and text

- Sources: generated performance shots ("fisheye lens close-up, performer in a metallic suit, gold tunnel of light, high-key, saturated, 1998 music video"), generated set wides, archive of luxury objects and crowds.
- Text: the artist and title as a broadcast-style card in the first 5 s and the last 5 s (bottom-left, small caps); no other text.

## Do not

- No naturalism, no handheld realism, no muted palette, no narrative.
- No cut off the beat in the hook; no dissolve.
- No location that looks like a real place unless it is a mansion or a tarmac.

## Harness parameters

asl 0.8–2 s · min shot 0.25 s · transitions cuts · narration none · music required, the song · sync muted · text lower-thirds (title cards) · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: beats = song sections, each with a colour and a lens in the description; shots 1–2 s; the hook beats note split-screen (V2 overlay track with `add_segment track 1`).
- Cut: `update_segments saturation 1.4 contrast 1.15`; `check_beat_alignment` on the hook cuts; overlays for the split screen.
- Music: `set_music volume 1 ducking false`; `add_text_overlay` the title card, style BOX, bottom-left, 4 s.
