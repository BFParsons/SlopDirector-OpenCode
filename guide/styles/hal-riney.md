# Hal Riney — Morning in America

Work: Reagan–Bush '84 "Prouder, Stronger, Better" ("It's morning again in America"), "Bear"; Bartles & Jaymes, Saturn "A Different Kind of Company", Perrier; the Tuesday Team.

## The signature

A soft, grainy morning: a fishing boat, a wedding, a paperboy, a flag going up, a family moving into a house. A warm, unhurried voice — his own — saying plain sentences with numbers folded in like they were weather. Strings that climb a half-step each time the picture changes. Nothing is argued; a feeling is described, and the candidate's name arrives at the end like the sun coming up.

## Structure — how a spot is built

- A sequence of small, real, sunlit moments (8–12 in 60 s), each an ordinary person doing an ordinary good thing; the narration lays facts over them ("Today more men and women will go to work than ever before in our country's history.").
- The middle raises the stakes gently ("Why would we ever want to return to where we were less than four short years ago?"); the end names the person and the picture is the flag or a family.
- No opponent is shown; the contrast is implied by the word "again".

## The cut

- Average shot 4–6 s; slow dissolves (1–1.5 s) between moments; a longer hold (7–9 s) on the flag or the wedding; nothing under 2 s.
- Camera: slow, gentle moves (a drift, a slow zoom), backlit by low sun, lens diffusion; people never look at the camera; children and old people; wide shots of towns.
- Grade: warm, soft, low contrast, film grain (`colorLook` warm, `grain` 0.25, `contrast` 0.9); flares welcome.

## Narration — the neighbour at dawn

- Third person, present tense, plain declaratives with numbers stated gently: "This afternoon 6,500 young men and women will be married." 70–100 wpm, slow, warm, a little gravel (`generate_narration` voice sal or leo, "warm, unhurried, kindly, as if talking to a friend at breakfast").
- No adjectives of attack; the only comparative is "again", "more", "better".
- The name appears once, at the end.

## Sound

- Music is a **score** of climbing strings and a soft piano: sustained chords that modulate up at each cut, suspended and resolved on the name (search "warm strings modulating uplifting library", "soft piano sunrise CC"); ducking light (the voice sits on it, not above it).
- Sync sound is ambience only — birds, a harbour, a school bell — at −20 dB.

## Picture — sources and text

- Sources: archive of small-town and working life at dawn, weddings, harbours, flags, families (official channels, stock-like archive, uploads); generated shots ("soft golden morning light, a paperboy on a bicycle on a tree-lined street, 16 mm film grain, gentle slow motion").
- Text: the name and a line at the end (serif, centred, warm, 4 s); otherwise none.

## Do not

- No opponent's face, no hard cuts, no fast montage, no dark palette, no rhetorical anger.
- No music with a beat; no sting; no on-screen statistics.
- No sentence longer than 15 words in the narration.

## Type

**The signature.** A warm serif card for the name and the line, soft white, a slow fade.

**Stand-ins.** EB Garamond for a warm serif. Faces: EB Garamond 400, EB Garamond 700. Case: sentence. Colour #FFF6E8 on #000000. Entrance: fade.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **card (default)** — the name and the line at the end. EB Garamond Bold · 5 % · hold 4 s.

**Never:** lower-third, caption, callout, citation, label, intertitle.

**Survey note.** Assumption: the closing card ('President Reagan: Leadership That's Working') is set in a serif; the exact face was not documented.

## Harness parameters

asl 4–6 s · min shot 2 s · transitions dissolves · narration required, warm third person, 70–100 wpm · music required, score (strings) · sync muted · text sparse · interviews none · beat-cut no

## Applying it in SlopStudio

- Plan: one beat of moments, one of the gentle stakes, one of the name; `transition: "dissolve"` on every shot; the last shot's `text` carries the name and line.
- Cut: `update_project transition DISSOLVE transitionMs 1200 colorLook` warm, `grain 0.25`; `update_segments speed 0.8` on two moments.
- Music: `set_music` the strings; `balance_music` gap 5; `audioFadeOutS` 4.
