# Adam Curtis — the archive essay

Films: *The Century of the Self*, *The Power of Nightmares*, *HyperNormalisation*, *Can't Get You Out of My Head*.

## The signature

A story about power, told over other people's footage. The narrator is calm and certain; the archive is strange, often beautiful, often nothing to do with the words; the music is somebody else's record, played against the picture. Cuts to black are punctuation. The film keeps saying "but then something strange happened".

## Structure — how a scene is built

- One idea per scene, stated in the first line and turned over once: *set-up → the turn ("but") → consequence*. The turn lands on a cut to black or a card.
- Long stretches of narration over montage, then a held archive shot with its own sound and no words for 10–20 s: a face, a dance, a corridor, a man waiting. The hold is the point; do not fill it.
- The scene ends on an image, not a sentence: the last narration line comes 5–10 s before the out, and the picture runs on.
- For a scene of a longer film: no title, no sign-off; the last shot hands off (a hold, or black).

## The cut

- Average shot 4–9 s; the montage runs 3–5 s a shot, the holds 10–20 s. Nothing under 1.5 s.
- Straight cuts. Between beats, a hard cut to black (0.5–1.5 s of black, silent or with the music running). No dissolves.
- Shots are chosen for texture and oddness, not illustration: a 1970s shopping centre, a computer room, a ballroom, a helicopter over suburbs, people looking at the camera. Two literal shots in a row is a failure.
- Archive keeps its scratches, its timecode burn-ins and its VHS colour. Do not grade it clean; `colorLook` NONE.

## Narration — the essayist

- Third person, past tense, plain declaratives, one clause per sentence. Names are given once, then "he", "they", "the men who…".
- Openings: "This is a story about…", "At the same time…", "What nobody noticed was…". Turns: "But then something strange happened.", "But it didn't work out like that." Consequences: "And out of that came…".
- 60–95 words a minute, delivered slowly and evenly, no emphasis, no questions, no adjectives of judgement. Silence between paragraphs of 5–15 s.
- Voice: measured, English, unhurried (`generate_narration` voice sal or leo; never a "documentary announcer").

## Sound

- Music is **found**: pop, library, film scores, classical, from other decades than the pictures. Chosen to fight the image gently — a love song under a riot, a waltz under a computer. Never a sting, never a "tension bed". Search by track and era (CC / library versions; `search_youtube` "… instrumental", "… library music 1970s").
- The bed ducks under narration (`musicDucking` on) and is cut hard at black, not faded.
- Sync sound comes back for the holds: the shot is `muted: false` (`volume` 0.8–1.2) and the narration stops. A sentence of an old interview, a room tone, applause, a machine.

## Picture — sources and text

- Sources: broadcast archive, newsreels, home movies, corporate films, old television, from many eras. `licence` archives / official channels first; the more obscure the upload, the better the texture.
- On-screen text: white Helvetica, sentence case, large, straight over the archive or on black, held 3–4 s, cut in and out: a place and a year, or a single sentence of the argument. No lower-thirds, no boxes. One or two per scene; never a lower-third over a shot.

## Do not

- No talking heads, no reporter stand-ups as content (a reporter is archive, treated like any other shot).
- No drone shots, no stock footage, no modern graphics, no maps.
- No music that "matches" the picture; no swell under the climax.
- No narration that judges ("shockingly", "tragically"); the arrangement judges.

## Type

**The signature.** White Helvetica, sentence case, straight over the image or on black, cut in and out — the caption style Vice and a generation of YouTubers copied.

**Stand-ins.** Liberation Sans (Helvetica's metric twin) for Helvetica. Faces: Liberation Sans 400. Case: sentence. Colour #FFFFFF on #000000. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — a place and a year, or one sentence of the argument, on black. Liberation Sans · 5.2 % · center · no box · none · hold 4 s.
- **caption** — the same sentence, straight over the archive, no box, no outline. Liberation Sans · 4.6 % · center · no box · none · hold 4 s.
- **date** — a place · a year, top-left, the archive's own timecode left in. Liberation Sans · 3.8 % · top-left · no box · none.

**Never:** lower-third, callout, citation, intertitle.

**Survey note.** Surveyed: HyperNormalisation and Can't Get You Out of My Head set every caption in Helvetica, white, mixed case, large, often centred, with hard cuts; no lower-thirds, no boxes, no animation.

## Harness parameters (mirror of `src/lib/styles`)

asl 4–9 s · min shot 1.5 s · transitions cuts-and-black · narration required, essayist, 60–95 wpm · music required, found · sync mixed · text cards · interviews none

## Applying it in SlopStudio

- Plan: beats end on `transition: "fadeToBlack"` with a `card` shot after when a line of the argument needs to stand alone; `sound: "sync"` on the holds; narration lines placed in `script` with 5–15 s gaps.
- Clip list: queries name eras and textures ("1980s shopping mall archive", "computer room 1970s BBC"), not events only.
- Music: `set_music` a found track; `balance_music` gap 6–8; `audioFadeOutS` 0 (the bed stops at the cut).
- Verify: `pacing_report` with the style; `check_soundtrack` shows the holds as sound bites over the bed.
