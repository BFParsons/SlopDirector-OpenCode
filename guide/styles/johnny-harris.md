# Johnny Harris — the map essay

Work: Vox *Borders*, "Why the US has so many Filipino nurses", "How the US stole thousands of Native American children", the independent channel's geopolitics explainers; the Vox house style (no desks, no talking-head backbone).

## The signature

A first-person journalist standing in front of a wall of paper, and then a map: clean, label-free, zooming down to a region that fills with an accent colour, borders drawing themselves, callouts landing exactly on the words. Archive stitched between, a photograph pinned to the wall, a document with a line underlined, kinetic type that states the point in three words. Every animated element answers a question the narration just asked.

## Structure — how an essay is built

- The question in the first 15 s, personal ("I kept seeing this, and I couldn't figure out why."), over a map zooming in.
- Three or four chapters, each moving in space (the map travels) and time (a date card); each built from the map → the archive → the document → the interview or the on-location shot → the point as kinetic type.
- A personal on-location beat (the journalist walking, talking to camera, in the place) in the middle chapter.
- The ending widens the map back out; the point restated in one sentence; the title.

## The cut

- Average shot 3–6 s; maps 5–10 s (a camera move: zoom, orbit, tilt); archive 2–4 s; on-location 4–8 s; nothing under 1 s.
- Straight cuts; the map moves are the transitions; a photograph "pinned" onto the wall (a card with a slow push); type animates in on the word.
- Camera: the journalist in front of a paper wall (medium, direct to lens), handheld on location; the map as a 3D camera (orbit + tilt); archive with slight motion.
- Grade: the map palette — off-white, one accent colour, thin lines; archive warm; the wall neutral.

## Narration — the journalist

- First person, present tense, curious and plain, with the question re-asked at each chapter: "So why does this line exist?" 140–160 wpm; sources named in speech ("according to the 1898 treaty"); the point as a short sentence.
- Voice: the host's (sync) or `generate_narration` voice rex, "curious, quick, clear, a journalist thinking aloud".

## Sound

- Music is a **library bed** with movement: a pulse, a piano, a light electronic drive under the maps; a warmer cue for the on-location beat; out under an interview (search "documentary explainer pulse bed library", "light piano electronic CC"); ducked 8 LU.
- Sound design on the maps: a soft whoosh on the zoom, a tick on a label, a paper slide on a pinned photo (audio-only clips at −18 dB).
- Sync: the journalist to camera and on location (`muted: false`); archive muted under narration.

## Picture — sources and text

- Sources: generated map shots as cards ("clean minimal map, off-white land, thin grey borders, one country highlighted in orange, camera zooming down and orbiting, no labels"), archive (news, official channels, national archives), photographs and documents (public domain), the journalist (generated: "a man in a plain shirt in front of a wall covered in pinned papers and maps, medium, direct to lens").
- Text: kinetic type — the point in 2–4 words (bold sans, accent colour, 1.5–2.5 s), map labels landing on the words, a date card (serif, 2–3 s), a source citation small under a document (2 s), an interviewee's lower-third.

## Do not

- No desk, no talking head as the spine, no stock footage, no map with default labels, no type that repeats the whole sentence.
- No archive without a source; no claim without a document or a named source.
- No animation that does not answer the narration's question.

## Harness parameters

asl 3–6 s (maps 5–10 s) · min shot 1 s · transitions cuts (map moves) · narration required, first-person journalist, 140–160 wpm · music required, pulse bed · sync mixed · text kinetic (type, labels, date cards, citations) · interviews direct-address (journalist) + produced (sources) · beat-cut no

## Applying it in SlopStudio

- Plan: chapters as beats each opening on a map `card` and a date `card`; the on-location beat in the middle with `sound: "sync"` shots; kinetic type as `text` lines at the narration's points; every archive shot's description names its source.
- Sourcing: `search_youtube` on official and archive channels; `youtube_captions` to find the quoted moment.
- Cut: `add_text_overlay` type (POP, accent colour) and labels; `update_segments imageMotion` push on photographs; `add_segment audioOnly` whooshes and ticks at −18 dB.
- Music: `set_music` the pulse bed; `balance_music` gap 8.
