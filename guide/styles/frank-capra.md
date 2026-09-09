# Frank Capra — the case for the fight

Films: *Why We Fight* series (1942–45: *Prelude to War*, *The Nazis Strike*, *The Battle of Britain*); features *It's a Wonderful Life*, *Mr. Smith Goes to Washington*.

## The signature

The enemy's own footage turned against him. A narrator who talks to you like a neighbour, with numbers, and a map that moves: arrows, a spreading stain, a globe. Contrast montage: their marching children against our playing children; their leader shouting against our president speaking calmly. Newsreel, animation and a plain, warm, angry voice — the argument of a lawyer who is also your uncle.

## Structure — how a scene is built

- The claim, stated in the first sentence ("This is a fight between a free world and a slave world."); the evidence in three moves (what they did, what it cost, what it means for you); the call ("That's why we fight.").
- The contrast pair is the unit: two shots, one of them, one of us, on the same action; 4–6 pairs per scene.
- Maps carry the geography: a map shot (4–8 s) every time the story moves; arrows and stains animate on the narration's verbs.
- The scene ends on a face (a child, a soldier, a worker) and the narrator's last line.

## The cut

- Average shot 3–6 s; the contrast pairs 2–3 s each; maps 4–8 s; nothing under 1 s.
- Straight cuts; a dissolve into and out of the map; a fade to black at a chapter's end.
- Archive is used as evidence: their newsreels with their titles and their music briefly heard, then cut off by the narrator ("That's what they told their people.").
- Grade: newsreel monochrome (`colorLook` MONO), `grain` medium; maps high contrast.

## Narration — the neighbour

- Second person and first person plural, present tense, plain American speech: "Take a look at this." "They told their people it was self-defence. It wasn't." "Here's what it cost." 100–140 wpm; relentless but warm; numbers as facts ("Sixty million people. Gone from the map.").
- Sarcasm allowed against the enemy's own claims; never against the audience.
- Voice: strong, confident, mid-range (`generate_narration` voice rex).

## Sound

- Music is a **score** of the period: martial themes for us, ominous low strings for them, a hymn at the end (search "1940s orchestral newsreel library", "ominous low strings public domain", "patriotic hymn orchestral CC"); the bed shifts with the contrast pairs.
- Sync sound: the enemy's rallies, their leader's voice for 3–5 s, their anthem, cut off by the narrator; our sound is quiet (a factory, a school).
- Effects on the maps: a drum roll, a boom as a stain spreads (audio-only clips).

## Picture — sources and text

- Sources: archive newsreels (both sides), captured footage, official channels and national archives; generated maps ("1940s animated map, dark arrows spreading across Europe, black and white, hand-drawn style") as AI shots or cards; contrast footage of ordinary life.
- Text: a title card for each chapter (bold sans, on black, 3 s); on the maps, place names as text overlays (2–3 per map); a quotation card of the enemy's own words with attribution (4–5 s).

## Do not

- No neutral tone; no "both sides"; the narrator names the enemy and the cause.
- No stock beauty shots; no modern graphics style; no music with a beat.
- No evidence shown without the narrator saying what it proves.

## Harness parameters

asl 3–6 s · min shot 1 s · transitions cuts (dissolves on maps) · narration required, second person plain speech, 100–140 wpm · music required, period score · sync mixed · text cards · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: beats claim / evidence ×3 / call; contrast pairs as consecutive shots with "THEM:" and "US:" in the descriptions; a `card` map shot per geographic move; enemy sync shots `sound: "sync"` of 3–5 s followed by a narration line.
- Text: `add_text_overlay` chapter titles (BOX, centred) and map labels (OUTLINE); quotation cards as `card` shots.
- Music: `set_music` the period score; `balance_music` gap 7; `audioFadeOutS` 3.
