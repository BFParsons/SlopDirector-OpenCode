# LEMMiNO — the dark documentary

Work: "Consumed by the Apocalypse", "The Search for D.B. Cooper", "Cicada 3301", "Top 10 Facts", "The Dyatlov Pass Case"; David Wångstedt's channel, made alone.

## The signature

A dark, slow, meticulously researched documentary made from maps, documents and photographs: a black background, a clean serif, a map that lights up its region, a photograph with a slow drift, a document with a phrase highlighted, a diagram animated exactly on the narration; a deep, calm narrator who never editorialises; original ambient music with a single motif. Forty minutes without a talking head. Every claim has a source in the description.

## Structure — how a video is built

- A cold open on the mystery's most concrete detail (a photograph, a number, a quote) over black; the title.
- Chapters, chronological, each opening on a map or a date card; each built claim by claim (document → photograph → diagram → the narrator's plain sentence); a "however" at the end of each.
- Competing theories weighed in turn, each given its evidence and its holes; no verdict beyond what the evidence allows.
- The ending returns to the opening detail with what is now known; the sources listed on a card.

## The cut

- Average shot 5–10 s; documents 6–12 s (long enough to read the highlight); maps 6–10 s; nothing under 2 s.
- Slow dissolves (1–1.5 s) between stills on black; a fade to black between chapters; straight cuts onto a date card.
- Motion: every still drifts (`imageMotion` slow push or pan); maps animate a region filling and a route drawing; a diagram builds in three steps; nothing snaps.
- Grade: dark; stills desaturated 20 % with a slight cool tone; black backgrounds; `vignette` 0.4.

## Narration — the archivist

- Third person, past tense, measured, dense with specifics (dates, names, distances), never rhetorical: "At 8:13 pm, the aft stairs were lowered. The aircraft was over the Lewis River." 110–130 wpm; long paragraphs with a 2–3 s pause between chapters.
- Voice: deep, calm, slightly Scandinavian-English (`generate_narration` voice leo, "low, calm, precise, unhurried, no emphasis").

## Sound

- Music is an **ambient score** with one motif: a slow synth pad, a piano note, a low pulse in the tense chapters (search "dark ambient documentary score library", "minimal piano motif CC", "slow synth pad drone"); continuous, ducked 8–10 LU, swelling only at a chapter's end.
- Sound design: subtle — a paper slide when a document appears, a low thud on a date card, wind under a map (audio-only clips at −20 dB); no hits, no risers.
- No sync sound; archive clips play muted with their own sound at −25 dB if at all.

## Picture — sources and text

- Sources: photographs, documents, maps, diagrams, newspaper pages (archives, public-domain collections, official records, uploads); short archive clips; generated maps and diagrams ("dark map of the Pacific Northwest, a single route glowing, minimal, black background") as cards.
- Text: a clean serif on black — chapter titles (3–4 s), date cards (2–3 s), highlighted phrases on documents (a translucent bar, 4–6 s), map labels (small caps), a sources card (10 s).

## Do not

- No talking heads, no host, no stock footage, no speculation stated as fact, no music sting, no fast cut.
- No still without motion; no document without a highlight; no chapter without a map or a date.
- No adjective in the narration that judges.

## Harness parameters

asl 5–10 s · min shot 2 s · transitions dissolves (black between chapters) · narration required, third-person archivist, 110–130 wpm · music required, ambient score · sync muted · text cards (serif on black) · stills yes · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: chapters as beats opening on a `card` (date or map); stills with `imageMotion` in every description; document shots list the highlighted phrase as `text`; a sources `card` last.
- Cut: `update_project transition DISSOLVE transitionMs 1200 vignette 0.4 saturation 0.8`; `update_segments imageMotion` on every still; `add_text_overlay` highlights (BOX, translucent) and labels.
- Music: `set_music` the ambient score; `balance_music` gap 9; `audioFadeOutS` 4.
