# Michael Moore — the first-person polemic

Films: *Roger & Me*, *Bowling for Columbine*, *Fahrenheit 9/11*, *Sicko*.

## The signature

The filmmaker is a character. He tells you what happened to him, in the past tense, with a straight face, and the footage contradicts or confirms him for laughs. Cheerful old songs play under terrible things. Institutions are confronted on camera and the camera keeps rolling while they say no.

## Structure — how a scene is built

- The scene has an argument and a punchline. Open on the claim, in the narrator's voice; build with archive and interviews; land on an ironic cut — the corporate slogan, the smiling official, the song's happiest line under the worst image.
- Confrontation sequences run on sync sound: the walk up, the receptionist, the "he's not available", the door. 20–40 s of uninterrupted sync; the narration returns only to summarise.
- Repetition is a joke: the same clip a second time, a beat later, after the narration has reframed it.
- End the scene on the punchline; do not explain it.

## The cut

- Average shot 3–6 s; montage 2–3 s; confrontations and bites as long as they need. Nothing under 1 s.
- Straight cuts. A dissolve only inside a montage of stills or headlines. Never fade to black mid-scene.
- Archive is chosen for irony first: 1950s industrial films, commercials, training films, old news anchors, politicians smiling. Corporate and government footage is the best material.

## Narration — first person

- "I", past tense, conversational, deadpan; short sentences; the joke is in the understatement, not the adjectives. "So I went to see him." "They said he was busy." "He was busy for eleven years."
- 90–130 words a minute; it can run under montage, but stops dead for the confrontation and the key bite.
- Facts are stated flatly with numbers ("Forty thousand jobs. One town."). A rhetorical question is allowed once a scene.
- Voice: warm, unpolished, a little tired (`generate_narration` voice rex or sal).

## Sound

- Music is **found**, ironic: a cheerful standard, a patriotic anthem, a corporate jingle, a 1960s pop song under the grim pictures. Lyrics matter (pick the line, place it on the image). Search by title and era; CC or library covers when the original is unusable.
- The bed ducks under narration; it cuts hard on the punchline.
- Sync sound is the content of confrontations and street interviews: `muted: false`, `volume` ~1, and the bed out. Keep the awkward silence.

## Picture — sources and text

- Sources: news archive, corporate and industrial films, commercials, C-SPAN-style footage, street interviews (with the filmmaker in frame when generating shots: a big man in a cap and a windbreaker, mic in hand).
- Lower-thirds: name · title, plain, as a broadcast would do it, held 3 s. Gag cards are allowed ("Actual footage", "Two days later"): one per scene at most.
- Graphics: a headline or a document filling the frame, 3–4 s, with the key line highlighted.

## Do not

- No neutral narration; no "some say". The narrator has a side.
- No slow-motion for pathos; no piano bed under the sad part (the ironic song does that job).
- No cut that makes a subject say what they did not say (RULES 4); the joke is the arrangement, not the edit inside the sentence.

## Harness parameters

asl 3–6 s · min shot 1 s · transitions cuts · narration required, first person, 90–130 wpm · music required, found (ironic) · sync sync-first · text lower-thirds · interviews confrontation

## Applying it in SlopStudio

- Plan: every beat ends on a shot marked as the punchline in `description`; confrontations are `sound: "sync"` shots of 15–40 s with no narration line over them (`check_plan` flags narration over sync).
- Clip list: queries pair the subject with the ironic source ("1950s industrial film assembly line", "company promotional video 1990s", "congressional hearing …").
- Music: `set_music` the song; `balance_music` gap 4–6 (the song is meant to be heard); place the lyric line with `update_segments offsetS` if the bed is added as an audio-only clip instead.
- Text: `add_text_overlay` lower-thirds, style OUTLINE, bottom-left.
