# Typography and motion: text that reads and stays in frame

Use when a plan has cards, lower-thirds, captions, callouts or a title, or when a
delivered file had text cut off or covered (guide Part II §12).

## 1. Know the frame

`list_typography {projectId}` → the frame, its safe-area profile (auto by aspect:
16:9 → web, 9:16 → social with the platform's caption block / icon rail / status bar
outside title-safe, 1:1 → square) and the title-safe / action-safe rectangles. For
television delivery `update_project {safeArea: "broadcast"}` first. The Live
monitor's ▢ button draws the rectangles.

## 2. Design the film title separately from supporting text

A title identifies the clip or film. Supporting text communicates within it.
Decide which job the words do before choosing their appearance. A large accusation,
chapter heading, quotation or closing CTA is still supporting text, not the film's
name. The project's library name is metadata; it does not automatically appear on screen.

| | Film title (`title`) | Supporting text (other roles) |
|---|---|---|
| Purpose | Establish the film's identity; one memorable display treatment | Explain names, places, claims, chapters and sources |
| Scale | Start around 8–12% landscape frame height, 6–8% portrait; adjust to the words and safe area | Usually 3–5%; statement cards 4–6%; deliberately emphatic captions may be larger |
| Composition | One or two intentional lines, generous empty space, a clear focal point; centre or compose around the subject | A consistent anchor and readable measure; avoid covering the subject |
| Typeface | One display face selected for this film; may differ from captions | One supporting family, usually no more than two weights; a planned serif for quotes is allowed |
| Palette | A chosen title color and background, with at most one meaningful accent | A neutral readable color plus a consistent accent for emphasis |
| Timing | A dedicated reveal and readable hold, usually 3–5 seconds; can follow the opening hook or land at the end | Follow the information or spoken phrase; hold for reading time |
| Motion | One intentional entrance/exit tied to the cut or score; stillness is a valid treatment | A repeatable, restrained entrance vocabulary |

These are starting points, not a requirement to enlarge every quiet filmmaker's
title. Prominence also comes from isolation, contrast, timing and negative space.
An understated title alone on black can dominate more effectively than a giant
caption over a busy image. Preserve explicit quiet title designs in the style
profiles. Break long titles into deliberate lines before reducing their size.
Subtitle/tagline text should be visibly subordinate (roughly 35–50% of the title
size when readable), separated spatially and checked for overlap. Keep other
callouts off the title's reveal; do not obscure necessary accessibility captions.

For example, a historical attack ad could use a large cream serif film title on
charcoal, with white condensed captions and red accusations within the film.
`HIS FAILURE` remains a caption; `VOTE HIS ALLIES OUT` remains a closing card.
They do not become film titles just because they are bold or occupy the whole frame.

The director style guides both treatments without forcing them to be identical.
`list_typography` returns `hierarchy`, `styleType.roles.title` (including a fallback
when needed) and the supporting roles. Explicit font/color/size overrides win.
A custom title font is allowed; supporting text retains its own consistency rules.
The checker still tests titles for safe areas, reading time and overlaps.

During planning, propose the exact title, its timing, font, case, size, colors,
background and reveal separately from supporting typography. Put these in the
plan's `notes` and the corresponding timed script/shot entries. A standalone piece
may omit a title if that serves the brief; state the choice. A scene within a longer
film inherits the parent's identity and gets no new film-title sequence unless
requested. Do this after the quick interview, without extra per-answer processing.

In the editor, **Film titles** and **Supporting text** have separate add buttons.
Both retain editable font, color, size, placement and timing. The **Purpose** menu
reclassifies existing text while preserving its appearance; it does not silently
restyle a reviewed overlay. New manual items use generic presets; the harness uses
the brief's style via `role`. Existing untagged text stays in Supporting text until
classified explicitly. A title over a solid field needs that background shot too;
the title role itself does not insert footage or reserve timeline duration.

## 3. Place text through the style's roles

If the brief names a directing style, `list_typography {projectId}` returns its
`styleType`: the surveyed signature, the stand-in faces, the case, the colour, the
entrance and the roles (title, card, intertitle, lower-third, caption, callout,
citation, date, quote, label, credit) with what each is for. `add_text_overlay
{projectId, role, text, startS}` fills everything from it — a Curtis card is white
Helvetica (Liberation Sans) in sentence case on black, cut in; a Nolan card is spaced
Montserrat capitals; a MrBeast caption is Anton with a black outline popping on the
word. The roles the style never uses are departures to name in notes. The no-text
styles (Herzog, Wiseman, Jennings, Malick, Cunningham) still allow a film title and
any credits explicitly defined by their profile; supporting overlays are departures.

## 3b. Or with the generic presets

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
