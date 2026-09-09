# The Lincoln Project — the prosecution

Work: "Mourning in America", "Covita", "Wake Up", "Fellow Traveler", the 2020–2024 anti-Trump spots. A house style built by former Republican admen (Rick Wilson, Steve Schmidt, Reed Galen, Ben Howe's editors), fast, cheap and personal.

## The signature

The subject's own words, cut against the pictures of what they cost. A grim voice, a single bass note, a ticking edit that speeds up; captions in bold white type that repeat the accusation as it is spoken; grainy footage of hospital corridors, empty streets, a golf swing. It is an attack that pretends to be a mourning; a parody that pretends to be an anthem. Sixty seconds, made in a day.

## Structure — how a spot is built

- The frame: borrow a familiar form (Morning in America, a movie trailer, a pharmaceutical ad, a musical) and invert it in the first line.
- The evidence: 4–6 of the subject's own clips (sync sound, 2–4 s each) each answered by a picture of consequence and a line of narration; the numbers on screen.
- The verdict: the narrator states it plainly; a card with the accusation; the subject's face, unflattering, frozen; the logo.
- Optional sting: one more clip of the subject after the card, unanswered.

## The cut

- Average shot 2–4 s; the evidence pairs 2–3 s; the opening frame-borrowing 4–6 s; accelerating toward the verdict (1–1.5 s). Nothing under 0.7 s.
- Straight cuts; a hard cut to black before the verdict; a slow push-in (`imageMotion`) on the subject's frozen face.
- Footage is deliberately rough: news archive, C-SPAN, phone video, official pool footage, with its bugs and timecodes; the subject's clips are at their least flattering (mid-blink, mid-gesture).
- Grade: desaturated, dark, high contrast (`saturation` 0.7, `contrast` 1.15, `vignette` 0.3); the borrowed form's palette in the opening only.

## Narration — the grim narrator

- Third person, present tense, short declaratives, the subject's name or "he" every sentence; 100–130 wpm; deadpan, low, disgusted rather than angry (`generate_narration` voice leo, "low, grave, slightly weary, no shouting").
- Numbers as accusations: "Two hundred thousand dead. He played golf."
- The last line is short and final ("America needs a president. Not a con man.").

## Sound

- Music is a **cue** of dread: a low sustained bass note, a ticking or a slow heartbeat, a rising tension pad, a single hit at the verdict (search "dark tension pad low bass library", "ticking clock tension cue CC"); or the borrowed form's music played straight until the turn.
- Sync sound: the subject's own words at full level (`muted: false`, `volume` 1.1), unducked; the bed drops under them.
- A stinger (a boom, a reverse hit) as an audio-only clip at the cut to black.

## Picture — sources and text

- Sources: the subject's own appearances (official channels, C-SPAN, news archive, pool footage), consequence footage (hospitals, closed shops, funerals — archive and news, `licence` archives), unflattering stills.
- Text: bold condensed white captions of the narration's key phrases as they are spoken (2–3 words, 1.5–2 s each, centred low), the numbers big; the verdict card white on black (4 s); a source citation in small type under any claim.

## Do not

- No cut inside the subject's sentence that changes its meaning (RULES 4: the clip must say what they said); the attack is the juxtaposition, not the edit.
- No cheerful music unless it is the borrowed form's, and then it turns.
- No lower-third of the subject (everyone knows who it is); no still that is not a real frame.

## Harness parameters

asl 2–4 s · min shot 0.7 s · transitions cuts (one cut to black) · narration required, grim third person, 100–130 wpm · music required, cue (dread) · sync sync-first · text kinetic captions · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: beats frame / evidence / verdict / sting; evidence pairs as consecutive shots (bite `sound: "sync"` then consequence `sound: "vo"`); the captions as `text` lines in `script` at the narration's timestamps; a `card` for the verdict.
- Sourcing: `youtube_captions` on the subject's own channel to find the exact quotes before importing (the words are the evidence).
- Cut: `update_project saturation 0.7 contrast 1.15 vignette 0.3`; `add_text_overlay` captions style BOX, centred low; `check_cuts` must be clean on every bite (the meaning must survive).
- Music: `set_music` the dread cue; `balance_music` gap 6; `check_mix_levels` bites ≥ 12 LU over the bed.
