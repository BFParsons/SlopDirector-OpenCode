# Final export and verification

**Goal.** A deliverable that passes technical checks before anyone watches it (ch.32).

1. Confirm the draft is approved and `check_cuts`, `check_soundtrack` and `check_mix_levels` are clean. Set the delivery settings with `update_project`: `exportCodec` (h264 for web, hevc for smaller files, prores for a master), `frameWidth/frameHeight` for the platform, `audioNormalize: true`, captions as required. `export_formats` tells you what this machine can encode.
2. `render_final` (wait). Note the returned path, duration and size.
3. `verify_export` with the platform target (`web`, `social`, `streaming`, `broadcast`) and the expected duration and frame. Fix errors, re-render, re-verify. Warnings are reported, not ignored.
4. Spot-check frames at head, tail and every transition with `get_frame` on the final asset; `get_contact_sheet` for the whole file.
5. Report: file path, duration to the frame, resolution, codec, loudness and true peak, checks passed, warnings noted. Never overwrite a delivered file: a new render is a new version (rename the project version in its title).
