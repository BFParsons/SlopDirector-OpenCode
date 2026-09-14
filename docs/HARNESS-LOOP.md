# The harness loop (host-neutral)

This is the **single source of truth** for how an agent drives SlopStudio through the
MCP server. It is written for no particular host.

- **Claude Code** reads [`CLAUDE.md`](../CLAUDE.md).
- **Codex and other MCP clients** read [`AGENTS.md`](../AGENTS.md).

Those two files carry the same loop in their own host's idiom — how to ask a question,
how to register the server, whether subagents exist. **When the loop itself changes,
change it here first**, then reflect it in both host files. Anything host-specific
belongs in the host file, not here.

## Running the editor

The app must be running before any tool works. All three bind `127.0.0.1:38473`
(the MCP default):

| command | what |
|---|---|
| `corepack pnpm desktop:prod` | Electron window; builds the standalone server on first launch and after source changes |
| `corepack pnpm desktop:dev` | Electron window with HMR |
| `corepack pnpm serve:headless` | no window; open `http://127.0.0.1:38473/start` |

The stdio entry is `node <absolute-repo-path>/mcp/run.cjs`. Never launch a `.cmd` or a
Unix `node_modules/.bin/tsx` shim from an MCP configuration.

After changing MCP code, the tool registry or guide files, **verify through a fresh MCP
connection** — a running stdio process can retain old modules and guide text. If the
host's connection is stale, use `scripts/mcp-call.ts` (which launches a fresh
`mcp/run.cjs`) until the host reconnects. Do not treat stale `get_style` output as the
current harness. Rebuild or reopen the desktop app when its bundled API code changes.

## Where the pieces live

| piece | where |
|---|---|
| MCP server — 68 tools, 4 prompts (`edit_video`, `interview`, `preproduction`, `playbook`) | [`mcp/`](../mcp/README.md) |
| Always-on rules (38 of them) | [`guide/RULES.md`](../guide/RULES.md) |
| Craft guide (`search_guide`, `read_guide`) | [`guide/editing-guide.md`](../guide/editing-guide.md) |
| Playbooks (`get_playbook`) | [`guide/playbooks/`](../guide/playbooks/) |
| Directing styles — 40 researched profiles (`get_style`, `list_styles`) | [`guide/styles/`](../guide/styles/README.md), `src/lib/styles/research.json` |
| Music references | [`guide/music-references.md`](../guide/music-references.md) |
| Tool reference (generated) | [`guide/appendix-a-tools.md`](../guide/appendix-a-tools.md) |

## A new composition

Nothing is sourced or cut before approval.

1. **Confirm the connection** — `list_projects`. Ask which project only if the request
   does not make it clear.

2. **Interview, one question at a time.** Keep the person's original request and an
   `answers` map keyed by question id. Put everything the request already answers into
   `answers` — never ask it again. Call `interview_batch` **once** and cache the returned
   queue; "batch" refers to tool retrieval, not presentation. Present exactly one short
   question at a time, multiple choice wherever practical.

   Between replies: record the value, skip answered fields, ask the next queued question.
   No per-answer MCP calls, research, file reads, style lookups, recaps or plan drafting —
   save detailed reasoning for after collection.

   - Ask **clip type early**, then offer **director style** immediately afterward.
     Select the cached style question's `optionsByGenre[answers.genre]` **locally** (closest
     cached genre for a custom type). Offer three named styles with short descriptions plus
     House style where the host permits four choices, and allow a custom reference via free
     text. This menu needs no tool call and no research. Never use a menu cached from before
     the clip-type answer, and never re-ask a style the person already supplied.
   - For **music**, separate role (`music`: bed / score / none) from selection
     (`musicSelection`: choose for me / a named film or series soundtrack / specified
     tracks, artists or files). Collect names, links, paths and cue preferences verbatim in
     `musicReference`, and only when missing. `music: none` skips both follow-ups. Explicit
     delegation fills `musicSelection=choose` without another question; an unanswered choice
     does not. If `musicSelection` changes, clear the dependent `musicReference` unless the
     person explicitly keeps it. A soundtrack reference does not change the directing style.
     Research and audition music **after** collection.
   - Free text suits the subject, an original script or shot list, scene context, or a
     custom preference. **Preserve supplied scripts and shot lists verbatim.** Map labels to
     option values — never store a label where an enum value belongs. For `multiSelect`,
     collect an array.
   - Refresh the queue only when it is exhausted, or when a changed answer invalidates
     dependent choices; ask newly applicable questions one at a time too. `interview_next`
     is the fallback for clients that cannot cache a queue. Show the whole questionnaire
     only on request.
   - A pending question, a preselected default, a timeout or silence is **never** an answer.
     An explicit "you decide" delegates the choice — state that assumption in the plan.

   When collection is complete, review all the answers together and resolve material
   contradictions.

3. **Brief and research.** Create the project at the requested frame if needed, then
   `set_brief`. Read `get_playbook preproduction` and `get_style` for the chosen style.

4. **Author the plan** — beats, script, shots, source list, sound plan. For a researched
   director reference, carry its craft record into `plan.styleTreatment` (`reference`,
   `mechanism`, `materialPlan`, `rhythm`, `sound`, `typography`, `exceptions`,
   `evaluation`). Creative defaults guide review; **source integrity and the technical
   checks remain requirements**.

   Design the **film's title separately from supporting typography** — read
   `guide/playbooks/typography-and-motion.md` after the interview. Specify the title's
   words, font, palette, composition, timing and reveal, then the supporting text system.
   `role: title` is the film's own name; statements, chapters and CTAs keep their
   supporting roles even when large. A title may have its own display font; give it
   prominence through scale, space and timing while respecting restrained styles. Do not
   add a film title to a scene by default.

5. **Approval.** `set_plan` → `check_plan` → fix errors → `plan_document`. Show the
   complete document, including any paid generation, and get approval **for that specific
   plan**. Call `approve_plan` only once the person has approved it; an approval already
   given in this conversation counts, so don't ask twice. This is film-plan approval — it
   does not cover routine repository changes.

6. **Fan out.** `plan_tasks` describes the dependencies. Source and import permitted media,
   generate approved AI shots and narration where configured, then assemble. Concurrent
   scouts may inspect and source independently; **keep timeline mutations coordinated**.

7. **Cut, verify, deliver** — the loop below. Show the draft for feedback, then render the
   final.

For a **targeted edit to an existing project**, use its saved brief, plan and the person's
request; do not restart the full interview. **Create a checkpoint before changing the cut.**

## The editing loop

1. Follow [`guide/RULES.md`](../guide/RULES.md) at all times (it is also embedded in the
   server's instructions).
2. Read the playbook for the job **first** — `get_playbook`: `interview-cleanup`,
   `scene-highlight`, `vertical-repurpose`, `music-montage`, `assembly-from-transcript`,
   `delivery-verify`, `director-style`, `film-dialogue`, `trailer-construction`,
   `typography-and-motion`, `preproduction`.
3. **Perceive before cutting** — `get_contact_sheet`, `detect_scenes`, `detect_silences`,
   `transcribe`.
4. `create_checkpoint` → cut with `apply_edit_list` → `render_draft` → verify with
   `check_cuts`, `pacing_report`, `check_soundtrack`, `check_text`, `verify_export`,
   `get_frame`. **Only then** `render_final`.
5. Report the cut and why, every check's result, the change list, and what you could not do.

**Reusing film clips:** select clean dialogue or separate the source audio. Embedded music
fails `check_soundtrack`; unknown or unreviewed audio stays a review finding.

**Still-image motion:** use the native motion presets or transform keyframes — the renderer
interpolates between pixels to avoid stepped pans and zooms. Keep movement restrained,
retain source resolution, and check a rendered moving excerpt at the delivery frame rate.
A contact sheet cannot verify smoothness. Prefer a static hold when motion adds little.

**Honesty:** report the actual render path and the real verification results. Do not claim
to have listened to audio or inspected frames unless you did — the mechanical checks have
limits, and saying so is part of the report.

## Working on the code

Setup and dependencies: [`docs/DEPENDENCIES.md`](DEPENDENCIES.md). Routes:
[`docs/AGENT-API.md`](AGENT-API.md). History: [`docs/CHANGELOG.md`](CHANGELOG.md).
Windows and Codex specifics: [`docs/WINDOWS-CODEX.md`](WINDOWS-CODEX.md).

```
corepack pnpm exec tsc --noEmit -p tsconfig.json   # type-check
corepack pnpm exec eslint <paths>                  # lint (targeted)
corepack pnpm test:platform                        # all tests/platform/*.test.ts
corepack pnpm test:mcp                             # MCP acceptance (needs the app running)
corepack pnpm test:eval                            # scored editing tasks (needs the app)
corepack pnpm test:e2e                             # Playwright
```

`test:platform` runs the individual suites, each also available on its own:
`test:windows`, `test:motion`, `test:interview`, `test:director-style`, `test:typography`,
`test:source-music`, `test:trailer`.

On Windows use the native Node launchers; **do not** set a global Bash `script-shell`.

Tests import the Prisma client. The desktop launchers generate it, so in a fresh
checkout that has not been launched yet, run `corepack pnpm db:sqlite:generate` first.

**Never push to the upstream `slopstudio-pro` repository.** This repository's remote is
`BFParsons/SlopDirector`.
