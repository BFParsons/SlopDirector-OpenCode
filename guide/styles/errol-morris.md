# Errol Morris — the interrogation

Films: *The Thin Blue Line*, *The Fog of War*, *Mr. Death*, *Tabloid*, *The Unknown Known*.

## The signature

Nobody narrates. The subject looks straight into the lens and talks, for a long time, and the film believes them a little less each minute. Between the talking: reenactments shot like a thriller — a detail in slow motion, a milkshake in the air, a clock, a road at night — repeated with small changes as the story changes. A minimalist score loops underneath like a machine that will not stop.

## Structure — how a scene is built

- The scene is an account and its cracks. Open on the subject mid-thought (no preamble, no name card first); the account runs 30–60 s; then the film cuts away to a document, a reenactment or a second witness that does not quite match.
- Reenactment inserts are short (3–6 s), stylised, and return: the same object from a new angle each time the story changes.
- Documents fill the frame: a page, a photograph, a headline, a map, held 4–6 s, often with one phrase enlarged.
- The scene ends on the subject in silence, or on the object, not on a conclusion.

## The cut

- Average shot 5–10 s. Interview holds can run 20–40 s; inserts 3–6 s. Nothing under 1.5 s.
- Straight cuts within a sequence; a cut to black (1–2 s) between chapters of the account. Dissolves only on a document montage.
- The interview frame: the subject centred, direct to lens, tight (head and shoulders), dark or single-colour background, shallow focus; the interviewer is never seen or heard except as a beat of silence.
- Reenactments and inserts: high contrast, one light source, slow motion (`speed` 0.5–0.75), macro detail, no faces or faces in shadow.

## Narration

- None. The subject's words carry the scene; the film's opinion is in the cut and the score.
- If the plan needs a fact the subject does not say, it is a text card (white on black, 3–4 s, one sentence) or a document.

## Sound

- Music is a **score**: minimalist, arpeggiated, looping, in a minor key (Philip Glass is the reference; search "minimalist arpeggio piano loop", "Glass-style strings", CC / library). It runs under most of the scene at a low level and swells only when the account contradicts itself.
- The bed ducks under the subject (`musicDucking` on) and holds through the inserts.
- Sync sound: the subject's voice always (`muted: false`); reenactments are silent or carry one designed sound (a clock, a door) added as an audio-only clip.
- Silence: after the key admission, 2–4 s of nothing.

## Picture — sources and text

- Sources: interviews (generated shots follow the frame above; archive interviews cropped to a direct address where the subject looked near the lens); reenactments (AI shots: "slow motion close-up of …, single hard light, black background, film grain, 35 mm"); documents and photographs (stills with slight push-in).
- Text: sparse cards — a name and role the first time (white on black, not a lower-third), a date, a quoted phrase from a document.

## Do not

- No narrator, no interviewer's questions, no "expert" talking heads.
- No music that resolves; no drums.
- No handheld, no vérité walking; the camera is locked and formal.
- No reenactment that shows what cannot be known (a face, a clear act); show the object, the light, the distance.

## Type

**The signature.** Plain cards on black in Baskerville — the typeface Morris argued makes a sentence believed — for names, dates and quotations; a heavy title in the same face.

**Stand-ins.** Libre Baskerville for Baskerville. Faces: Libre Baskerville 400, Libre Baskerville 700. Case: sentence. Colour #FFFFFF on #000000. Entrance: fade.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — a fact the subject does not say, one sentence on black. Libre Baskerville · 4.6 % · center.
- **quote** — a document's phrase, over the document. Libre Baskerville · 4 %.
- **date** — a date on black between chapters. Libre Baskerville · 3.6 % · center.
- **label** — the subject's name and role, the first time, small, no bar. Libre Baskerville · 3.2 % · bottom-left · shadow 4 % · hold 3.5 s.
- **title** — the film's title. Libre Baskerville Bold · capitals · 7 %.

**Never:** lower-third, caption, callout.

**Survey note.** Surveyed: Morris's essay on Baskerville and truth (the New York Times); the films' name cards are plain white serif on black. The Fog of War's title face was not documented; Baskerville is used throughout.

## Harness parameters

asl 5–10 s · min shot 1.5 s · transitions cuts-and-black · narration none · music required, score · sync sync-first · text sparse · interviews direct-address

## Applying it in SlopStudio

- Plan: `script` has `bite` lines only (plus `text` cards); no `narration` kind. Interview shots `sound: "sync"`; inserts `sound: "muted"` with `speed` noted in the description; chapters end on `transition: "fadeToBlack"`.
- AI shots: `generate_ai_shots` with the reenactment prompt shape above; 4–6 s each, one object per shot, re-used at 2–3 points of the scene.
- Music: `set_music` a minimalist loop; `balance_music` gap 8–10; `audioFadeOutS` 2 at a chapter end.
- Verify: `check_soundtrack` expects speech in the unmuted interview shots and no narration clips; `check_cuts` on every interview in/out (never inside a word).
