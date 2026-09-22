# SlopStudio — notes for OpenCode, Codex and other MCP clients

SlopStudio is an Electron + Next.js video editor with an ffmpeg engine and an MCP server
that lets an agent edit video in the running app. This file is the brief for **OpenCode**
(the primary host of this fork), **Codex, and any other MCP client**.

The loop itself — interview, plan, approval, cut, verify — is canonical in
**[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md)**. Read that for the full detail
(OpenCode loads it automatically through `opencode.json`). This file covers what is
specific to this class of host, and repeats enough of the loop to work from. `CLAUDE.md`
is the same loop for Claude Code; when the loop changes, change `docs/HARNESS-LOOP.md`
first and reflect it in both.

## Connecting

**OpenCode: no setup step.** [`opencode.json`](opencode.json) registers the server for any
OpenCode session opened in this repository — it runs `node mcp/run.cjs` against
`http://127.0.0.1:38473` and labels the work `OpenCode` in the editor's Agent panel. The
slash commands in [`.opencode/commands/`](.opencode/commands/) and the subagents in
[`.opencode/agents/`](.opencode/agents/) load with it. Mac setup, end to end:
[`docs/MAC-OPENCODE.md`](docs/MAC-OPENCODE.md).

**Codex:** run `corepack pnpm codex:setup` once, then open and **trust** this repository.
Setup writes an ignored `.codex/config.toml` with the absolute Node and `mcp/run.cjs`
paths, the server URL, a 600-second tool timeout and the agent label `Codex`. Run it again
after moving the checkout. Windows details: [`docs/WINDOWS-CODEX.md`](docs/WINDOWS-CODEX.md).

**Any other client:** the stdio entry is `node <absolute-repo-path>/mcp/run.cjs` with
`SLOPSTUDIO_URL` and `SLOPSTUDIO_AGENT_NAME` in its environment — see
[`mcp/README.md`](mcp/README.md). **Do not** launch a `.cmd` or a Unix
`node_modules/.bin/tsx` shim from an MCP configuration.

The **app must be running** before any tool works:

```
corepack pnpm desktop:prod      # Electron window (first launch builds the server)
corepack pnpm desktop:dev       # Electron window with HMR
corepack pnpm serve:headless    # no window — http://127.0.0.1:38473/start
```

On Windows these are native Node/PowerShell launchers; do not set a global Bash
`script-shell`.

After changing MCP code, the registry or guide files, verify through a **fresh MCP
connection** — a running stdio process retains old modules and guide text. If the host
connection is stale, use `scripts/mcp-call.ts` (which launches a fresh `mcp/run.cjs`) until
the host reconnects. Stale `get_style` output is not the current harness. Rebuild or reopen
the desktop app when its bundled API code changes.

## Asking the person questions

In **OpenCode** use the built-in **`question`** tool for the interview — it is the reason
the one-question-at-a-time flow feels right. In **Codex** use `request_user_input_async`
where the host offers it, `request_user_input` only in a mode that permits it. Otherwise
ask one question in chat.

- 2–4 short choices within the host's actual option limit, the **recommended one first**,
  preferably the options the tool supplied.
- Map labels to **option values** — never store a label where an enum value belongs.
- **Do not add "Other"** — OpenCode and Codex already let the person type a custom answer.
- For `multiSelect`, collect an array; use comma-separated free text if the UI cannot
  select several choices.
- Free text suits the subject, an original script or shot list, scene context, or a custom
  preference. Preserve supplied scripts and shot lists **verbatim**.

A pending question, a preselected default, a timeout or silence is **never** an answer, and
interview answers never stand in for plan approval.

## Slash commands (OpenCode)

OpenCode does not surface the server's MCP prompts, so the same entry points are project
commands in [`.opencode/commands/`](.opencode/commands/):

| command | what it does |
|---|---|
| `/interview <request>` | runs pre-production: cached queue, one question at a time, then `set_brief` |
| `/preproduction <projectId>` | authors the plan from the brief, checks it, shows the document, waits for the yes |
| `/edit-video <projectId> <goal>` | the cut-and-verify loop on an existing project |
| `/playbook <name>` | loads a named playbook |

They are optional — `interview_batch` and the other tools work directly — but prefer them
when starting a new piece; they carry the current guidance without you restating it. In
Codex and other hosts the MCP prompts are likewise optional: call the tools directly.

## A new composition

Nothing is sourced or cut before approval. Full detail in
[`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md#a-new-composition).

1. `list_projects` to confirm the connection. Ask which project only if the request does
   not make it clear.
2. **Interview.** Keep the original request and an `answers` map keyed by question id; fill
   in information already supplied. Fetch `interview_batch` **once** and cache the queue —
   "batch" is tool retrieval, not presentation. Present exactly one short question at a
   time. Between replies only record the value, skip answered fields, and ask the next
   queued question: no per-answer MCP calls, research, file reads, style lookups, recaps or
   plan drafting.
   - Ask **clip type early**, then **director style** immediately after. Select the cached
     style question's `optionsByGenre[answers.genre]` **locally** (closest cached genre for
     a custom type) — three named styles with short descriptions plus House style where the
     UI permits four choices, and a custom reference via free text. No tool call or research
     is needed for that menu. Skip the question entirely if a style was already supplied.
   - Separate music **role** (`music`: bed / score / none) from **selection**
     (`musicSelection`: choose / soundtrack / tracks). Collect soundtrack names, artists,
     tracks, links, paths and cue preferences in `musicReference` only when missing.
     `music: none` skips the follow-ups; explicit delegation fills `musicSelection=choose`
     without another question. Carry them through `brief.music.brief` into the music plan
     and research **after** the interview.
   - Refresh the queue only when exhausted or when an earlier answer invalidates dependent
     choices; ask newly applicable questions one at a time too. `interview_next` is the
     fallback for clients that cannot cache a queue. Show all questions only on request.
   - Review all answers together after collection and resolve material contradictions. An
     explicit "you decide" delegates the choice — state that assumption in the plan.
3. **Brief** — when `interview_batch` returns `done`, create the project at the requested
   frame if needed, then `set_brief`. Read `get_playbook preproduction` and `get_style`.
4. **Plan** — beats, script, shots, source list, sound plan. For a researched director
   reference, carry its craft record into `plan.styleTreatment` (`reference`, `mechanism`,
   `materialPlan`, `rhythm`, `sound`, `typography`, `exceptions`, `evaluation`). Creative
   defaults guide review; source integrity and the technical checks remain requirements.
   Design the film's **title** separately from the supporting text system (`role: title` is
   the film's own name; statements, chapters and CTAs keep supporting roles even when
   large). Do not add a film title to a scene by default.
5. **Approval** — `set_plan` → `check_plan` → fix errors → `plan_document`. Show the
   complete document, including any paid generation, and obtain approval for **that
   specific plan**. Call `approve_plan` only then; an approval already given in this
   conversation counts. Film-plan approval does not cover routine repository changes.
6. **Fan out** — see below.
7. **Cut and verify**, show the draft for feedback, then render the final.

For a targeted edit to an existing project, use its saved brief and plan rather than
restarting the interview. **`create_checkpoint` before changing the cut.** Follow activity
tagged with your agent name in the editor's Agent panel (**Panel → Viewer → Agent**).

## Subagents — the fan-out after approval

`plan_tasks` describes the dependencies. In **OpenCode** the definitions in
[`.opencode/agents/`](.opencode/agents/) are the fan-out (they mirror Claude Code's
`.claude/agents/`, restricted to the `slopstudio_*` tools each job needs):

| subagent | job |
|---|---|
| `clip-scout` | find and source the clips on the clip list |
| `narrator` | write and synthesize the narration |
| `shot-picker` | choose the takes and moments from sourced material |

Delegate the independent tasks in `parallelNow` through the `task` tool in one turn. They
may inspect and source concurrently, but **timeline mutations must stay coordinated** —
one writer at a time, and that writer is you. The plain tools (`source_clips`,
`generate_ai_shots`, `generate_narration`) remain available when a subagent is more
machinery than the job needs.

**Codex and other hosts can do these tasks themselves**; the subagent definitions are not
a dependency of this harness. Use subagents only where the host and the task instructions
allow.

**The narrator's voice is the server's decision, not the agent's.** Call
`generate_narration` **without `voice` or `ttsModel`**; the app resolves the house narrator
(`src/lib/tts/synthesize.ts`): ElevenLabs on eleven_v3 wherever `ELEVENLABS_API_KEY` is
configured, otherwise Grok Voice through OpenRouter. Name a voice only when the person
asks for another — see [`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md#the-narrators-voice).

## The editing loop

1. Follow [`guide/RULES.md`](guide/RULES.md) at all times (also embedded in the server's
   instructions).
2. `get_playbook` for the job **before** cutting — `interview-cleanup`, `scene-highlight`,
   `vertical-repurpose`, `music-montage`, `assembly-from-transcript`, `delivery-verify`,
   `director-style`, `film-dialogue`, `trailer-construction`, `typography-and-motion`.
3. Perceive first: `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`.
4. `create_checkpoint` → `apply_edit_list` → `render_draft` → `check_cuts`, `pacing_report`,
   `check_soundtrack`, `check_text`, `verify_export`, `get_frame` → **only then**
   `render_final`.
5. Report the cut and why, every check's result, the change list, and what you could not do.

Reusing film clips needs clean dialogue selection or source separation — embedded music
fails `check_soundtrack`. For still images use the motion presets or transform keyframes;
the renderer interpolates between pixels to avoid stepped pans and zooms. Keep movement
restrained, retain source resolution, and check a rendered moving excerpt at the delivery
frame rate — a contact sheet cannot verify smoothness, and a static hold is better when
motion adds little. Report the actual render path and the real results: **do not claim to
have listened to audio or inspected frames unless you did.**

## Working on the code

Setup: [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) and, on a Mac,
[`docs/MAC-OPENCODE.md`](docs/MAC-OPENCODE.md). Routes:
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

Secrets live only in the ignored `.env` (template: [`.env.example`](.env.example)). Never
commit a key, a cookie jar or a `.env`.

**Never push to the upstream `slopstudio-pro` or `SlopDirector` repositories.** This
repository's remote is `BFParsons/SlopDirector-OpenCode`; `SlopDirector` is wired as
`upstream` for pulling only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
