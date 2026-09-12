# Final export and verification

**Goal.** A deliverable with technical verification and a separately reported
picture and listening review (ch.32). Technical success does not certify
musical fit, comic timing or mix quality.

For a directing reference, follow [Applying a director reference](director-style.md).
Review the selected passage against plan.styleTreatment.evaluation and the profile's
failure mode. Report the observed result and exceptions, or mark style evaluation
unverified. A technical pass is not proof that the style works.

For trailers, follow [Trailer construction](trailer-construction.md). Record
three statuses in the delivery report: technical checks, picture/motion review,
and listening review. Use "unverified" when a review was unavailable. Report
intentional timing/card/level warnings with their reasons; do not remove a
creative choice solely to improve an aggregate beat or loudness score.

1. Confirm the draft is approved and `check_cuts`, `check_soundtrack` and `check_mix_levels` are clean. Set the delivery settings with `update_project`: `exportCodec` (h264 for web, hevc for smaller files, prores for a master), `frameWidth/frameHeight` for the platform, `audioNormalize: true`, captions as required. `export_formats` tells you what this machine can encode.
2. `render_final` (wait). Note the returned path, duration and size.
3. `verify_export` with the platform target (`web`, `social`, `streaming`, `broadcast`) and the expected duration and frame. Fix errors, re-render, re-verify. Warnings are reported, not ignored.
4. Spot-check frames at head, tail and every transition with `get_frame` on the final asset; `get_contact_sheet` for the whole file. For narration in every style, review each monologue's closing passage and the film's final sentence with the preceding line and following pause/music: the vocal delivery must land with the intended finality or deliberate ambiguity, with no clipped last word or natural tail. If it sounds like another sentence is about to follow unintentionally, direct a targeted retake within the approved allowance and recheck the affected ending. A fade, transcript match or loudness pass cannot verify closing cadence; report when listening was unavailable.
5. Report: file path, duration to the frame, resolution, codec, loudness and true peak, checks passed, warnings noted. Never overwrite a delivered file: a new render is a new version (rename the project version in its title).


For dialogue extracted from scored footage, follow [Clean dialogue from film clips](film-dialogue.md). Audit embedded source music before arranging the new score; separation requires listening review.
