# Typography and motion: text that reads and stays in frame

Use when a plan has cards, lower-thirds, captions, callouts or a title, or when a
delivered file had text cut off or covered (guide Part II §12).

## 1. Know the frame

`list_typography {projectId}` → the frame, its safe-area profile (auto by aspect:
16:9 → web, 9:16 → social with the platform's caption block / icon rail / status bar
outside title-safe, 1:1 → square) and the title-safe / action-safe rectangles. For
television delivery `update_project {safeArea: "broadcast"}` first. The Live
monitor's ▢ button draws the rectangles.

## 2. Pick the vocabulary once

One family, two weights at most, one entrance animation for the piece. If the brief
names a directing style, `list_typography` says which preset it reaches for
(`stylePreset`); the style file's *Picture — sources and text* section says the rest
(case, colour, where, how long).

## 3. Place text with presets

`add_text_overlay {projectId, preset, text, startS}` — `lower-third` (name / role,
bottom-left, bar, slides up), `callout` (a fact when it is said, top-left), `caption-pop`
(the key word, heavy, outlined, pops), `card-archive` (one line on black, lower-case),
`card-editorial` (serif, centred, fades), `title`, `intertitle`, `quote`, `date-card`,
`map-label`, `mono-note`, `citation`. Override any field. Text anchors to the
title-safe edge; `marginPx` moves it further in. Lower-thirds arrive 0.5 s after the
cut and leave 0.5 s before the next; a card is its own shot.

## 4. Check, then render

`check_text {projectId}` — inside title-safe (error outside action-safe), readable
size, line length (44 / 26 vertical), three lines, reading time (0.8 s + 0.32 s a
word), no two texts at once. Fix everything red, then `render_draft` → `verify_export`
(which repeats the check) → `get_frame` at each text's midpoint and look.

## 5. Captions

Burned-in captions (`captionsEnabled`) take their margins from the same title-safe
rectangle; `captionStyle` OUTLINE over picture, BOX over busy picture, POP for a
retention cut.
