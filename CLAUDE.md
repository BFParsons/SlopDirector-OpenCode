# SlopStudio — notes for Claude Code

SlopStudio is an Electron + Next.js video editor with an ffmpeg engine and an MCP server
that lets an agent edit video in the running app. This file is the **Claude Code** brief.

The loop itself — interview, plan, approval, cut, verify — is canonical in
**[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md)**. Read that for the full detail. This
file covers what is specific to Claude Code, and repeats enough of the loop to work from.
`AGENTS.md` is the same loop for Codex and other MCP clients; when the loop changes,
change `docs/HARNESS-LOOP.md` first and reflect it in both.

## Connecting

**No setup step.** [`.mcp.json`](.mcp.json) already registers the server for Claude Code
inside this repository — it runs `node mcp/run.cjs` against `http://127.0.0.1:38473` and
labels the work `Claude` in the editor's Agent panel. Approve the server when Claude Code
offers it; `/mcp` shows the connection.

The **app must be running** before any tool works:

```
corepack pnpm desktop:prod      # Electron window (first launch builds the server)
corepack pnpm desktop:dev       # Electron window with HMR
corepack pnpm serve:headless    # no window — http://127.0.0.1:38473/start
```

On Windows these are native Node/PowerShell launchers — **do not** set a global Bash
`script-shell` for this repo. Setup details: [`docs/WINDOWS-CODEX.md`](docs/WINDOWS-CODEX.md)
(the Windows half applies to Claude Code too; only the `codex:setup` step is Codex's).

After changing MCP code, the registry or guide files, reconnect (`/mcp`) before trusting
the output — a running stdio process retains old modules and guide text. Stale `get_style`
output is not the current harness.

## Asking the person questions

Use **`AskUserQuestion`** for the interview — it is the reason the one-question-at-a-time
flow feels right in Claude Code:

- 2–4 short options per question, the **recommended one first**.
- Prefer the options the tool supplied; map labels back to the **option values**, never
  store a label where an enum value belongs.
- **Do not add an "Other" option** — Claude Code already provides free text.
- Use `multiSelect: true` where the question collects an array.
- Free text suits the subject, an original script or shot list, scene context, or a custom
  preference. Preserve supplied scripts and shot lists **verbatim**.

A preselected default, a pending question or silence is **never** an answer, and interview
answers never stand in for plan approval.

## MCP prompts (slash commands)

Claude Code exposes the server's prompts, so the loop has entry points you can invoke
directly rather than driving by hand:

| prompt | what it does |
|---|---|
| `interview` | runs pre-production: cached queue, one question at a time, then `set_brief` |
| `preproduction` | authors the plan from the brief, checks it, shows the document, waits for the yes |
| `edit_video` | the cut-and-verify loop on an existing project |
| `playbook` | loads a named playbook |

They are optional — `interview_batch` and the other tools work directly — but prefer them
when starting a new piece; they carry the current guidance without you restating it.

## A new composition

Nothing is sourced or cut before approval. Full detail in
[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md#a-new-composition).

1. `list_projects` to confirm the connection.
2. **Interview.** Put everything the request already answers into `answers`. Call
   `interview_batch` **once**, cache the queue, then ask one question at a time with
   `AskUserQuestion`. Between replies just record the value and ask the next one — no MCP
   calls, research, style lookups, recaps or plan drafting in between.
   - Ask **clip type early**, then **director style** immediately after, selecting the
     cached `optionsByGenre[answers.genre]` menu **locally** — three named styles plus
     House style, with a custom reference via free text. No tool call needed for that menu.
   - Separate music **role** (`music`) from **selection** (`musicSelection`), storing names,
     links and cue preferences verbatim in `musicReference`. Research music **after** the
     interview.
   - Refresh the queue only when exhausted or when a changed answer invalidates dependents.
3. **Brief** — `set_brief`, then `get_playbook preproduction` and `get_style`.
4. **Plan** — beats, script, shots, source list, sound plan; carry a researched director's
   craft record into `plan.styleTreatment`. Design the film's **title** separately from the
   supporting text system (`role: title` is the film's own name).
5. **Approval** — `set_plan` → `check_plan` → `plan_document` → show it in full, including
   any paid generation → `approve_plan` only once they have said yes. Film-plan approval
   does not cover routine repository changes.
6. **Fan out** — see below.
7. **Cut and verify**, show the draft, then render the final.

For a targeted edit to an existing project, use its saved brief and plan rather than
restarting the interview. **`create_checkpoint` before changing the cut.**

## Subagents — the fan-out after approval

This is the part Claude Code has that other hosts do not. `plan_tasks` describes the
dependencies; the definitions in [`.claude/agents/`](.claude/agents/) are the fan-out:

| subagent | job |
|---|---|
| `clip-scout` | find and source the clips on the clip list |
| `narrator` | write and synthesize the narration |
| `shot-picker` | choose the takes and moments from sourced material |

Launch the independent ones **in parallel in a single message**. They may inspect and
source concurrently, but **timeline mutations must stay coordinated** — one writer at a
time. The plain tools (`source_clips`, `generate_ai_shots`, `generate_narration`) remain
available when a subagent is more machinery than the job needs.

**The narrator's voice is the server's decision, not the agent's.** Call
`generate_narration` without `voice` or `ttsModel`; the app resolves the house narrator
(`src/lib/tts/synthesize.ts`): the ElevenLabs "British Guy Documentary" voice on eleven_v3
wherever `ELEVENLABS_API_KEY` is configured, otherwise Grok Voice through OpenRouter. Pass a
voice only when the person asks for a different one. Details in
[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md#the-narrators-voice).

## The editing loop

1. Follow [`guide/RULES.md`](guide/RULES.md) at all times.
2. `get_playbook` for the job **before** cutting — `interview-cleanup`, `scene-highlight`,
   `vertical-repurpose`, `music-montage`, `assembly-from-transcript`, `delivery-verify`,
   `director-style`, `film-dialogue`, `trailer-construction`, `typography-and-motion`.
3. Perceive first: `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`.
4. `create_checkpoint` → `apply_edit_list` → `render_draft` → `check_cuts`, `pacing_report`,
   `check_soundtrack`, `check_text`, `verify_export`, `get_frame` → **only then**
   `render_final`.
5. Report the cut and why, every check's result, the change list, and what you could not do.

Reusing film clips needs clean dialogue selection or source separation — embedded music
fails `check_soundtrack`. For still images use the motion presets or transform keyframes,
keep movement restrained, and check a rendered excerpt; a contact sheet cannot verify
smoothness. **Do not claim to have listened to audio or inspected frames unless you did.**

Watch the work land in the editor: **Panel → Viewer → Agent**, and the invisible-editor
follow mode moves the playhead as clips arrive.

## Working on the code

Setup: [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md). Routes:
[`docs/AGENT-API.md`](docs/AGENT-API.md). History: [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

```
corepack pnpm exec tsc --noEmit -p tsconfig.json   # type-check
corepack pnpm exec eslint <paths>                  # lint (targeted)
corepack pnpm test:platform                        # all tests/platform/*.test.ts
corepack pnpm test:mcp                             # MCP acceptance (needs the app running)
corepack pnpm test:eval                            # scored editing tasks (needs the app)
corepack pnpm test:e2e                             # Playwright
```

Tests import the Prisma client. The desktop launchers generate it, so in a fresh
checkout that has not been launched yet, run `corepack pnpm db:sqlite:generate` first.

**Never push to the upstream `slopstudio-pro` repository.** This repository's remote is
`BFParsons/SlopDirector`.
