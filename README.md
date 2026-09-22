<p align="center">
  <img src="SlopCharacters/logo.png" alt="SLOP STUDIO PRO, in marquee lights, because of course" width="560">
</p>
<p align="center">
  <img src="SlopCharacters/videoslop.png" alt="A small robot that is also a 1930s film camera. It has seen things." width="200">
</p>

# SlopDirector

**An AI agent that makes documentaries out of YouTube clips, a synthesised narrator, and
an unreasonable amount of self-doubt.**

SlopDirector is a filmmaking harness bolted onto a real, working, Premiere-style video
editor (SlopStudio: Electron + Next.js + ffmpeg + SQLite). An agent connects over
[MCP](https://modelcontextprotocol.io), interviews you one question at a time like a
polite but relentless producer, writes a plan, waits for your approval, and only *then*
goes off to find footage, generate the voiceover, cut the timeline, check its own work
against 38 house rules, and render an MP4. You can watch it do all of this in the open
editor, playhead and all, like a ghost who went to film school.

This fork exists so you can drive the whole thing from **[OpenCode](https://opencode.ai)
on a Mac**. The Windows + Claude Code and Codex paths from the parent repository
(`BFParsons/SlopDirector`) still work. No secrets live in this tree or its history. We
checked. Twice.

> **Is it good?** It is *disturbingly* okay. Three films have been made with it in the
> style of Adam Curtis, one of which is a five-minute plot summary of *Kazaam* (1996)
> scored with cues from *The Power of Nightmares*. Nobody asked for this. It was made
> anyway. That is the whole spirit of the project.

---

## What happens when you press go

```
you:      /interview a three-minute film about why my sourdough starter died
agent:    What kind of piece is this?   ○ Explainer  ○ Essay film  ○ Trailer  ○ Music montage
you:      Essay film
agent:    Directing style?   ○ Adam Curtis  ○ Errol Morris  ○ Werner Herzog  ○ House style
you:      Herzog, obviously
          ...eleven more questions, one at a time, no monologues in between...
agent:    Here is the plan. Beats, script, shot list, clip list, music brief. Yes or changes?
you:      yes
agent:    *fans out three subagents, imports 14 clips, generates 9 lines of narration,
           cuts, checks pacing, checks the soundtrack, checks the type, renders a draft,
           looks at the draft, fixes two things, renders the final*
agent:    final.mp4 — 3:02, 1920×1080. Two warnings I overruled and why. Here's what I couldn't do.
```

Nothing is sourced, generated or cut before you approve the plan. The agent is not allowed
to claim it listened to something it did not listen to. These are load-bearing rules.

## Quick start (macOS + OpenCode)

```sh
brew install node@24 yt-dlp git
corepack enable

git clone https://github.com/BFParsons/SlopDirector-OpenCode.git
cd SlopDirector-OpenCode
bash scripts/fetch-ffmpeg.sh          # a static ffmpeg WITH drawtext + libass (Homebrew's has neither)
corepack pnpm install --frozen-lockfile
corepack pnpm doctor              # tells you what you forgot
corepack pnpm desktop:prod        # the editor opens; first launch builds the server

opencode                          # in this directory, in another terminal
```

That's it. [`opencode.json`](opencode.json) registers the MCP server for you, so the first
useful thing to type into OpenCode is:

```
/interview <what you want, in your own words>
```

Narration needs an ElevenLabs key (or an OpenRouter key for the fallback voice); AI-generated
shots need OpenRouter. Copy [`.env.example`](.env.example) to `.env` and fill in what you
use. Without either key you still get a complete editor and a very capable clip-cutting
agent, just a silent one.

The long version, including the optional Demucs/Whisper audio stack and how to package a
`.app`: **[docs/MAC-OPENCODE.md](docs/MAC-OPENCODE.md)**. Windows and Codex:
[docs/WINDOWS-CODEX.md](docs/WINDOWS-CODEX.md). Claude Code: [CLAUDE.md](CLAUDE.md).

## What's in the box

| piece | where | what it does |
|---|---|---|
| **The editor** | `src/`, `electron/` | A real NLE. Multi-track timeline, live canvas preview, media bucket, Audio Studio, ffmpeg render engine, SQLite. Works fine without any agent, if you enjoy doing things yourself. |
| **The MCP server** | [`mcp/`](mcp/README.md) | 68 tools over the app's HTTP API: project, media, inspect, timeline, render, verify, pre-production, sourcing, typography. `pnpm test:mcp` runs 78 acceptance checks against the running app. |
| **The rulebook** | [`guide/`](guide/) | [`RULES.md`](guide/RULES.md) (38 always-on rules), an editing guide, playbooks for common jobs, and the tool appendix. The agent is fed this whether it likes it or not. |
| **Directing styles** | [`guide/styles/`](guide/styles/README.md) | 43 filmmakers and houses, each researched into signature, structure, shot lengths, narration, sound, picture, type. `check_plan` and `pacing_report` hold the cut to the chosen one. Yes, it knows how long a Herzog shot is. |
| **Typography** | `src/lib/typography`, [`public/fonts`](public/fonts/LICENSES.md) | Safe-area profiles for web, broadcast, 9:16 and square; 43 open-licence faces; a type system per style. Text does not fall off the edge of the frame. |
| **The fan-out** | [`.opencode/agents/`](.opencode/agents/) | `clip-scout`, `narrator`, `shot-picker`: subagents launched in parallel after approval, each locked to the handful of tools its job needs. Same trio lives in `.claude/agents/` for Claude Code. |
| **Slash commands** | [`.opencode/commands/`](.opencode/commands/) | `/interview`, `/preproduction`, `/edit-video`, `/playbook`. The MCP prompts, which OpenCode doesn't surface, wearing a hat. |
| **The loop, canonically** | [`docs/HARNESS-LOOP.md`](docs/HARNESS-LOOP.md) | Host-neutral source of truth. Change it there first; [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) are the same loop in each host's dialect. |

## The loop, for people who skim

1. **Interview.** One question at a time, multiple choice, recommended option first. Clip
   type early, director style right after. Music *role* and music *selection* are separate
   questions because they are separate decisions.
2. **Brief → Plan.** Beats, script with word-per-second budgets, storyboard, clip list with
   search queries, AI shot list, music brief. If a director is named, their craft record
   goes into the plan and the checks enforce it.
3. **Approval.** The plan document is shown in full, boxed tables and all, including
   anything that costs money. The agent waits for a yes. A shrug is not a yes.
4. **Fan out.** Scouts find and import clips, the narrator generates lines and trims them to
   their slots, the shot-picker proposes in/out points with frame evidence. One writer on
   the timeline at a time.
5. **Cut → Verify → Render.** Checkpoint, apply the edit list, draft, then `check_cuts`,
   `pacing_report`, `check_soundtrack`, `check_text`, `verify_export`, look at frames,
   *then* the final. The report says what every check found and what the agent could not do.

## Things it is honest about

- **It has never run on a real Mac.** The macOS fixes (one embedded server instead of two,
  Homebrew on PATH for Finder launches, a `.dmg` target, a static ffmpeg fetch for arm64 and
  Intel, LF line endings) came from a careful code audit on a Windows box. CI now runs on
  `macos-latest`, which is a start. Bug reports from actual Macs are the most useful thing
  you can give this project.
- **No VideoToolbox yet.** The renderer knows NVENC, QSV and VAAPI. On a Mac it falls back to
  software x264, which is correct and merely slower. Adding `h264_videotoolbox` is the
  obvious first pull request.
- **Homebrew's ffmpeg is not enough.** Its current formula is built without libfreetype and
  libass, so `drawtext` and `ass` do not exist and every title and caption fails. The fetch
  script above drops a full static build into `vendor/ffmpeg/`, which the app prefers
  automatically. `corepack pnpm doctor` will tell you if you skipped this.
- **YouTube is YouTube.** Sourcing uses `yt-dlp`. Reusing film clips with embedded music will
  fail `check_soundtrack`, on purpose. Clean dialogue or stem separation or pick another shot.
- **It is called SlopStudio.** The name predates the harness and has been kept out of
  respect for the marquee lights.

## Working on it

```sh
corepack pnpm db:sqlite:generate                    # once, if you run tests before ever launching
corepack pnpm exec tsc --noEmit -p tsconfig.json   # type-check
corepack pnpm test:platform                        # 45 tests, about one second
corepack pnpm test:mcp                             # needs the app running on :38473
corepack pnpm exec eslint <paths>
```

Everything the agent reads lives in the repo, so improving the harness is mostly editing
Markdown: a new playbook in `guide/playbooks/`, a new director in `guide/styles/`, a
sharper rule in `guide/RULES.md`. Server changes need a fresh MCP connection before you
trust the output; a running stdio process remembers the old guide text with great loyalty.

## Lineage

SlopStudio started life as SpotForge, a political-ad generator, grew a proper NLE, moved to a
Linux laptop, then Windows, and now a Mac. The full editor reference (features, ffmpeg
pipeline, data model, env vars, the original web deploy) is preserved in
[docs/SLOPSTUDIO-ORIGINS.md](docs/SLOPSTUDIO-ORIGINS.md). The agent harness was added in
`BFParsons/SlopDirector`; this fork tracks it as `upstream`.

Bundled fonts carry their own licences in [`public/fonts/LICENSES.md`](public/fonts/LICENSES.md).
The repository itself does not yet have a licence file, which means the default applies:
you may read and fork it on GitHub, and should ask before redistributing it.

---

<p align="center"><sub>The robot camera has no name. Suggestions are welcome. Suggestions will be judged.</sub></p>
