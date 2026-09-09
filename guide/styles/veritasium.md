# Veritasium — the misconception

Work: Derek Muller's channel: "The Most Misunderstood Concept in Physics", "Why Machines That Bend Are Better", "The Big Misconception About Electricity", "Why Are 96,000,000 Black Balls on This Reservoir?"; the early street interviews.

## The signature

Start with what everyone believes, let people say it on camera, then take it apart — with a demonstration you can see, a diagram drawn on screen, an expert in their lab, and the host's own doubt. Clarity numbs; confusion opens. The video builds a question, makes it worse, then resolves it in a way you will remember because you were wrong first.

## Structure — how a video is built

- The question (0–30 s) posed as a common belief, with two or three street answers (sync bites, 3–5 s each) that share the misconception.
- The demonstration (30 s–2 min): a physical experiment, shown simply, that contradicts the belief; the host reacts honestly.
- The explanation, layered: a diagram drawn as it is explained (kinetic text and simple graphics), an expert interview (produced, 10–20 s bites), a second demonstration at scale.
- The reframe: the belief restated correctly; why the misconception exists; a last image of the demonstration.

## The cut

- Average shot 3–6 s; demonstrations hold 8–15 s (the viewer must see it happen unedited); interviews 5–15 s; diagrams 6–12 s; nothing under 1.5 s.
- Straight cuts; a diagram overlay animates in on the narration's nouns; a slow-motion replay (`speed` 0.25) of the demonstration once.
- Camera: the host in the field or a workshop, medium; the experiment locked off and wide, then a detail; the expert in their own place (produced, off-lens); drone for scale.
- Grade: natural, clean, slightly warm.

## Narration — the curious host

- First person, present tense, plainly curious, admitting confusion: "I thought this was obvious. It isn't." 130–150 wpm; questions to the viewer ("So what's going on?"); the reframe stated in one memorable sentence.
- Voice: the host's (sync) or `generate_narration` voice rex, "curious, clear, thinking aloud".

## Sound

- Music is a **light bed** of curiosity (a plucked, minimal, slightly wondering cue) that drops out for the demonstration and returns for the explanation (search "curious plucked strings library", "science documentary light bed CC"); ducked 8 LU under speech.
- Sync: the host and the experiment's real sound at full level (a snap, a hum, a splash — the sound is evidence); street bites clean.
- A single hit when the demonstration contradicts the belief is allowed.

## Picture — sources and text

- Sources: the project's own demonstrations; generated shots ("wide static shot of a physics demonstration on a wooden table, a chain lifting from a beaker, natural light, 4K"); expert interviews (generated, off-lens, in a lab); street bites (archive or generated); diagrams as cards / text.
- Text: the belief as a card ("Everyone thinks: …", 3 s); diagrams with labelled parts (kinetic text on a clean field); a number or a unit as a callout when spoken; the expert's lower-third (name · institution, 3 s).

## Do not

- No explanation before the demonstration; no diagram that is not drawn on the narration's words; no stock footage of "science".
- No fast cutting; no music under the demonstration; no cut inside the demonstration.
- No claim without the demonstration or the expert.

## Harness parameters

asl 3–6 s (demonstrations 8–15 s) · min shot 1.5 s · transitions cuts (diagrams animate in) · narration required, first-person curious host, 130–150 wpm · music required, light bed (out under demos) · sync sync-first · text kinetic (diagrams, callouts, lower-thirds) · interviews produced + street bites · beat-cut no

## Applying it in SlopStudio

- Plan: beats question / demonstration / explanation / reframe; street bites `sound: "sync"` 3–5 s; the demonstration shot 8–15 s `sound: "sync"` with no narration over it; diagram `card` shots with `text`; expert bites with lower-thirds.
- Cut: `update_segments speed 0.25` on the replay; `add_text_overlay` labels and lower-thirds; `check_plan` "narration over sync" must be clean for the demonstration.
- Music: `set_music` the bed; `balance_music` gap 8; the bed as an audio-only clip in two ranges (before and after the demonstration) if the cut wants it out completely.
