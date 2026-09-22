---
description: Pre-production interview — one question at a time from a cached queue, then set_brief. Usage /interview <what the person wants, verbatim>
---
The person asked: "$ARGUMENTS"

Run the SlopStudio pre-production interview ONE QUESTION AT A TIME FROM A CACHED QUEUE, following `AGENTS.md` and `docs/HARNESS-LOOP.md`:

1. `list_projects` to confirm the connection. Put everything the request already answers into `answers` (e.g. kind, durationS) — never ask it again.
2. Call `interview_batch {request, answers}` **once**. Cache the returned questions and offer them one at a time with the `question` tool: 2–4 short options, the recommended one first, no "Other" option (OpenCode already lets the person type a custom answer). Map labels back to option values.
3. Ask clip type early, then directing style immediately after, selecting the cached `optionsByGenre[answers.genre]` menu locally — three named styles plus House style, with a custom reference via free text. No tool call is needed for that menu. Separate music role (`music`) from selection (`musicSelection`); store names, links and cue preferences verbatim in `musicReference`. Record supplied scripts or shot lists verbatim. Save `get_style` and other research for after the interview.
4. After each reply, record the value and immediately ask the next unanswered cached question — no MCP calls, research, recaps or plan drafting in between. Call `interview_batch` again only when the queue is exhausted or a changed answer invalidates dependent questions. When collection is complete, review all answers together and resolve material contradictions.
5. When `interview_batch` returns `done`, create the project if needed (`create_project` with the aspect/resolution from the brief), then `set_brief`. Continue with `/preproduction <projectId>`: propose the plan, check it, show it in full, wait for the yes.

A preselected default, a pending question or silence is never an answer, and interview answers never stand in for plan approval.
