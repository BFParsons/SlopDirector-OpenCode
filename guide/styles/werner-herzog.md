# Werner Herzog — the ecstatic truth

Films: *Grizzly Man*, *Encounters at the End of the World*, *Cave of Forgotten Dreams*, *Lessons of Darkness*, *Into the Abyss*.

## The signature

The director narrates in his own voice, slowly, in accented English, and says what he thinks. Landscapes are held until they become strange. People are asked one question too many and the camera stays on them after they have finished answering. Choral and sacred music turns a burning oil field or a penguin into a vision. The film is not afraid to be wrong, or ridiculous, in pursuit of a truth that facts cannot reach.

## Structure — how a scene is built

- The scene is a meditation on one image or one person. It opens on the image, silent or with music, for 15–30 s before a word is spoken.
- Narration arrives as a thought, not an explanation: an observation, a doubt, a question with no answer ("What are the penguins' dreams?"). Then silence again.
- A person speaks, at length, and the shot holds 3–5 s after they stop — the discomfort is the content.
- The scene ends on the landscape, wide, with the music, and a last sentence that opens rather than closes.

## The cut

- Average shot 8–20 s; landscapes 15–40 s; interviews 20–60 s. Nothing under 4 s.
- Straight cuts; a slow dissolve (2–3 s) only between two landscapes as time passes. No cuts to black inside a scene.
- Slow motion (`speed` 0.4–0.6) on one shot per scene, with the music: a wave, a flame, an animal, a face.
- Aerials and wides are long and continuous; a helicopter shot is not cut into pieces.
- Grade: natural, slightly cool or slightly warm, never stylised; grain welcome.

## Narration — the director

- First person, present tense where possible ("I look at this and…"); the narrator is a person with opinions, awe and a dark sense of humour.
- Sentences are simple and declarative, then one long one that wanders. Words like "abyss", "ecstasy", "the indifference of nature", "a fever dream" are allowed, once.
- 30–60 words a minute over the whole scene; long silences (10–30 s) between thoughts. Never over a person's speech.
- Voice: slow, low, deliberate, deadpan, an accent is fine (`generate_narration` voice leo or sal; instruct "slow, flat, a slight German cadence, no drama in the delivery").

## Sound

- Music is **choral** or sacred or drone: choirs, Wagner-scale strings, cello drones, Sardinian or Georgian polyphony, sustained organ (search "choral drone public domain", "sacred choir a cappella CC", "Requiem strings library"). It comes in on the landscape and swells where the picture is most indifferent.
- The bed ducks under the narration but stays audible; it goes out entirely under the interviews (a person is heard in a silent room).
- Sync sound: wind, engines, ice, birds, the room — the shots keep their ambience (`muted: false`, `volume` 0.5–0.8) under narration and are fully open in the holds.

## Picture — sources and text

- Sources: landscapes and wildlife (archive, official channels, generated shots: "wide static shot of …, natural light, long lens, no people, 35 mm film grain"), long interviews (produced, the subject looking slightly off lens, a plain background, natural light), found footage with its owner's voice (home video, expedition footage).
- Text: none inside a scene. A title only for a standalone piece.

## Do not

- No lower-thirds, no maps, no graphics, no montage of quick shots.
- No music with a beat; no sting, no swell at "the sad part".
- No narration that explains what is in the shot; it says what is not.
- No cutting away from a person because the silence is awkward.

## Harness parameters

asl 8–20 s · min shot 4 s · transitions cuts · narration required, the director's voice, 30–60 wpm · music required, choral · sync mixed · text none · interviews produced

## Applying it in SlopStudio

- Plan: few shots (a 2-minute scene has 6–10); the first and last are `sound: "sync"` holds with no narration; narration lines carry `note: "slow; 20 s silence before"`; one shot's description names the slow motion.
- Cut: `update_segments speed 0.5` on the chosen shot; `muted: false` with `volume 0.6` on ambience shots.
- Music: `set_music` the choral track; `balance_music` gap 6; `audioFadeOutS` 4–6 at a chapter end, 0 at a scene hand-off.
- Verify: `pacing_report` with the style (8–20 s is the norm, not a fault); `check_mix_levels` will flag narration density as low — that is correct here.
