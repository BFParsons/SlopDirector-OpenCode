# MKBHD — the clean review

Work: Marques Brownlee's channel: phone, camera and car reviews; "Smartphone Awards"; *Waveform*; the red-and-black studio.

## The signature

A dark studio with one red accent; the product on a matte surface, lit like jewellery; macro b-roll that glides (a slider, a probe lens) while a calm voice says exactly what it thinks. Sections announced by a clean title; a spec on screen exactly when it is said; no hype, no filler, no "guys". It looks expensive because everything unnecessary was removed.

## Structure — how a video is built

- Cold open (0–15 s): the thesis about the product in two sentences, over the hero b-roll; the title card.
- Sections (each 1–3 min): design, screen, performance, camera, battery, price — each opens with a section title, makes one claim, shows the evidence (a demo, a comparison, a graph), and ends with a verdict sentence.
- The conclusion: who it is for, in three sentences, over the product turning on the table; the sign-off card.

## The cut

- Average shot 3–6 s; b-roll glides 4–8 s; the host to camera 5–15 s (few jump cuts); demos as long as they need; nothing under 1 s.
- Straight cuts; a clean slide or a quick fade to the section title; no whips, no snap zooms, no dissolves between b-roll.
- Camera: the host at a desk, medium, shallow depth, the red accent behind; b-roll on a slider, macro, slow; the product from three angles per section; screen recordings full-frame.
- Grade: cool neutral, deep blacks, controlled highlights (`contrast` 1.1, `saturation` 0.95, no vignette); the red is the only saturated colour.

## Narration — the reviewer

- First person, present tense, measured, specific, opinionated without heat: "This is the best screen on any phone. It's also the reason the battery is what it is." 130–150 wpm; every claim followed by its evidence; no adjectives without a number.
- Voice: calm, warm, unhurried (`generate_narration` voice rex, "measured, clear, quietly confident").

## Sound

- Music is a **low-key bed**: lo-fi, minimal electronic, no vocals, no drums that pull attention (search "lofi minimal background library", "ambient electronic bed CC"); ducked 10 LU under the voice; changes per section.
- Sync: the host's voice (`muted: false`), the product's sounds in demos (a click, a shutter, a speaker test at full level for 3–5 s).
- No sound effects beyond the product's own.

## Picture — sources and text

- Sources: the project's own product footage; generated b-roll ("macro slider shot of a matte black phone on a dark table, a single red light accent, shallow depth of field, 4K, studio"); screen recordings; comparison tables as cards.
- Text: section titles (clean geometric sans, white, lower-left, 2–3 s); specs and numbers as small callouts exactly when spoken (2–3 s); a comparison table as a card (5–8 s); no captions.

## Do not

- No hype words, no "guys", no jokes at the product's expense, no fast cuts, no snap zooms, no bright colour except the red.
- No spec on screen that is not spoken; no claim without a demo.
- No music with vocals; no sound effects.

## Harness parameters

asl 3–6 s · min shot 1 s · transitions cuts (clean title slides) · narration required, first-person reviewer, 130–150 wpm · music required, low-key bed · sync sync-first · text lower-thirds (titles + callouts) · interviews direct-address (host at desk) · beat-cut no

## Applying it in SlopStudio

- Plan: beats = sections with a claim / evidence / verdict each; b-roll shots 4–8 s `sound: "vo"`; demo shots `sound: "sync"`; section titles and callouts as `text` lines.
- Cut: `add_text_overlay` titles (OUTLINE or BOX, lower-left) and callouts; `update_project contrast 1.1 saturation 0.95`.
- Music: `set_music` the bed; `balance_music` gap 10; `check_mix_levels` speech −16 LUFS short-term.
