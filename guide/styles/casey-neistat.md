# Casey Neistat — the cinematic vlog

Work: the daily vlog (2015–16), "Snowboarding with the NYPD", "Bike Lanes", "Make It Count" (Nike), "Do What You Can't" (Samsung), the 368 videos.

## The signature

A day told like a short film: a wide-angle camera on a tripod with a boom, held at arm's length, the city moving past; time-lapses of streets and skies; a drone over the roof; jump cuts inside a monologue; a music track that the whole day is cut to; a first-person voice that talks directly to you about the point of the day. Sunglasses, a scooter, the studio. It is fast but it breathes.

## Structure — how a video is built

- Open on the day's premise in one sentence to camera, mid-motion; a title card drawn by hand (a marker on paper) with the day's number or name.
- The day in three or four movements (the walk, the meeting, the build, the flight), each with a time-lapse to travel and a monologue to think; the story is the day's problem and how it went.
- The end: a wide from the roof, a line to camera about what it meant, a cut to black on the music's last beat. No outro beyond a two-second card.

## The cut

- Average shot 2–4 s; monologue takes 6–12 s with jump cuts every sentence; time-lapses 3–5 s; drone wides 5–8 s; nothing under 0.7 s.
- Straight cuts on the music; jump cuts are the grammar (the same framing, the next sentence); a smash cut to a time-lapse as a transition; no dissolves.
- Camera: ultra-wide (the "vlog" look), handheld and moving, at arm's length; time-lapses (`speed` 8–30); drone; glidecam wides; a lot of walking.
- Grade: warm, contrasty, natural (`contrast` 1.1, `saturation` 1.05); sunlight and neon.

## Narration — the monologue

- First person, present tense, direct to camera, casual, opinionated, clear: "Here's the thing about that." 130–160 wpm in the monologues; silence under the time-lapses and the drone.
- The point of the day is said once, near the end, plainly.
- Voice: the host's (sync); if generated, `generate_narration` voice rex, "casual, quick, direct, a New Yorker talking to a friend".

## Sound

- Music is a **track** (an instrumental with drive, an indie or electronic piece from a library) that the day is cut to; it runs through the time-lapses at full level and ducks under the monologues (search "upbeat indie electronic instrumental library", "chill hip hop beat CC").
- Sync: the monologues and the street (`muted: false`, `volume` 1 on the monologue, 0.5 on the street under the track).
- No sound effects except the natural ones (a scooter, a door, a drone motor).

## Picture — sources and text

- Sources: the project's own footage; generated shots ("ultra-wide handheld selfie angle, a man in sunglasses walking through Manhattan, morning, 16:9"), time-lapses (archive of cities, skies), drone wides.
- Text: a hand-drawn title card (marker on paper, 2 s) at the start; occasional hand-written words over a shot; no captions, no lower-thirds.

## Do not

- No talking head at a desk, no studio lighting, no dissolves, no slow build, no music over the monologue at full level.
- No shot without motion; no vlog without a point.
- No outro longer than a card.

## Type

**The signature.** Marker handwriting on paper: the day's title drawn by hand, a word scrawled over a shot.

**Stand-ins.** Permanent Marker for the marker hand. Faces: Permanent Marker 400. Case: lower. Colour #111111 on #F4F1EA. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **title (default)** — the day's title, marker on paper (a card shot). Permanent Marker · 7 % · #111111 · none · hold 2.5 s.
- **label** — a word over a shot. Permanent Marker · 3.6 % · #FFFFFF · no box · shadow 5 % · none.

**Never:** lower-third, caption, callout, citation, quote, intertitle, date.

**Survey note.** Surveyed: hand-drawn marker titles and physical chapter markers.

## Harness parameters

asl 2–4 s · min shot 0.7 s · transitions cuts (jump cuts, smash to time-lapse) · narration required, first-person to camera, 130–160 wpm · music required, track · sync sync-first · text sparse (hand-drawn card) · interviews direct-address · beat-cut yes (the time-lapses)

## Applying it in SlopStudio

- Plan: beats premise / movements ×3 / roof; monologue shots `sound: "sync"` 6–12 s; time-lapse shots `speed 12` 3–5 s; drone wides 5–8 s; the title as a `card` (hand-drawn text).
- Cut: `update_segments speed 12` on the time-lapse sources; `check_beat_alignment` on the time-lapse cuts; `update_project contrast 1.1`.
- Music: `set_music` the track; `balance_music` gap 6; `audioFadeOutS` 0 (cut on the last beat).
