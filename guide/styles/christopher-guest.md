# Christopher Guest — the mockumentary

Films: *This Is Spinal Tap* (Rob Reiner, with Guest), *Waiting for Guffman*, *Best in Show*, *A Mighty Wind*, *For Your Consideration*, *Mascots*.

## The signature

A documentary crew that everyone in the film believes is real. Sit-down interviews in front of a wall, with people explaining themselves with complete sincerity and no self-awareness; hand-held observational footage of the thing they are preparing for; the comedy is in the gap between what they say and what we see, and in the pause before the cut. Nobody winks. Nothing is underlined.

## Structure — how a scene is built

- The interview sets the claim ("We're basically the most important folk group of our era."); the observation shows the truth (a rehearsal in a garage); the interview returns to explain the truth away; a final beat of silence on a face.
- The scene is one preparation (a rehearsal, a dog wash, a town meeting) followed from start to failure.
- Interviews are two-shots or singles with the subject looking just off lens at the unseen interviewer; the questions are never heard.
- The scene ends on an interviewee's pause — the moment they realise, or don't.

## The cut

- Average shot 4–8 s; interview answers hold 8–20 s (the answer must be allowed to go wrong on its own); observation 3–6 s; nothing under 1.5 s.
- Straight cuts; a cut from the claim to its contradiction is the joke — no music sting, no zoom.
- Camera: interviews locked, slightly too wide or too centred, natural light, a mundane wall or an object behind the subject (a trophy, a plant); observation handheld, a zoom now and then, "stolen" angles.
- Grade: flat, documentary, slightly warm; no vignette; no grade.

## Narration

- None. The interviewees narrate themselves. A title card per subject the first time (name and a self-description they would have written).

## Sound

- Sync sound only: the interviews (`muted: false`, `volume` 1) and the observation with its room (`muted: false`); no score — music only when it is in the scene (the band rehearsing, a tape deck, a PA).
- The pause is the punctuation: hold 1–2 s of room tone after the answer before the cut (`check_cuts` must not trim the pause).
- No sound effects; no laugh cues.

## Picture — sources and text

- Sources: generated interview shots ("documentary interview, a middle-aged man in a sweater sitting in front of a beige wall with a framed photo, looking just off camera, natural window light, 16:9, 2000s DV look"), observational footage (archive of amateur rehearsals, dog shows, small-town events; generated handheld shots).
- Text: lower-thirds in a plain, slightly dated broadcast style (name · self-description), 3–4 s, first appearance only; nothing else.

## Do not

- No music under the joke, no zoom-in on the punchline, no reaction cutaway that tells you to laugh, no narrator.
- No interviewee who knows they are funny; no line that comments on the situation.
- No cut that shortens the answer past its own collapse.

## Type

**The signature.** The 2000s DV-documentary lower-third: plain white sans with a drop shadow, no bar, cut in and out, once per subject.

**Stand-ins.** Liberation Sans for Arial / Helvetica. Faces: Liberation Sans 400. Case: sentence. Colour #FFFFFF on #000000. Entrance: none.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **lower-third (default)** — name · self-description, first appearance. Liberation Sans · 3.6 % · no box · shadow 6 % · none · hold 4 s.

**Never:** caption, callout, card, intertitle, quote, date, label, citation.

**Survey note.** Assumption: Best in Show's lower-thirds imitate television documentary of the time.

## Harness parameters

asl 4–8 s (interviews 8–20 s) · min shot 1.5 s · transitions cuts · narration none · music none (in-scene only) · sync sync-first · text lower-thirds · interviews produced (off-lens, deadpan) · beat-cut no

## Applying it in SlopStudio

- Plan: beats claim / observation / explanation / silence; interview shots `sound: "sync"` 8–20 s with the answer text in `script` as `bite`; observation shots `sound: "sync"`; `music: null`.
- Cut: `update_segments muted:false volume 1` throughout; `check_cuts` clean and out-points after the pause (+1–2 s of room tone); `add_text_overlay` lower-thirds (OUTLINE, bottom-left, 3.5 s) on first appearance.
- Verify: `check_soundtrack` will report no bed and sound bites everywhere — the style.
