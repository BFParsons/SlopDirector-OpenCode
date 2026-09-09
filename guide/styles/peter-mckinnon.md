# Peter McKinnon — the cinematic vlog

Work: the photography and filmmaking channel: "How to make your video look CINEMATIC", coffee and camera-bag vlogs, the Leica and travel films; the transition and LUT tutorials.

## The signature

Every shot looks like a still photograph that started moving: shallow depth, a slow push, a speed ramp on a gesture, a whip pan that lands on the next scene, a LUT with lifted blacks and warm highlights. A coffee poured in slow motion. A voice that is easy and warm, explaining the craft, and a b-roll sequence that is the craft. Cinematic on a desk.

## Structure — how a video is built

- Open on a b-roll sequence (10–20 s) cut to music — the coffee, the gear, the light — then the host to camera with the topic in one sentence.
- Sections: each opens with a b-roll transition (a whip, a match cut, a speed ramp) and a title; the host explains, the b-roll demonstrates; a before/after when it is a technique.
- The ending: a last b-roll sequence with the music up, the host's sign-off, an end card.

## The cut

- Average shot 2–4 s; b-roll sequences 1–2 s a shot on the music; the host to camera 6–12 s; nothing under 0.5 s.
- Whip pans (from the source), match cuts (a shape into a shape), speed ramps (`speed` 0.3 → 1.5 within a shot — noted as two segments), masks and light-leak transitions rarely; straight cuts inside the host's speech.
- Camera: gimbal and slider moves, 50–85 mm looks, wide open, backlit; slow motion (`speed` 0.4–0.5) on hands and liquids; a top-down desk shot.
- Grade: a warm cinematic LUT (`colorLook` cinematic or a LUT asset), lifted blacks, orange-teal, `vignette` 0.25, light `grain`.

## Narration — the host

- First person, present tense, warm, encouraging, practical: "This is the one thing that changed my b-roll." 130–150 wpm; a "let's get into it"; a list of three.
- Voice: the host's (sync) or `generate_narration` voice rex, "warm, friendly, confident, a Canadian creator".

## Sound

- Music is a **track** with a build: indie electronic or cinematic hip hop that the b-roll cuts to (search "cinematic hip hop instrumental library", "indie electronic build CC"); up under b-roll, ducked 8 LU under the host.
- Sound design on the transitions: whooshes on whips, a bass hit on the speed ramp, the coffee's own sound in slow motion (audio-only clips).
- Sync: the host (`muted: false`); b-roll's real sound at 0.5 under the track.

## Picture — sources and text

- Sources: the project's own b-roll; generated shots ("slow motion, coffee poured into a glass, backlit, shallow depth of field, warm, 120 fps look", "top-down desk with a camera and a notebook, slider move"); the host to camera in a dark room with practical lights.
- Text: section titles (a clean sans, white, animated in with the whip, 2–3 s); a before/after label; the end card; no captions.

## Do not

- No flat lighting, no static b-roll, no cut without a move, no music at one level throughout.
- No transition without a sound; no LUT without lifted blacks.
- No host section longer than 15 s without a b-roll insert.

## Type

**The signature.** Clean geometric capitals, spaced, for section titles (arriving on the whip), a hand-drawn brush flourish for the title (the McKinnon Brush face).

**Stand-ins.** Montserrat for the geometric sans; Permanent Marker for the brush hand. Faces: Montserrat 600, Permanent Marker 400. Case: spaced capitals. Colour #FFFFFF on #000000. Entrance: slide up.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **lower-third (default)** — a section title on the whip. Montserrat SemiBold · spaced capitals · 3.6 % · no box · shadow 4 % · slide up · hold 2.5 s.
- **title** — the title in the brush hand. Permanent Marker · 7 % · shadow 4 %.
- **label** — before / after. Montserrat SemiBold · capitals · 3 %.

**Never:** caption, intertitle, quote, citation.

**Survey note.** Surveyed: the McKinnon Brush typeface (Oban Jones) for his branding; the section titles are a clean sans.

## Harness parameters

asl 2–4 s (b-roll 1–2 s) · min shot 0.5 s · transitions cuts + whips, match cuts, speed ramps · narration required, first-person host, 130–150 wpm · music required, track with a build · sync sync-first (host) / muted (b-roll under track) · text lower-thirds (titles) · interviews direct-address · beat-cut yes (b-roll)

## Applying it in SlopStudio

- Plan: beats opening b-roll / sections ×N / closing b-roll; b-roll shots 1–2 s `sound: "muted"` on the beat with the transition named; speed ramps as two consecutive segments of the same source (`speed 0.4` then `1.5`); host shots `sound: "sync"`.
- Cut: `update_segments speed` for ramps; `set_lut` or `colorLook` cinematic, `vignette 0.25`, `grain 0.1`; `add_segment audioOnly` whooshes and hits; `check_beat_alignment` on the b-roll.
- Music: `set_music` the track; `balance_music` gap 6; `audioFadeOutS` 2.
