---
description: The cut-and-verify loop on an existing project. Usage /edit-video <projectId> <what the finished video should be>
---
Project: $1 (call `get_project` first, then `get_brief` and `get_plan` — use the saved brief and plan rather than restarting the interview).
Goal: $ARGUMENTS

Follow `guide/RULES.md` at all times and `get_playbook` for the job before cutting (`interview-cleanup`, `scene-highlight`, `vertical-repurpose`, `music-montage`, `assembly-from-transcript`, `delivery-verify`, `director-style`, `film-dialogue`, `trailer-construction`, `typography-and-motion`).

Work like an editor:
1. Perceive the source before cutting: `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`.
2. `create_checkpoint` before changing the cut.
3. Express the cut as segments (same asset, `trimStartS` + `durationS` per kept range; `muted=false` to keep clip sound) — prefer `apply_edit_list` for multi-step changes.
4. `render_draft`, then LOOK at the draft (`get_frame` / `get_contact_sheet`) and LISTEN (`detect_silences` on the draft asset); run `check_cuts`, `pacing_report`, `check_soundtrack`, `check_text`, `verify_export`.
5. Fix, or `restore_checkpoint`.
6. Only when the draft is right, `render_final` and report the file path.

Report the cut you chose and why, every check's result, the change list, and what you could not do. Do not claim to have listened to audio or inspected frames unless you did.
