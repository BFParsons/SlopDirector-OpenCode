# Vsauce — the tangent

Work: Michael Stevens' channel: "What If Everyone JUMPED At Once?", "Is Your Red The Same as My Red?", "How Much Does a Shadow Weigh?", "What Is the Speed of Dark?"; *Mind Field*.

## The signature

"Hey, Vsauce. Michael here." A question that sounds simple, walked backwards until it is strange, through five other questions, each with a drawing, an old book, a stock image with a zoom, and an "or is it?" — and then, somehow, the answer comes back around to the first one. The cut is quick and playful: zooms on faces, freezes, a prop held up, an old engraving; the music is a plucked, slightly eerie bed that never quite resolves.

## Structure — how a video is built

- The question in the first 5 s, to camera, in the plainest words; a first, wrong-ish answer.
- Tangents: 4–7, each a new question raised by the last answer ("but what is a shadow, really?"), each 60–120 s, each with its own image bank (an engraving, a diagram, a clip, a prop, a map); the transitions are the words ("which brings us to…").
- The return: the first question answered with the tangents' tools; a last, larger question left open; "And as always — thanks for watching."

## The cut

- Average shot 2–4 s; the host to camera 4–8 s (jump cuts inside); images 2–3 s with a slow or a snap zoom (`imageMotion`); nothing under 0.7 s.
- Straight cuts; snap zooms on the host's face for emphasis; a freeze-frame for a joke; a whip to an image; no dissolves.
- Camera: the host at a desk or a plain wall, medium, direct to lens; props held into frame; a lot of stills with motion.
- Grade: neutral, slightly desaturated; the stills as found (engravings, photographs, diagrams).

## Narration — the host

- First person and second person, present tense, playful, exact, with pauses before the turn: "Or… is it?" 140–160 wpm in bursts; definitions read slowly; the etymology of a word once per video.
- Voice: the host's (sync) or `generate_narration` voice rex, "playful, curious, deliberate pauses, a raised eyebrow in the voice".

## Sound

- Music is a **plucked eerie bed** (the Vsauce cue: a minimal, slightly unresolved plucked-string loop) under the tangents, out for the definitions (search "mysterious plucked strings loop library", "curious minimal bed CC"); ducked 8–10 LU under the voice.
- Sync: the host at full level; props' sounds kept; no effects except a single zoom whoosh, rarely.

## Picture — sources and text

- Sources: stills — engravings, old diagrams, photographs, book pages (archives, public-domain collections, uploads) — animated with `imageMotion`; short clips from archive; the host to camera (generated: "a bearded man in a dark T-shirt at a desk, plain grey wall, direct to camera, soft light, 16:9"); props.
- Text: the key word as a card when defined (a serif on a plain field, 2–3 s, with the etymology in smaller type); a caption for a source (small, 2 s); no captions of the speech.

## Do not

- No tangent that does not return; no image without a point; no fast montage; no dramatic music.
- No dissolves; no lower-thirds on the host; no diagram that explains before the words do.
- No answer before the tangents.

## Type

**The signature.** DIN Next Rounded (the Pentagram identity) for words and labels; a serif for definitions.

**Stand-ins.** Nunito for DIN Next Rounded; Noto Serif for the definitions. Faces: Nunito 700, Noto Serif 400. Case: sentence. Colour #FFFFFF on #000000. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — a definition and its etymology on black. Noto Serif · 4.6 % · hold 3 s.
- **label** — a word held up. Nunito Bold · 3.4 % · none.
- **citation** — a source. Nunito Bold.

**Never:** lower-third, caption, intertitle.

**Survey note.** Surveyed: the identity's primary typeface is DIN Next Rounded (previously Alsina); the serif for definitions is an assumption.

## Harness parameters

asl 2–4 s (host 4–8 s) · min shot 0.7 s · transitions cuts (snap zooms, freezes) · narration required, first-person host, 140–160 wpm · music required, plucked bed · sync sync-first · text cards (definitions) + sparse captions · interviews direct-address (host) · beat-cut no

## Applying it in SlopStudio

- Plan: beats question / tangents ×N / return; host shots `sound: "sync"`; still shots with `imageMotion` noted; definition `card` shots.
- Cut: `update_segments imageMotion` slow push on stills, fast push on emphasis; `add_text_overlay` definition cards (BOX, centred, serif); `check_cuts` on the host's jump cuts.
- Music: `set_music` the plucked bed; `balance_music` gap 8; out under definitions via an audio-only clip placement if needed.
