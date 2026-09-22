---
description: Author the plan from the brief, check it, show the document, wait for approval, then fan out. Usage /preproduction <projectId>
---
Project $1: `get_brief`, then read `get_playbook preproduction` and write the plan, following `AGENTS.md` and `docs/HARNESS-LOOP.md`.

00) If the brief carries materials (production notes: their own script / shot list), those are the plan's spine — spoken lines verbatim, shots in their order; propose only what they left open and say so in notes.
0) If the brief names a directing style, `get_style` it FIRST. Read its reference, evidence, prerequisites, creative choices and the shared director-style playbook. Write `plan.styleTreatment`: reference, mechanism, materialPlan, rhythm, sound, typography, exceptions and evaluation. Carry the treatment into shots, script and sound. Creative defaults are review prompts; technical validity remains enforced. Do not invent missing performance or footage with cosmetic effects.
1) Beats first (3–6 for a short piece), contiguous, adding up to the brief's length.
2) The script: narration lines with `atS` (≤ 2 words/s over the piece, never over a sync-sound bite), the sound bites you expect to find, the text cards. Design the film's title separately from the supporting text system (`role: title` is the film's own name).
3) The storyboard: shots in order, each with duration, description, source, sound decision (sync | muted | vo), card text, transition — average shot length inside the genre norm.
4) The clip list for YouTube shots (id, what it must contain, 2–3 search queries, preferred channels, the wanted moment) and the AI shot list (prompt, model from `list_video_models`, length the model makes).
5) Music brief + queries; narration voice (leave the voice to the server unless the person asked for one).

`set_plan` → read the check → fix every error and the warnings you agree with → `plan_document` → paste its text into your reply VERBATIM inside a code block (it is laid out for a terminal: boxed tables, the AV script with VIDEO and AUDIO columns) and ask for a yes or changes, including any paid generation. Do NOT source, generate or cut before `approve_plan`, and call `approve_plan` only once the person has said yes to this specific plan.

After approval: `plan_tasks`, then run every task in `parallelNow` at once — delegate `source:<clipId>` tasks to the `clip-scout` subagent, `narration` to `narrator`, shot selection on imported assets to `shot-picker` (or use `source_clips`, `generate_ai_shots`, `generate_narration` directly when a subagent is more machinery than the job needs). Scouts may inspect and source concurrently, but timeline mutations stay with you, one writer at a time. Then assemble per the storyboard, titles, checks, `render_draft`, `storyboard_sheet` + draft to the person, `render_final`.
