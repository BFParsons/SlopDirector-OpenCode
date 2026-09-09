# Wes Anderson — the diorama

Films: *Rushmore*, *The Royal Tenenbaums*, *The Grand Budapest Hotel*, *Moonrise Kingdom*, *The French Dispatch*, *Asteroid City*.

## The signature

The camera looks straight at the wall. People stand in the middle of the frame and speak in complete sentences without moving their faces. The camera moves only on right angles — a snap pan, a lateral dolly, a slow push-in — and often on a whip. Chapters have title cards. Colours are chosen from one palette. Sad things are said cheerfully; a narrator reads them like a book.

## Structure — how a scene is built

- Chapters: a title card ("Chapter Three: The Escape") opens each beat; the scene is a sequence of tableaux, each a flat composition with the action inside it.
- Dialogue is formal and fast; the joke is the deadpan and the framing. The scene's turn is a single close-up, centred, of a face not reacting.
- A narrator (if present) reads exposition in the past tense, like a novel, and stops exactly when the picture takes over.
- Ends on a symmetrical wide and a hard cut to the next chapter card.

## The cut

- Average shot 3–7 s; tableaux hold 6–10 s; reaction close-ups 1.5–2.5 s. Nothing under 1 s.
- Straight cuts. Whip pans (in-frame, from the source) and a fast lateral dolly are the transitions; a fade to black or an iris only at a chapter's end.
- Framing: planimetric — the camera perpendicular to the back wall; subjects centred; symmetry; 90° moves; overhead inserts of hands, letters, objects laid out on a table (2–3 s).
- Grade: one palette per scene (pastel pink and mustard; teal and rust); flat, evenly lit; `saturation` slightly up, no vignette; a 4:3 or 1.85 frame accepted; slow motion (`speed` 0.5) for one walking group shot with a song.

## Narration — the storybook narrator

- Third person, past tense, exact dates and proper nouns, dry: "On the fourteenth of March, at eleven minutes past four, the escape began." 60–100 wpm in short bursts between dialogue.
- Voice: crisp, unhurried, slightly amused (`generate_narration` voice leo or sal).
- On-screen text is part of the narration: chapter cards, labels, letters read aloud while shown.

## Sound

- Music is **found** and specific: 1960s British Invasion, French pop, a baroque harpsichord cue, a Mark Mothersbaugh-style plinking score (search "harpsichord baroque CC", "1960s garage pop instrumental library", "toy piano waltz").
- Sync dialogue is the content (`muted: false`); the bed ducks fully under speech and returns loud on the slow-motion group shot.
- Foley is precise and dry (a stamp, a zip, a door) as audio-only clips on the overhead inserts.

## Picture — sources and text

- Sources: generated tableaux ("symmetrical wide shot, pastel pink hotel lobby, a bellboy centred, flat lighting, 1960s, Wes Anderson style, 35 mm"), overhead insert shots of objects, archive only if it can be framed square-on.
- Text: chapter title cards (serif, centred, on a coloured field, 2–3 s); labels on objects; a letter filling the frame while read.

## Do not

- No handheld, no Dutch angles, no depth staging, no naturalistic lighting.
- No off-centre framing unless it is the joke; no dissolves; no emotional swell in the music at the sad line.
- No actor who moves their face; the reaction is the cut.

## Harness parameters

asl 3–7 s · min shot 1 s · transitions cuts (whips) · narration optional, storybook third person, 60–100 wpm · music required, found · sync sync-first · text cards · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: every beat opens with a `card` shot; tableaux 6–10 s, `sound: "sync"`; overhead inserts 2–3 s `sound: "muted"`; the narrator's lines in `script` never overlap dialogue (`check_plan` "one narrator at a time").
- Cut: `update_project saturation 1.15`; `update_segments speed 0.5` on the group walk with the song up; `add_text_overlay` chapter cards style BOX, centred.
- Music: `set_music` the cue; `balance_music` gap 8.
