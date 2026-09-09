# Denis Villeneuve — the monolith

Films: *Incendies*, *Prisoners*, *Sicario*, *Arrival*, *Blade Runner 2049*, *Dune*.

## The signature

A human figure tiny against something vast and silent — a canyon, a ship, a wall of fog. Shots held far past the point of information. Dialogue sparse and low. A score that is a single sustained low frequency with a slow, enormous swell. Colour is one hue per world: orange dust, grey-green rain, blue night. Violence, when it comes, is fast and mostly off-screen.

## Structure — how a scene is built

- Arrive slowly: 20–40 s of approach (the landscape, the vehicle, the figure moving through it) before anyone speaks.
- The scene has one decision, made by one person, mostly in silence; the dialogue around it is short and functional.
- The event (a reveal, an act) is a single wide or a single close-up, held; the reaction is the landscape again.
- Leave slowly: the last 10–20 s are a wide with the figure already small.

## The cut

- Average shot 6–15 s; wides 12–30 s; dialogue in slow alternation 4–8 s; nothing under 2 s except a single hard cut at the event.
- Straight cuts; a slow fade to black (3 s) at the end of a chapter; no dissolves.
- Camera: locked or a glacial push-in / drift; aerials that do not turn; silhouettes against light; frontality; deep shadow. No handheld.
- Grade: monochromatic per world (`colorLook` cool or warm, `saturation` down 20 %, `contrast` up, blacks deep, `vignette` light); haze and dust welcome.

## Narration

- None, usually. If the brief needs one: a single quiet voice, present tense, 15–40 wpm, one thought per minute, spoken as if remembering ("I used to think this was the beginning of your story.").

## Sound

- Music is a **score** of drones and low brass: a sustained sub-bass, a slow chord that takes 20 s to change, one massive swell at the event (search "low drone cinematic CC", "sub bass swell library", "brass drone slow build"). It is felt more than heard; ducking on, but the dialogue is so sparse it rarely triggers.
- Sync ambience is continuous and precise: wind, sand, rain, engines, footsteps — the shots' own sound at 0.6–0.8 or audio-only beds; the room tone of a big space.
- Silence used as a cut: 2–3 s of nothing before the event.

## Picture — sources and text

- Sources: archive of deserts, ports, industrial coasts, fog, aerials that do not turn; generated shots ("extreme wide, a lone figure walking toward a colossal concrete wall in orange haze, static, anamorphic, 65 mm, low contrast highlights, deep blacks"); dialogue shots frontal and dark.
- Text: none. A chapter title only on a standalone film (thin sans, small, 3 s, over black).

## Do not

- No fast cutting, no handheld, no bright saturated palette, no lens flares, no montage to a song.
- No explaining dialogue; no reaction shots of faces emoting; no music that has a melody.
- No cut inside the approach or the leaving.

## Type

**The signature.** Light geometric capitals with wide tracking (Arrival's lightened Gotham, Blade Runner 2049's Brandon Grotesque credits), a monumental extended wordmark (Dune) — cool white, slow.

**Stand-ins.** Montserrat Light with spaced capitals for the light geometrics; Michroma for the extended wordmark. Faces: Montserrat 300, Michroma 400. Case: spaced capitals. Colour #DCE3E8 on #000000. Entrance: fade.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **title** — the extended, tracked title. Michroma · spaced capitals · 6 % · hold 5 s.
- **card (default)** — a chapter card, light spaced capitals. Montserrat Light · spaced capitals · 3.4 % · hold 4 s.

**Never:** lower-third, caption, callout, citation, label, intertitle.

**Survey note.** Surveyed: Arrival (modified Gotham Light), Blade Runner 2049 (Brandon Grotesque credits, custom extended wordmark), Dune (custom wide geometric with extreme tracking).

## Harness parameters

asl 6–15 s · min shot 2 s · transitions cuts · narration optional, quiet present tense, 15–40 wpm · music required, score (drone) · sync mixed · text none · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: beats approach / decision / event / leaving; 6–10 shots in 2 minutes; wides hold 12–30 s; ambience noted per shot.
- Cut: `update_project colorLook` cool/warm, `saturation 0.8`, `contrast 1.15`, `vignette 0.25`; `update_segments muted:false volume 0.7` on ambience shots.
- Music: `set_music` a drone; `balance_music` gap 6; `audioFadeOutS` 3 on a chapter end; `check_mix_levels musicDriven:true`.
