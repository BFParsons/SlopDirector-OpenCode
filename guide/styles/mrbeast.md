# MrBeast — retention

Work: "I Spent 50 Hours Buried Alive", "$1 vs $1,000,000 Hotel Room", "Last to Leave Circle Wins $500,000", "Squid Game in Real Life"; the Beast Philanthropy channel; the editing house that trained a generation of YouTube editors.

## The signature

The premise in the first sentence, the stakes in the first shot, the payoff promised in the first five seconds. A cut every 1–3 s; a new angle, a zoom, a graphic or a sound every few seconds; loud captions that repeat the numbers; risers before every reveal, hits on every result; no pause, no transition, no throat-clearing. The host talks to you, fast and cheerful, and the video is re-cut until nothing in it can be skipped.

## Structure — how a video is built

- Hook (0–5 s): the premise and the prize, spoken and shown ("I buried myself alive for fifty hours — and if I get out, this guy wins $100,000.").
- The set-up compressed (5–30 s): the rules in three sentences over the widest shot; a graphic of the stakes.
- Escalating segments (30 s–end): each 60–120 s, each with a mini-hook ("but then it got worse"), a challenge, a twist, a result with a hit; the number on screen grows or shrinks.
- The payoff last, no epilogue; a call to the next video only if the brief allows.
- Re-cut rule: any 10 s the viewer could skip is cut.

## The cut

- Average shot 1–3 s; reactions 0.5–1 s; the reveal hold 3–4 s; nothing under 0.3 s. A new visual event (angle, zoom, graphic, insert) at least every 5 s.
- Straight cuts, snap zooms (`imageMotion` fast push), whip transitions with a whoosh; jump cuts inside the host's speech are fine; no dissolves.
- Camera: multi-angle coverage of one event (a wide, a close, a drone, a GoPro) so every cut is a new angle; the host to camera in a wide with the set behind.
- Grade: bright, saturated, high-key (`saturation` 1.2, `contrast` 1.05, `brightness` +5 %); no vignette.

## Narration — the host

- First person, present tense, plain, fast, enthusiastic; numbers in every third sentence; "you" often; 150–180 wpm; no sentence over 12 words; a mini-hook every 60 s (`generate_narration` voice rex, "excited, fast, bright, a big smile in the voice").
- Captions repeat the key words as they are said.

## Sound

- Music is a **library bed** with energy: upbeat, drum-driven, changing per segment; it drops out for reveals (silence 0.5 s), and a **riser** precedes every reveal, a **hit** lands every result, a **whoosh** carries every transition (search "upbeat energetic background library", "riser sound effect CC", "impact hit whoosh pack").
- Sync sound: the host and contestants (`muted: false`, `volume` 1); crowd reactions kept.
- Ducking on; the bed sits 8–10 LU under speech.

## Picture — sources and text

- Sources: the project's own multi-angle footage or generated shots ("wide shot, a giant glass box in a warehouse, bright lights, a man in a hoodie inside, 4K, high-key"); drone-style wides; graphics as cards.
- Text: bold, thick, white-with-black-outline captions (2–4 words, 1–2 s, centred, popping in with a hit) for key phrases and every number; a stakes counter in a corner; a progress bar or timer when the challenge has one.

## Do not

- No intro, no logo, no slow build, no b-roll without a point, no dissolves, no gap between segments.
- No number said without being shown; no reveal without a riser and a hit.
- No shot over 4 s except the reveal hold.

## Type

**The signature.** Anton for the in-video captions, Bebas Neue for the thumbnails — heavy capitals, white with a black outline, popping on the word.

**Stand-ins.** Anton and Bebas Neue are the real faces (both free). Faces: Anton 400, Bebas Neue 400. Case: upper. Colour #FFFFFF on #000000. Entrance: pop.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **caption (default)** — the key words as they are said. Anton · capitals · 7 % · outline 10 %.
- **callout** — a number, big, yellow. Anton · capitals · 6.5 % · center · #FFE600 · outline 10 %.
- **label** — a timer or a stakes counter in a corner. Bebas Neue · capitals · 4 % · box.
- **title** — a title card. Bebas Neue · capitals · 9 % · outline 6 %.

**Never:** quote, intertitle, citation, date.

**Survey note.** Surveyed: Anton (captions) and Bebas Neue (thumbnails); Komika Axis in older subtitles.

## Harness parameters

asl 1–3 s · min shot 0.3 s · transitions cuts (snap zooms, whips) · narration required, first-person host, 150–180 wpm · music required, energetic bed + risers / hits · sync sync-first · text kinetic captions · interviews direct-address (host to camera) · beat-cut no (event-cut)

## Applying it in SlopStudio

- Plan: beats hook / set-up / segments ×N / payoff; each segment lists a mini-hook line, a reveal shot (3–4 s hold), a riser and a hit; captions as `text` lines at every number.
- Cut: `add_segment audioOnly` risers before reveals and hits after; `update_segments imageMotion` push on emphasis shots; `add_text_overlay` POP style captions; `update_project saturation 1.2`.
- Music: `set_music` the bed per segment (or audio-only clips per segment); `balance_music` gap 8; `pacing_report` will show ASL ≈ 2 s — correct here (`genre: social`).
