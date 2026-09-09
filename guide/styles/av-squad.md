# AV Squad — the blockbuster rise

Work: trailers for *Doctor Strange*, *Avengers*, *Star Wars* spots, *Project Hail Mary*, *Top Gun: Maverick* spots; the action-trailer house.

## The signature

A trailer built like a rocket: a quiet cold open with one line, a riser that never stops rising, and a cut that doubles its tempo every twenty seconds until the title, then a button. Music with a beat and a brass hit on every cut of the last act; visual "rhymes" (a punch, a door, a jump) cut on the downbeat; a silence before the biggest shot. The plot is stated in three cards.

## Structure — how a trailer is built

- Cold open (0–15 s): a wide, a line of dialogue, a stinger; black; the studio card.
- Act 1 (15–45 s): who and where, in 6–8 shots over a slow pulse; a card with the premise ("One pilot. One mission.").
- Act 2 (45–80 s): the stakes escalate on a riser; dialogue lines answer each other across cuts; the tempo doubles.
- Act 3 (80–110 s): the money sequence — 12–20 shots on the beat, each a big image (the vehicle, the leap, the explosion), sync hits on every cut; a stopdown (2 s of silence and one slow shot); the title on the biggest hit; a button gag.

## The cut

- Average shot 1.5–3 s; act 3 0.5–1 s on the beat; the stopdown 2–4 s; nothing under 0.3 s.
- Straight cuts; a speed ramp (`speed` 0.5 → 1) on the hero shot; whip transitions rarely; a cut to black before the title.
- The rhythm is the music's grid: `check_beat_alignment` on act 3 must be nearly all on grid.
- Grade: the film's, pushed: `contrast` 1.1, `saturation` 1.1, teal-orange; `vignette` light.

## Narration

- None (the modern blockbuster trailer has no narrator); the cards carry the premise in three lines; dialogue is 8–12 short lines, each cut to land its last word on a hit.

## Sound

- Music is a **trailer cue**: a hybrid orchestral track with a riser, a drop, a beat-driven back half, brass hits (search "epic hybrid trailer music library", "cinematic riser braam CC", "trailer drums build"); the cut is built on it.
- Sound design: braams and hits on the act changes, whooshes on the whips, a sub drop at the stopdown, silence before the title; each as an audio-only clip on the grid.
- Sync: dialogue lines clean and loud (`volume` 1.1); effects from the shots (an engine, a punch) kept where they land on beats (`muted: false`).

## Picture — sources and text

- Sources: the film's footage; for a synthetic trailer, generated hero shots ("wide shot, a fighter jet banking over a desert canyon at sunset, anamorphic, motion blur, 65 mm"), faces, hands on controls.
- Text: premise cards (bold condensed sans, white or the film's type, 2–2.5 s, one line each); the title card animated in with the hit (3–4 s); a date card; a lower-third for the studio at the start.

## Do not

- No shot off the grid in act 3; no dissolves; no long dialogue; no mood-piece silence except the stopdown.
- No dialogue line without a hit under its last word; no card over four words.
- No plot beyond the three cards.

## Harness parameters

asl 1.5–3 s (act 3 0.5–1 s) · min shot 0.3 s · transitions cuts · narration none · music required, trailer cue · sync sync-first (lines and hits) · text cards · interviews none · beat-cut yes

## Applying it in SlopStudio

- Plan: four beats (cold open / act 1 / act 2 / act 3 + button); act 3 shots on the cue's beat grid with a hit per cut; three premise `card` shots; the title card after the stopdown.
- Cut: `analyze_audio` the cue for its grid; `apply_edit_list` the act-3 sequence at the grid; `add_segment audioOnly` braams/hits/whooshes; `update_segments speed 0.5` on the hero shot; `check_beat_alignment toleranceFrames 2`.
- Music: `set_music` the cue, `volume 0.8`, ducking on for the lines; `audioFadeOutS` 0.
