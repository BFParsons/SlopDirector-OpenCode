# Mark Rober — the build

Work: "Glitter Bomb" (porch pirates), "World's Largest Nerf Gun", "Squirrel Maze", "Backyard Squirrel Maze 2.0", "Egg Drop From Space", "Ocean Cleanup"; a former NASA engineer's channel.

## The signature

A problem, a plan, a build, a test that fails, a fix, a test that works, a payoff you can see from the air. Engineering explained with drawings and a grin; a whiteboard, a 3D model spinning, a montage of the build set to music; slow-motion of the moment it works; cameras hidden everywhere for the reaction. The host is the enthusiastic explainer; the video is a story with a machine as the hero.

## Structure — how a video is built

- The problem (0–30 s): the thing that annoys or delights, shown; the promise ("so I built…") with a flash-forward of the payoff (2–3 s).
- The plan (30 s–2 min): the drawing (a whiteboard or a 3D model), the physics in one analogy, the parts.
- The build (montage, 60–90 s): fast, to music, with three small jokes and one failure.
- Test, fail, fix (2–4 min): the first test fails visibly; the diagnosis; the fix; the second test succeeds in slow motion from four angles.
- The payoff (1–3 min): the machine in the world; the hidden-camera reactions; the numbers; the message (a cause, a lesson) in three sentences.

## The cut

- Average shot 2–4 s; the build montage 0.8–1.5 s; the success in slow motion 4–8 s per angle; reactions 2–4 s; nothing under 0.5 s.
- Straight cuts; snap zooms on the host's reactions; a "replay" with a graphic; whips in the montage; no dissolves.
- Camera: the host to camera in the workshop, wides of the machine, GoPros on the machine, phantom-style slow motion (`speed` 0.1–0.25) for the success, drone for the payoff.
- Grade: bright, warm, clean (`saturation` 1.1); no vignette.

## Narration — the engineer

- First person, past and present tense, enthusiastic, clear analogies, numbers: "That's about the weight of a small car — and it has to stop in a tenth of a second." 140–160 wpm; a laugh at his own failure; the message plain at the end.
- Voice: the host's (sync) or `generate_narration` voice rex, "enthusiastic, clear, friendly, an engineer who loves this".

## Sound

- Music is a **library bed** that changes with the phase: light and curious for the plan, driving for the build montage, tense for the test, triumphant for the success (search "upbeat build montage library", "playful curious bed CC", "triumphant orchestral pop"); ducked under the voice; out for the slow-motion success (the machine's own sound, slowed).
- Sync: the host, the machine, the reactions (`muted: false`, `volume` 1); a riser before the test; a hit on the failure (comic) and on the success.

## Picture — sources and text

- Sources: the project's own build footage; generated shots ("a man in a workshop drawing on a whiteboard, medium, bright, 4K", "slow motion of a spinning contraption launching, high speed camera look"); 3D-model turntables as cards; hidden-camera reactions.
- Text: the physics labels on the drawing (kinetic text over the whiteboard, 3–5 s); numbers as callouts; a "Test 1" / "Test 2" card; the cause's name and a link card at the end.

## Do not

- No build without a failure; no success without slow motion; no message before the payoff.
- No dissolves; no music under the slow-motion success; no shot of the plan longer than 5 s without a drawing on it.
- No number without a comparison.

## Type

**The signature.** Heavy geometric capitals for numbers and test cards, semi-bold labels on the drawings, outlined white.

**Stand-ins.** Montserrat for the geometric sans. Faces: Montserrat 900, Montserrat 600. Case: upper. Colour #FFFFFF on #000000. Entrance: pop.

**Roles** (`add_text_overlay {role}` with this style in the brief):

- **label (default)** — a physics label on the whiteboard. Montserrat SemiBold · 3 %.
- **callout** — a number with its comparison. Montserrat Black · capitals · 5 % · center · no box · outline 8 %.
- **card** — 'TEST 1' on black. Montserrat Black · capitals · 6 %.

**Never:** quote, intertitle, citation.

**Survey note.** Assumption: the channel's face was not documented; heavy geometric capitals are the manner.

## Harness parameters

asl 2–4 s (montage 0.8–1.5 s, success 4–8 s) · min shot 0.5 s · transitions cuts (snap zooms, whips) · narration required, first-person engineer, 140–160 wpm · music required, phase beds · sync sync-first · text kinetic (labels, callouts, test cards) · interviews direct-address (host) · beat-cut yes (the build montage)

## Applying it in SlopStudio

- Plan: five beats (problem / plan / build / test-fail-fix / payoff); the flash-forward is a 2–3 s shot in beat 1 reused in the payoff; montage shots 0.8–1.5 s on the beat; the success shot `speed 0.2` ×4 angles.
- Cut: `update_segments speed 0.2` on the success sources; `add_text_overlay` labels and test cards; `add_segment audioOnly` riser / hits; `check_beat_alignment` on the montage.
- Music: `set_music` phase beds as audio-only clips per beat (or one bed and the montage cue as a clip); `balance_music` gap 7.
