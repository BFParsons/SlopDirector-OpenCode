# Pre-production: interview, brief, plan, fan-out

Nothing is sourced, generated or cut for a new piece until the person has said
yes to a plan. This playbook turns "make me a 30 s ad about X" into a brief, a
plan they can read (storyboard + script + shot list + clip list), and a set of
tasks that run in parallel.

## 1. The interview (one quick question at a time)

Populate `answers` with information already supplied. Call `interview_batch
{request, answers}` once and cache the returned queue. Present one short question
at a time through the host UI or chat, using 2–4 supplied choices within the host's
option limit. Ask clip type early, immediately followed by director style. Select
the cached style question's `optionsByGenre[answers.genre]` menu locally; for a
custom type use the closest cached genre menu, otherwise its `options`. Offer
three named styles with brief descriptions plus House style where the UI allows,
and accept another director/film via free text. Skip an already supplied style.
No extra tool call or research is needed between clip type and style.
Free text is appropriate for the subject,
original material, scene context and custom preferences; do not invent elaborate
menus or research choices while the person waits.

Between replies, only map the answer to its value, skip any fields the person
already answered, and ask the next queued question. No tool call after every
answer, no file reads, style lookups, recaps, planning or creative analysis.
Preserve scripts/shot lists verbatim and retain unsolicited creative direction.
If an earlier answer changes, invalidate dependent cached choices and refresh as
needed. Otherwise submit accumulated answers to `interview_batch` when the queue
is exhausted. Newly applicable questions (scene context, material text, footage
licence, music selection/reference) can then be asked one at a time from the refreshed queue.

When the optional interview is used, separate music's **role** from its
**selection**. `music` records bed / score / none. For wanted music,
`musicSelection` offers **Choose for me**, **Use a film soundtrack**, or
**I'll name tracks**. A soundtrack or track selection gets one free-text
`musicReference` follow-up for the film/series, artists, songs, links, local
paths and cue preferences. For example: "The Power of Nightmares; Morricone
for the absurdity, The Big Ship at the verdict." Preserve that wording in
`brief.music.brief`; choosing a soundtrack does not replace the directing style.
Skip these questions when the user already supplied the music or delegated
selection; no music skips both. If a selection changes, clear its dependent
reference unless explicitly retained. Do not research tracks between questions.

Once collection is complete, review all answers together, resolve material
contradictions, and develop the composition. The person can explicitly delegate
choices with "you decide"; state those assumptions in the plan. Silence or a
preselected default is not an answer. `interview_next` remains a fallback for
clients that cannot cache questions. Show the full questionnaire only on request.
The table below describes the fields and their purpose.

| # | question | why it changes the work |
|---|---|---|
| a | **Standalone piece, or one scene of a longer video?** If a scene: what comes before and after, where in the story is it, does it carry the video's look? Length and aspect (16:9 / 9:16 / 1:1). | A scene has no title, no sign-off card, no closing fade, no "paid for by"; it must hand off to the next scene. A standalone piece owns its opening and ending. |
| b | **Scripted or unscripted, and the genre / form** (documentary, commercial, attack ad, explainer, trailer, montage, interview, sketch, news package, social…). | Sets the pacing norm (ch.16), the sound design (§7), whether a script exists before the footage or is found in it (ch.34). |
| a2 | **Do you already have a script or a shot list?** — asked early; if yes, invite the text in the same reply (recorded verbatim under `materials`). | Their lines are the script (verbatim, RULES 4) and their shots the storyboard; the plan proposes only what they left open. `check_plan` warns when the plan departs from a supplied script. |
| b2 | **Whose eye?** — a directing style fashioned after a real filmmaker (`interview_batch` offers the styles that fit the genre; `list_styles` / `get_style`; House style = none). | Creative defaults for the cut, narration, sound and text are reviewed by `check_plan`, `pacing_report` and `check_soundtrack`; the plan is written from the style file. |
| c | **Where does the footage come from?** YouTube (any licence rule? archives only? CC only?), AI generation (which model tier / budget), their own files (paths or asset ids), stock. | Decides whether you write a clip list, an AI shot list with prompts, or ingest. Public figures block some AI models (list_video_models). |
| d | **The premise** — one or two sentences: what it says, what it is for. | The logline and the beats come from this. |
| e | **Tone** (three adjectives) and **audience**. | Music, narration voice, cutting rhythm, how far a joke goes. |
| f | **Narration** (yes/no; voice, style), **music** (yes/no; kind), **on-screen text** (yes/no); anything that **must** be in; anything to **avoid**. | Layers of the soundtrack (RULES 25–31), the cards, the guardrails. |

Then `set_brief`. Fill only explicitly delegated choices with suitable defaults
and state them in the plan. A pending reply or silence is not delegation, and
interview answers do not approve the production plan.

## 2. The plan

For trailers, teasers and trailer-style spots, read
[Trailer construction](trailer-construction.md) before applying a named style.
Its flexible creative constraints take precedence over rigid style recipes.
An approved plan may include bounded selects/music exploration and a short proof;
revise detailed timing as the actual material becomes known.

Write it in this order; each step constrains the next.

00. **Their material** — if the brief carries `materials`, copy the script into `script` lines (narration / bites, verbatim) and the shot list into `shots` in their order before anything else; `notes` names what you added.
0. **The style** — get_style before writing the shots. Follow the included [Applying a director reference](director-style.md) playbook and store reference, mechanism, materialPlan, rhythm, sound, typography, exceptions and evaluation in plan.styleTreatment. Name the work/version and collaborators; distinguish source evidence from creative translation. Address missing coverage explicitly. Numeric ranges are starting defaults; check_plan treats creative departures as review warnings.
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
   unless you can name the reason — ch.20). Review section-level rhythm against the
   selected reference. Six-to-nine-frame accents need a clear purpose; sub-six-frame
   shots fail the 30 fps plan check. Keep readable information long enough to read.
5. **Clip list** — one entry per YouTube source: `need` (what the clip must
   contain), 2–3 `queries` as a person would type them, `preferredChannels`
   (archives, libraries, official channels), `mustHave` words for the title,
   the `wantedSection` in words ("the sentence 'I am not a crook'"), a
   `durationHintS`. Plan for **≤ 180 s per imported section**.
6. **AI shot list** — one entry per AI shot: prompt (subject, action, camera,
   light, style; no text in frame; no public figures on models that block
   them), `model` from `list_video_models`, a length that model makes.
7. **Music** — carry the user's selection and references from `brief.music.brief`
   into `plan.music.brief`, search queries and the cue sheet. A named soundtrack
   means select music actually featured in that film/series; verify the association
   and identify the recording/version, rather than substituting vaguely similar
   music. Supplied tracks and cue preferences take precedence over style defaults;
   delegated selection uses the story and directing style. Then consult the
   associated music references included in `get_style`
   (full library: `guide/music-references.md`). Shortlist by the scene's intended
   emotion, preserving the distinction between a film credit, trailer cue and
   catalogue listening lead. Name the artist, recording/version, intended passage,
   entry/exit and reason for each selection in plan `notes`; audition the passage
   during sourcing before locking its timing. Follow the project's sourcing brief;
   where CC music is requested, use suitable libraries such as Audionautix,
   Kevin MacLeod or Free Music Archive. Include a music brief and 2–3 search queries.
   References do not require an added bed in styles that favour silence or sync.
   **Narration** —
   voice and style, the lines by script id.
8. **Risks** — what may not exist on YouTube, what the AI model may refuse,
   where the timing is tight.

For **every directing style**, identify the closing script id(s) of each monologue
and of the film. Include a compact, line-specific direction in `narration.style`
so it reaches the narration task (for example, "n13 closes the film: reflective,
slightly unhurried final phrase; let the final word settle"). Put fuller context
in `notes`: the preceding thought, intended emotional landing and space afterward.
A rhetorical question or unresolved ending still needs a deliberate final
delivery. A scene handing off to another scene, or the end of a generation chunk,
does not automatically call for a film-ending cadence. Reserve enough time for
the performed ending and its natural tail; do not use an audio fade as a substitute
for the narrator's performance. These are planning decisions, not extra interview
questions when the user has delegated creative choices.

Include two distinct typography decisions in `notes`: **film title** (exact words,
font, palette, size, placement, background, reveal and hold, or why omitted) and
**supporting text** (captions, cards, names, sources and CTAs). Put their words and
timing in the script/storyboard too. Follow `typography-and-motion`: a film title
can use its own display face and a dedicated composition; the supporting system
stays consistent. No additional interview round is needed for delegated design.

For **Adam Curtis**, also include **Pause map** and **Music turns** in plan `notes`
(see `guide/styles/adam-curtis.md`). Reserve narration-free time after the most
important statements before filling the runtime with speech. Name the archival
shot and visible action that will hold attention in each gap, plus its sound.
For every song change, identify the narrative trigger, intended before/after
emotion and handoff method. Carry these decisions into script offsets, shot
durations and the music brief; confirm source passages after inspection. A plan
check passing its numeric limits does not establish that these moments work.
When the user delegates creative choices, make these decisions during planning
without adding interview questions.

`set_plan` → read the check → fix every **error**, weigh every **warn** →
`plan_document` → paste its text into your reply **verbatim**, in a code block
(it is laid out for a terminal: boxed tables — beats, the AV script with VIDEO
and AUDIO columns, clips to find, AI shots; never summarize it) with one paragraph on the choices you
made and what you could not honour (RULES 7). Wait. Revise on
their notes (each `set_plan` is a new version). Only after their yes:
`approve_plan`.

## 3. Fan-out (parallel work)

`plan_tasks` returns the graph. Everything in `parallelNow` is independent —
run it at once:

| task | fast path (one tool) | precise path (a sub-agent per task) |
|---|---|---|
| `source:<clipId>` | `source_clips` (search → rank → import the planned section or the first 180 s) | **clip-scout**: `search_youtube` → pick by title/channel/duration → `youtube_captions` with a phrase to find the second it is spoken (no download) → `import_youtube` a ≈ 30 s window around it → `get_contact_sheet` + `transcribe` → report the exact in/out of the wanted moment |
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


For dialogue extracted from scored footage, follow [Clean dialogue from film clips](film-dialogue.md). Audit embedded source music before arranging the new score; separation requires listening review.
