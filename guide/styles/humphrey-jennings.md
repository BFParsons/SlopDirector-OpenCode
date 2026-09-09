# Humphrey Jennings — the country listening

Films: *Listen to Britain* (1942), *Fires Were Started*, *A Diary for Timothy*, *Spare Time*, *Words for Battle*.

## The signature

A wartime country shown by its sounds: a Spitfire over a wheat field, a dance hall, a canteen concert, a factory line singing, a piano in a gallery, a train. No commentary after the opening. Each sequence hands its sound to the next — the roar becomes the music becomes the machine. Ordinary people, unposed, at work and at rest; the poetry is in the arrangement, and in respect.

## Structure — how a scene is built

- A day, in sequences of 30–60 s: each is one place and one sound (a station, a mill, a concert, a street); the cut between them is made on sound (the last sound of one becomes the first of the next).
- No argument stated; the sequence order makes the meaning (a lunchtime concert, then the guns).
- The scene opens on the widest natural image (a field, the sea, a sky) and ends on people listening.
- A scene of a longer film ends on a sound handed off to nothing (a train fading).

## The cut

- Average shot 4–8 s; the concert or dance holds 10–20 s; nothing under 1.5 s.
- Straight cuts on sound; a dissolve (1.5 s) where a sound bridges two places; no fades inside.
- Camera: still, patient, at eye level; people are watched, not directed; details of hands and instruments; skies and horizons.
- Grade: monochrome (`colorLook` MONO), soft contrast, grey daylight.

## Narration

- None inside; one spoken paragraph at the very start of a standalone film (an introduction by a plain voice, 30–60 words), then never again.

## Sound

- The film is made of **sync sound and found music**: the music comes from inside the picture — a band, a singer, a piano, a radio — and is treated as sync (`muted: false`, `volume` 1). No score under it.
- Sound bridges are the transitions: the source of one shot's sound is heard over the head of the next shot for 1–2 s (an audio-only clip of the outgoing sound, overlapping the cut).
- Ambience is continuous inside a sequence (a room-tone audio-only clip under internal cuts).

## Picture — sources and text

- Sources: archive of everyday wartime and civic life (official archives, national film archives, official channels), concerts, factories, stations, fields; generated shots only for skies and landscapes ("wide static shot of a wheat field with a distant aircraft, black and white, 1942, soft contrast").
- Text: none inside; a title card at the start of a standalone film.

## Do not

- No commentary, no interviews, no captions, no score under the sync, no fast cutting.
- No shot of a person that is not respectful; no staging that shows.
- No cut that is not motivated by a sound.

## Harness parameters

asl 4–8 s · min shot 1.5 s · transitions cuts (sound bridges) · narration none (one opening paragraph allowed) · music optional, found (in the picture) · sync sync-first · text none · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: sequences as beats, each with its sound named; every shot `sound: "sync"`; the bridge between beats is a note ("bridge: the train's whistle over the first shot of the mill"); `music: null` unless a song is in the picture.
- Cut: `update_segments muted:false volume 1` throughout; `add_segment audioOnly` for each bridge (the outgoing shot's sound, 1–2 s, at the cut) and room tone under internal cuts; `check_cuts` clean.
- Verify: `check_soundtrack` shows every shot as a sound bite and no bed — the style.
