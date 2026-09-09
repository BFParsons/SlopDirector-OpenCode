# Pre-production: interview, brief, plan, fan-out

Nothing is sourced, generated or cut for a new piece until the person has said
yes to a plan. This playbook turns "make me a 30 s ad about X" into a brief, a
plan they can read (storyboard + script + shot list + clip list), and a set of
tasks that run in parallel.

## 1. The interview (one round)

Read the request twice. Fill in every answer you can infer, then ask **one
message** with only the open questions — at most eight — each with your
proposed default in brackets, so "yes" or a word answers it. Never ask what the
request already said.

| # | question | why it changes the work |
|---|---|---|
| a | **Standalone piece, or one scene of a longer video?** If a scene: what comes before and after, where in the story is it, does it carry the video's look? Length and aspect (16:9 / 9:16 / 1:1). | A scene has no title, no sign-off card, no closing fade, no "paid for by"; it must hand off to the next scene. A standalone piece owns its opening and ending. |
| b | **Scripted or unscripted, and the genre / form** (documentary, commercial, attack ad, explainer, trailer, montage, interview, sketch, news package, social…). | Sets the pacing norm (ch.16), the sound design (§7), whether a script exists before the footage or is found in it (ch.34). |
| c | **Where does the footage come from?** YouTube (any licence rule? archives only? CC only?), AI generation (which model tier / budget), their own files (paths or asset ids), stock. | Decides whether you write a clip list, an AI shot list with prompts, or ingest. Public figures block some AI models (list_video_models). |
| d | **The premise** — one or two sentences: what it says, what it is for. | The logline and the beats come from this. |
| e | **Tone** (three adjectives) and **audience**. | Music, narration voice, cutting rhythm, how far a joke goes. |
| f | **Narration** (yes/no; voice, style), **music** (yes/no; kind), **on-screen text** (yes/no); anything that **must** be in; anything to **avoid**. | Layers of the soundtrack (RULES 25–31), the cards, the guardrails. |

Then `set_brief`. If the person answered nothing, proceed with your defaults
and say so in the plan.

## 2. The plan

Write it in this order; each step constrains the next.

1. **Logline** — one sentence.
2. **Beats** — 3–6 for anything under a minute; contiguous, from 0 to the brief's
   length; each with a purpose ("hook", "the case", "the turn", "the sting").
3. **Script** — every line the audience hears or reads, with `atS`:
   `narration` (≤ 2 words/s averaged over the piece, never over a sync-sound
   bite — RULES 25/26), `bite` (the quote you expect to find, in the source's
   words), `text` (cards), `dialogue`.
4. **Storyboard** — the shots in order: duration, what is on screen, the source
   (`youtube` + `clipId`, `ai` + prompt, `upload`, `card`), the sound decision
   (`sync` = the shot's own sound is the content; `muted` = B-roll under the
   bed / narration; `vo` = narration runs over it), card text, transition (cut
   unless you can name the reason — ch.20). Average shot length inside the
   genre norm; nothing under 10 frames; vary the lengths.
5. **Clip list** — one entry per YouTube source: `need` (what the clip must
   contain), 2–3 `queries` as a person would type them, `preferredChannels`
   (archives, libraries, official channels), `mustHave` words for the title,
   the `wantedSection` in words ("the sentence 'I am not a crook'"), a
   `durationHintS`. Plan for **≤ 180 s per imported section**.
6. **AI shot list** — one entry per AI shot: prompt (subject, action, camera,
   light, style; no text in frame; no public figures on models that block
   them), `model` from `list_video_models`, a length that model makes.
7. **Music** — a brief and 2–3 search queries (Creative Commons libraries:
   Audionautix, Kevin MacLeod, Free Music Archive uploads). **Narration** —
   voice and style, the lines by script id.
8. **Risks** — what may not exist on YouTube, what the AI model may refuse,
   where the timing is tight.

`set_plan` → read the check → fix every **error**, weigh every **warn** →
`plan_document` → paste its text into your reply **verbatim** (it is laid out
for a terminal: the script and the storyboard as one time-ordered list; never
summarize it, never turn it into a table) with one paragraph on the choices you
made and what you could not honour (RULES 7). Wait. Revise on
their notes (each `set_plan` is a new version). Only after their yes:
`approve_plan`.

## 3. Fan-out (parallel work)

`plan_tasks` returns the graph. Everything in `parallelNow` is independent —
run it at once:

| task | fast path (one tool) | precise path (a sub-agent per task) |
|---|---|---|
| `source:<clipId>` | `source_clips` (search → rank → import the planned section or the first 180 s) | **clip-scout**: `search_youtube` → pick by title/channel/duration → `import_youtube` a ≤ 180 s window → `get_contact_sheet` + `transcribe` → report the exact in/out of the wanted moment |
| `ai:<shotId>` | `generate_ai_shots` (all at once) | `add_ai_shot` one by one when prompts need iteration |
| `narration` | `generate_narration` per line (they can run concurrently) | **narrator** sub-agent: generates every line, checks each duration against its slot, re-writes a line that runs long |
| `music` | `search_youtube` → `import_youtube kind=audio` → `set_music` → `balance_music` | — |

Sub-agents get: the project id, their task spec from `plan_tasks`, and the
rule "report ids and timings, do not cut the sequence". The lead agent keeps
the timeline: it waits for every task, then **assembles** per the storyboard
(`apply_edit_list`: shots in order with trims from the scouts' reports, sound
decisions, narration offsets, `volume` per voice), adds **titles**, runs the
**checks** (`check_soundtrack`, `check_cuts`, `pacing_report`,
`balance_music`), renders the **draft**, reads it back (`verify_export`,
`check_mix_levels`, `storyboard_sheet`, `get_contact_sheet` on the draft),
sends the person the shot list in text plus the draft's and the storyboard sheet's file paths (a terminal shows no images), and only then the
**final**.

Rules of the fan-out: one checkpoint before assembly; sub-agents never
reorder or delete; a task that cannot be done as specified is reported, not
improvised around (RULES 3).
