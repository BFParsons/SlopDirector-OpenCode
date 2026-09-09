# A Guide to Great Digital Film Editing

> Companion guide for SlopStudio, a Linux video editor with an MCP server. Written for human editors and for agents operating the app. Software-specific parts (I–III, appendices) describe SlopStudio as built; every `[TOOL: …]` names the MCP tool that runs the check, or says *not available*.

---

# Table of Contents and Outline

---

## Part I: Orientation

### 1\. What This App Is

- Design philosophy: open formats, scriptability, and a first-class agent interface  
- Who edits here: humans, agents, and mixed sessions  
- What this guide is and how to read it (rules, rationale, and tool mappings)  
- Conventions used in this guide

### 2\. The Data Model

- Projects and project files  
- Media pool and media references  
- Bins, folders, and tags  
- Timelines and sequences  
- Tracks: video, audio, subtitle, and data  
- Clips, subclips, and clip instances  
- In/out points, source vs. record time  
- Effects, transitions, and parameter keyframes  
- Markers, ranges, and notes  
- Identifiers: how every object is addressed by humans and tools

### 3\. Linux Foundations

- Why Linux: stability, headless operation, and automation  
- FFmpeg as the decode/encode backbone  
- Codec support: what plays natively and what needs transcoding  
- GPU acceleration: VAAPI, NVDEC/NVENC, Vulkan  
- Audio stack: PipeWire, JACK, and ALSA  
- Color management: ICC, OCIO, and display calibration  
- Storage and filesystems for media (ext4, XFS, Btrfs, NFS)  
- Fonts, plugins, and system dependencies

### 4\. Installing and Configuring the App and the MCP Server

- Installation options: packages, Flatpak, AppImage, source  
- First-run configuration  
- Scratch disks, cache, and render locations  
- Enabling the MCP server  
- Authentication, permissions, and sandboxing  
- Connecting a client or agent harness  
- Headless and remote operation  
- Logging and diagnostics

---

## Part II: The MCP Harness

- §11 Pre-production: the interview, the brief, the plan (added for the harness)

### 5\. Tool Surface Overview

- Tool categories: read, write, render, and session  
- Read tools: state, metadata, and queries  
- Write tools: editing, effects, and organization  
- Render tools: previews, stills, and exports  
- Session tools: undo, transactions, and locks  
- Return formats: JSON schemas and error conventions  
- Rate limits, timeouts, and long-running operations

### 6\. Inspecting a Project

- Listing media and reading technical metadata  
- Reading transcripts, scene detection, and analysis data  
- Querying timelines: clips by track, time range, or tag  
- Reading markers, ranges, and notes  
- Finding gaps, overlaps, and orphaned media  
- Summarizing a project for a first look

### 7\. Making Cuts Programmatically

- Insert vs. overwrite  
- Trimming heads and tails  
- Ripple and roll  
- Slip and slide  
- Lift and extract  
- Splitting and joining clips  
- Moving and reordering clips  
- Working across multiple tracks  
- Linked vs. unlinked audio and video  
- Timecode, frames, and time expressions

### 8\. Verifying Your Work

- Rendering frame grabs at specific timecodes  
- Contact sheets and thumbnail strips  
- Audio waveforms and loudness readouts  
- Scopes: waveform, vectorscope, histogram  
- Timeline diffs: before and after an operation  
- Playing back ranges for human review  
- Automated checks: flash frames, gaps, silence, clipping

### 9\. Transactions, Undo, and Safe Batch Operations

- The undo stack and named checkpoints  
- Grouping operations into transactions  
- Dry runs and previews of batch edits  
- Locks and conflict handling in shared sessions  
- Snapshots and reverting a timeline  
- Idempotency and retry-safe operations

### 10\. Prompting Patterns

- Describing an edit unambiguously  
- Referring to clips, ranges, and positions  
- Giving creative direction vs. mechanical instruction  
- Iterative refinement: note, apply, verify  
- Constraints: duration, pacing targets, must-keep shots  
- Common misunderstandings and how to avoid them  
- Example prompts and the operations they produce

---

## Part III: Ingest and Organization

### 11\. Import, Transcoding, and Proxies

- Supported sources: files, cards, folders, network shares  
- Import options and media linking  
- When to transcode and when to leave native  
- Proxy generation and resolution choices  
- Proxy/original switching and relinking  
- Handling variable frame rate and mixed formats  
- Audio extraction and channel mapping

### 12\. Metadata, Naming, and Search

- Naming conventions for media, bins, and timelines  
- Scene, shot, and take metadata  
- Tags, ratings, and color labels  
- Automated analysis: transcripts, faces, scene cuts, loudness  
- Searching by metadata, transcript text, or visual content  
- Keeping metadata useful for agents

### 13\. Sync, Multicam, and Grouping Clips

- Syncing by timecode, audio waveform, or slate  
- Building multicam groups  
- Switching angles in the timeline  
- Grouping and compound clips  
- Nesting timelines

### 14\. Backup, Versioning, and Project Portability

- Autosave and backup policy  
- Project versions and branching  
- Media consolidation and trimming  
- Moving projects between machines  
- Archiving finished projects  
- Recovering from corruption or lost media

---

## Part IV: The Craft of the Cut (Stated as Rules)

### 15\. Shot Grammar and Continuity

- Shot sizes and when to change them  
- The 180-degree rule and screen direction  
- The 30-degree rule  
- Matching action across cuts  
- Eyelines and spatial logic  
- Establishing shots and re-establishing  
- Continuity errors: what to hide and what to fix

### 16\. Rhythm and Pacing

- What rhythm means in a cut  
- Shot length as a controllable variable  
- Cutting on motion, on stillness, and on the beat  
- Building and releasing tension  
- Measuring pace: average shot length and its limits  
- Pacing targets by genre and platform  
- When to hold and when to cut early

### 17\. Cutting Dialogue

- Finding the best take and the best line reading  
- Reaction shots and the listener  
- J-cuts and L-cuts  
- Overlapping dialogue and interruptions  
- Subtext: cutting for what isn't said  
- Removing ums, pauses, and stumbles  
- Pacing conversation without flattening it

### 18\. Cutting Action

- Geography: where everyone is and where they're going  
- Motion matching and direction across cuts  
- Clarity over speed  
- Impact frames and hit points  
- Coverage strategies for chaotic footage  
- Sound as the glue for action

### 19\. Montage, Ellipsis, and Time Compression

- Types of montage  
- Compressing hours, days, and years  
- Elision: what to leave out  
- Parallel action and intercutting  
- Music-driven montage  
- Avoiding the generic montage

### 20\. Transitions

- The straight cut as the default  
- Dissolves: duration and meaning  
- Fades and blacks  
- Wipes, whips, and stylized transitions  
- Match cuts and graphic matches  
- Rules for when a transition is justified

### 21\. The Kuleshov Effect and Meaning Between Shots

- What the Kuleshov effect demonstrates  
- Juxtaposition as authorship  
- Implying cause, thought, and emotion  
- Using it deliberately and avoiding accidental meaning  
- Testing juxtapositions quickly

### 22\. Case Studies: Five Editing Styles and How to Emulate Them

- Dede Allen: cutting for character energy  
- Walter Murch: the blink, the sound, and the Rule of Six  
- Thelma Schoonmaker and Martin Scorsese: kinetic, musical, confrontational  
- Andrei Tarkovsky: time pressure and the long take  
- Edgar Wright: comic rhythm and the visual punchline  
- Choosing a style, or not

---

## Part V: Structure and Iteration

### 23\. From Transcript or Logs to Assembly Cut

- Reading and marking the transcript  
- Paper edits and selects reels  
- Building a stringout  
- Radio cuts for interview-driven work  
- Ordering scenes from the script or outline  
- Letting an agent build the first assembly

### 24\. Rough Cut, Fine Cut, and Picture Lock

- What each stage is for  
- Trimming for shape before trimming for polish  
- Tracking runtime and pacing across versions  
- Locking picture and what changes after lock  
- Handling late changes safely

### 25\. Giving and Receiving Notes

- Notes that describe problems vs. notes that prescribe fixes  
- Timecoded notes and markers  
- Prioritizing and batching notes  
- Writing notes an agent can act on  
- Disagreeing productively  
- Closing the loop: verifying a note was addressed

### 26\. Review, Comparison, and Alternate Versions

- Side-by-side and A/B comparison  
- Version naming and duplication  
- Alternate cuts for length, rating, or platform  
- Exporting review copies with burn-ins  
- Collecting feedback from screenings

---

## Part VI: Sound

### 27\. Dialogue, Ambience, Effects, and Track Layout

- Standard track layout and naming  
- Cleaning dialogue: room tone, fills, and gaps  
- Ambience and atmosphere beds  
- Sound effects: hard effects and foley  
- Sound as continuity across cuts  
- Sync and drift checks

### 28\. Music

- Temp music and its dangers  
- Placing music cues  
- Beat alignment and cutting to music  
- Editing music: shortening and extending cues  
- Rhythm and energy across a sequence  
- Handing off to a composer

### 29\. Mixing Basics and Preparing Stems

- Levels, panning, and basic EQ  
- Loudness standards by platform  
- Ducking and automation  
- Exporting stems and OMF/AAF  
- What to leave for the mix

---

## Part VII: Picture Finishing and Delivery

### 30\. Color Correction and Grading

- Correction vs. grading  
- Reading scopes  
- Primary corrections: exposure, white balance, contrast  
- Secondary corrections and masks  
- Shot matching across a scene  
- LUTs, looks, and color spaces  
- Grading with an agent: what to specify

### 31\. Titles, Graphics, and Compositing

- Title design basics: type, safe areas, duration  
- Lower thirds and captions  
- Subtitles and accessibility  
- Basic compositing and keying  
- Stabilization, reframing, and clean-up  
- Round-tripping to external tools

### 32\. Render Presets, Export, and Delivery Specs

- Choosing codecs and containers  
- Resolution, frame rate, and aspect ratio decisions  
- Bitrate and quality settings  
- Platform specifications  
- Burn-ins, slates, and deliverable naming  
- Batch rendering and queue management  
- Verifying exports

### 33\. Interchange

- OpenTimelineIO  
- EDL and CMX3600  
- AAF and FCPXML  
- Round-tripping with other tools  
- Conform and relink workflows  
- What survives interchange and what doesn't

---

## Part VIII: Genre Playbooks

### 34\. Documentary and Interview-Driven Edits

- Finding the story in unscripted footage  
- Transcript-first workflows  
- Structuring interviews and B-roll  
- Verité and observational pacing  
- Ethics of the documentary cut

### 35\. Narrative and Comedy Timing

- Serving performance  
- Comedy timing: setup, beat, punchline  
- Reaction and the cutaway laugh  
- Drama: holding on emotion  
- Genre expectations and rhythm

### 36\. Short-Form and Social Cuts

- Hook, retention, and the first three seconds  
- Vertical and square reframing  
- Captions and sound-off viewing  
- Pacing for platform norms  
- Repurposing long-form into short-form

### 37\. Automated and Agent-Assisted Workflows

- Tasks agents do well: logging, syncing, assemblies, conforms  
- Tasks that need human judgment  
- Human-in-the-loop review patterns  
- Guardrails and approval gates  
- Measuring agent output quality  
- Building repeatable pipelines

---

## Appendices

### A. MCP Tool Reference

- Tool list by category  
- Parameters, return schemas, and examples  
- Error codes

### B. Keyboard Shortcuts and CLI Equivalents

- Editing shortcuts  
- Navigation shortcuts  
- CLI commands and scripting entry points

### C. Glossary

- Editing terms  
- Technical terms  
- App-specific terms

---

*Written for this app. Everything here is checkable against `docs/AGENT-API.md` and `mcp/`.*

---

# Part I: Orientation

## 1\. What This App Is

SlopStudio is a small non-linear editor for short-form and social video that was built as a JSON API first and a desktop UI second. Every operation the timeline supports is a route under `/api`; the render engine is a job queue over ffmpeg 9; the desktop shell (Electron) is a viewer over the same state. That is why an agent can operate it: the agent and the person edit the same project, and the open editor refreshes when the agent changes something.

**Design philosophy.** Open formats (MP4/MOV/MKV/WebM in, H.264/HEVC/AV1/VP9/ProRes out), scriptability (a REST API and an MCP server), and a first-class agent interface (checkpoints, batch edits with rollback, perception tools, mechanical checks).

**Who edits here.** A person in the desktop app; an agent through the MCP server (`pnpm mcp`); or both at once. Edits from either side broadcast a `project.changed` event, so the other side stays current.

**How to read this guide.** Parts I–III describe the app; Parts IV–VIII state craft as rules with rationale. Where a rule has a mechanical check, the check names the MCP tool that runs it. Where the app cannot do something the rule assumes, the mapping says so plainly instead of pretending.

**Conventions.** Times are seconds (floating point) at 30 fps; a frame is 0.0333 s. Tool names are in code (`add_segment`). Chapter references are "ch.17". Anything marked *not available* is a limitation of this app today.

## 2\. The Data Model

- **Project.** The unit of work: a frame (`frameWidth`×`frameHeight`, or an aspect + resolution preset), an export codec, project-wide looks (`colorLook`, a `.cube` LUT, `transition` + `transitionMs`, `fillMode`, `vignette`, `grain`), captions (`captionsEnabled`, `captionStyle` OUTLINE/BOX/POP, position, size), a watermark, and an audio mode: `NONE` (the clips' own audio + music + overlays make the soundtrack), `UPLOAD_AUDIO` (a master voice track you upload), `TTS_FROM_SCRIPT` / `TTS_VERBATIM` (narration synthesized from `voScript` — costs credits).
- **Media bucket.** Assets: uploads (video, image, audio), generated clips, LUTs, renders. Reusable across the person's projects (`list_media`). Every asset has an id, a kind, a mime, a size, and a file on disk (`probe_asset` gives duration, video stream and absolute path).
- **Bins, folders, tags.** *Not available.* There is one bucket per project plus the cross-project list; organization lives in titles and in your notes.
- **Timeline = segments.** Track 0 is the main sequence in `index` order; each segment is a clip instance with `trimStartS` (source in-point), `durationS` (on-screen length), `speed` (0.5–2), `muted` (false = its own audio is mixed in), colour primaries (`brightness`, `contrast`, `saturation`), a keyframed `transform` (scale/pan), and an `effects[]` stack (blur, chromaKey, crop, deinterlace, denoise, deshake, detail, mirror, pixelate, rotate, sharpen, smoothSlowmo, stabilize, tonemap). The main sequence is a *ripple* sequence: segments abut, there are no gaps, and changing a duration moves everything after it.
- **Tracks ≥ 1** are positioned overlays (picture-in-picture or full-frame B-roll): `offsetS` on the timeline, `pip` = {scale, posX, posY, opacity}. **Audio-only** segments (`audioOnly: true`) are unlinked audio clips at `offsetS` — this is how you build a J/L cut, a room-tone fill, or a sound bridge.
- **Source vs. record time.** Source time = seconds into the asset (`trimStartS`); record time = seconds into the timeline (the running sum of main-sequence durations; `pacing_report` and `check_cuts` list the cut times).
- **Effects and transitions.** Effects are per segment (export-time, ffmpeg). Transitions are project-wide: one style and duration between every main-sequence cut. There is no per-cut transition.
- **Text overlays** (`add_text_overlay`): burned-in titles and lower thirds with position, size, colour, box, start/end and a fade. **Audio overlays**: YouTube-grabbed audio mixed over the final at `offsetS`.
- **Markers, ranges, notes.** *Not available.* Use checkpoint labels and your report.
- **Identifiers.** Projects, assets, segments, overlays and checkpoints all have string ids; `get_project` returns the compact view with every id an agent needs.
- **Renders.** `finalRender.assetId` is the last full export; `finalRender.draftAssetId` the last ≤640×360 preview. Drafts never overwrite finals.

## 3\. Linux Foundations

- **ffmpeg 9** is the decode/encode backbone (system build on Arch; a static build in the AppImage). Import: H.264, HEVC, AV1 (dav1d), VP9, ProRes, MPEG-2, in MP4/MOV/MKV/WebM/AVI/TS. Export: H.264 and HEVC on VA-API (Intel/AMD) with CPU fallback (x264/x265), AV1 (SVT-AV1 / libaom), VP9, ProRes 422 HQ (`export_formats` lists what this machine validated).
- **GPU acceleration.** VA-API encode and decode on Intel/AMD; the decode path is used only when it is faster than the CPU (4K→1080p downscales, 10-bit HEVC); NVENC/QSV when present. Preview in the desktop app decodes in Chromium (VA-API on Wayland).
- **Audio stack.** The app never touches the sound server: it reads and writes files. Loudness, silence and tempo are measured with ffmpeg (ebur128, silencedetect) and librosa (beat grid) in a Python venv; Whisper transcribes in the same venv.
- **Colour management.** *Limited.* No OCIO/ICC pipeline: Rec.709 in and out, `tonemap` effect for HLG/PQ sources, LUTs applied as `lut3d`. Judge colour on the draft with `get_frame`; there are no scopes.
- **Storage.** SQLite database + an asset folder per project (or a portable project bundle). Any filesystem; keep media on local SSD for renders.
- **Fonts.** DejaVu is bundled for captions and titles (libass/drawtext).

## 4\. Installing and Configuring the App and the MCP Server

- **Run modes.** Desktop app (app-menu entry, `scripts/launch-desktop.sh --prod`); headless (`pnpm serve:headless`, same DB and worker, no window); dev (`--dev`). The API is on `http://127.0.0.1:38473` by default.
- **First run.** `.env` sets `SLOPSTUDIO_DB=sqlite`, `SLOPSTUDIO_DESKTOP=1` (single local user, no login), `DATABASE_URL`, `ASSET_ROOT`, the Python venv (`SLOPSTUDIO_PYTHON`), and optional AI keys. The host is probed once for encoders/decoders and cached (`capabilities-cache.json`).
- **Scratch and cache.** Renders go under the project's asset folder (`final/`, `tmp/`); perception outputs (frames, contact sheets, transcripts, extracted audio) under `cache/`.
- **Enabling the MCP server.** `pnpm mcp` (stdio). `.mcp.json` registers it for Claude Code in the repo; `mcp/README.md` has Claude Desktop and Codex config. `SLOPSTUDIO_URL` points it at another server.
- **Authentication and permissions.** Desktop mode needs no credentials. For a shared server, unset `SLOPSTUDIO_DESKTOP` and set `SLOPSTUDIO_API_TOKEN` (+ `SLOPSTUDIO_API_TOKEN_USER`); the MCP server sends it as a bearer token. There is no per-tool permission system: the guardrails in ch.37 are behavioural (checkpoints, propose-and-approve) and enforced by the playbooks, not by the server.
- **Logging and diagnostics.** The server logs jobs (`[worker]`, `[assemble]`) to stdout; every mutation emits `project.changed` with the client id; checkpoints are the audit trail. `render_status` shows progress and errors.

---

# Part II: The MCP Harness

## 5\. Tool Surface Overview

Read tools (safe, repeatable): `list_projects`, `get_project`, `list_media`, `probe_asset`, `get_frame`, `get_contact_sheet`, `detect_scenes`, `detect_silences`, `transcribe`, `analyze_audio`, `pacing_report`, `check_cuts`, `check_beat_alignment`, `verify_export`, `compare_versions`, `list_checkpoints`, `render_status`, `export_formats`, `search_guide`, `read_guide`, `list_guide`, `get_playbook`.

Write tools: `create_project`, `update_project`, `delete_project`, `import_media`, `import_youtube`, `set_music`, `set_lut`, `add_segment`, `update_segments`, `split_segment`, `reorder_segments`, `delete_segment`, `add_text_overlay`, `remove_text_overlay`, `apply_edit_list`.

Render tools: `render_draft`, `render_final`, `cancel_render`.

Session tools: `create_checkpoint`, `restore_checkpoint`, `apply_edit_list` (a checkpointed transaction).

**Return formats.** JSON as text; images (`get_frame`, `get_contact_sheet`) as image content plus a caption with the times. Errors come back as `isError` text with the server's message — read it; it usually says what to change. Long operations (`transcribe`, `render_*`) block by default; `wait:false` returns immediately and `render_status` polls. No rate limits; renders run one at a time per project.

## 6\. Inspecting a Project

- `get_project` — everything an agent needs on one screen: frame, look, captions, music, every segment with ids and trims, overlays, render state, total timeline length.
- `probe_asset` — technical metadata and the file path. `list_media` — what is available to place.
- `transcribe` — Whisper with segment and word timings; cached per asset and model. `detect_scenes` — cuts and shots. `detect_silences` — silences and the complementary speech ranges. `analyze_audio` — LUFS, true peak, silence, BPM + beat grid.
- Timeline queries: `pacing_report` (durations, statistics, cut times), `check_cuts` (per-cut findings), `check_beat_alignment` (cuts vs beats).
- Gaps and overlaps: the main sequence cannot have gaps (ripple). Overlays that run past the end are flagged by `check_cuts`. Orphaned media: `list_media` shows which assets are on this timeline.
- First look: `get_project` + `get_contact_sheet` of each source + `pacing_report`.

## 7\. Making Cuts Programmatically

The vocabulary of a traditional NLE maps onto segment operations:

| Editing operation | In SlopStudio |
|---|---|
| Insert | `add_segment` appends to the main sequence; `reorder_segments` places it. Everything after ripples. |
| Overwrite | *Not available as one op*: `split_segment` at the point, `delete_segment` the piece, `add_segment` the replacement, `reorder_segments`. Or `apply_edit_list` doing all four. |
| Trim head / tail | `update_segments` `trimStartS` (head) and `durationS` (tail). Ripple is automatic. |
| Ripple | Inherent: the main sequence has no gaps. |
| Roll | Shorten one segment's `durationS` and lengthen its neighbour's by the same amount (and move the neighbour's `trimStartS` if rolling the head). One `update_segments` call. |
| Slip | Change `trimStartS`, keep `durationS`. |
| Slide | `reorder_segments` (main sequence) or `offsetS` (overlay track). |
| Lift / extract | `delete_segment` (always an extract: the gap closes). |
| Split / join | `split_segment {atS}` (on-screen time); join = delete the second piece and extend the first's `durationS`. |
| Multi-track | Tracks ≥ 1 via `add_segment {track, offsetS, pip}`. |
| Linked / unlinked audio | `muted:false` keeps a clip's audio with its picture; `audioOnly:true` is an unlinked audio clip at `offsetS`. |
| Speed | `speed` 0.5–2 on the segment (`smoothSlowmo` effect for interpolated slow motion). |
| Time expressions | Seconds as decimals. 1 frame = 0.0333 s. Timeline time = running sum of `durationS` on track 0. |

**Rule: Express a multi-step cut as one `apply_edit_list`.** It checkpoints first, applies the ops in order, lets you reference new segments as `$1`, `$2`…, and rolls back on failure.

### Sound: how SlopStudio builds the mix

Picture and sound are decided separately. A shot on the timeline is silent or not; the soundtrack is assembled from layers that each have a switch:

| Layer | Where it comes from | Switch / level | Ducks the music? |
|---|---|---|---|
| A shot's own sound | the source file's audio (an imported YouTube clip carries its narrator and its music) | segment `muted` — the raw API keeps an upload's sound (`muted:false`); the MCP `add_segment` mutes video by default | no |
| Audio-only clip | `add_segment audioOnly:true` at `offsetS` — narration, room tone, a sound bridge | always audible; `trimStartS`/`durationS` | yes |
| Voiceover track | `audioMode` UPLOAD_AUDIO / TTS: one master narration from t = 0 | `voVolume`, `voMuted` | yes |
| Music bed | `set_music` — looped or trimmed to the picture, 0.75 s fade built in | `musicVolume` (0–1), `musicDucking`, `musicMuted`, `audioFadeOutS` | it *is* what ducks |
| Audio overlay | `import_youtube kind=audio` — mixed on top at `offsetS` | `volume`, `included` | no, and nothing ducks it |
| Master | the mix of all of the above | `audioNormalize` (−14 LUFS), `audioFadeInS/OutS` | — |

**Rule: Decide the sound design before cutting and state it: sync sound, narration, or music carries the story.** Everything else is muted or absent.

**Rule: B-roll under narration or music is muted.** The first real job through this harness put 21 unmuted factory clips under a music bed and a narrator; every clip's own narrator and music bled through. The default that suits a person dragging one clip in (keep its sound) is wrong for an agent assembling a montage — hence the tool's silent default. Say `muted:false` when you mean it.

**Rule: Keep a shot's sound only where the sound is the point** — a machine, a crowd, a laugh, a line delivered to camera — and only from a source that has no music or narration of its own (`transcribe` and `detect_silences` on the source tell you).

**Rule: Narration is an audio-only clip or the voiceover track, never an unmuted shot.** Cut it on word boundaries (`check_cuts` verifies), one narrator at a time, and keep it inside the picture's length.

**Rule: One music source.** An imported track is an *overlay* (no ducking) until `set_music` makes it the bed; then switch the overlay off. Set `musicVolume` around 0.25–0.35 under narration, give the cue a reason to end (`audioFadeOutS` 2–3 s or a trim that lands on picture).

**Rule: `check_soundtrack` before every draft.** It draws the audio map (which layers sound in every 2 s cell) and flags the clashes; `verify_export` measures the loudness after.

*Mechanical check:* `check_soundtrack` (unmuted shots whose source has speech under narration or the bed; overlapping narration; bed + overlay together; ducking off; no fade; silence). `[TOOL: check_soundtrack]`

### Levels: how loud the voice, how loud the music

Loudness is measured in LUFS (short-term = a 3 s window). The mix's *integrated* level is set by the platform (ch.29: web/social −14, broadcast −23, streaming −24…−27) and `audioNormalize` puts the whole mix there. What the platform does not set — and what the ear notices first — is the balance *inside* the mix.

**Rule: Speech is the anchor.** In a −14 LUFS program the narration windows sit at −14…−16 LUFS short-term. Nothing recurring is louder than the voice.

**Rule: Music alone sits 4–8 LU under the speech; under the speech it sits ≥ 12 LU below it** (≥ 8 LU in a music-driven piece where the music is a co-star; below 6 LU intelligibility suffers, and accessibility guidance asks for at least 4 LU of separation for any background sound). The bed "breathes" up between lines and drops under them: that drop is the ducking (`musicDucking`, ≈ 10 LU at these levels).

**Rule: Set the bed from measured numbers, not by ear alone.** `musicVolume` is a linear gain: `volume = 10^((voice_LUFS − gap − music_LUFS) / 20)`. Example from the first job: narration −21 LUFS, a hot music track at −9 LUFS with +2 dBTP peaks — 0.3 (−10.5 dB) left the music *above* the voice; a 6 LU gap needs −18 dB, i.e. 0.12. `balance_music` does this arithmetic and sets the value; `check_mix_levels` reads the rendered file back: speech windows, music-only stretches, the gap, and the estimated speech-to-music ratio under speech.

**Rule: Every voice sits with every other voice.** Narration clips, the TTS voiceover and unmuted sound bites (a sync-sound quote, a line of dialogue) are all "speech" to the listener and to `check_mix_levels`, which reads the spoken ranges of unmuted shots as speech windows. Archival bites arrive at any level (−12 to −23 LUFS in one job); level each clip with its `volume` (`update_segments {id, volume}`: 1 = as recorded, 2 ≈ +6 dB, 0.5 ≈ −6 dB, range 0–4) so every voice lands within ~3 LU of the narration *before* normalization lifts the whole program. The music bed ducks under all of them.

**Rule: True peak ≤ −1 dBTP; a source that already clips (+2 dBTP) is attenuated, never trusted.**

Reference points (approximate, practice-derived; verify against each platform's current spec): EBU R128 / ATSC A/85 for the program level; BBC guidance on background sound ≥ 4 LU under speech for accessibility; Netflix dialogue-anchored delivery (dialogue-gated −27 LKFS ±2); common mixing practice of 12–20 dB of music under narration in documentary and 8–12 dB in promos and trailers.

*Mechanical check:* `check_mix_levels` on a draft (speech vs music-only short-term loudness, gap, ratio under speech, true peak); `balance_music` to set `musicVolume` from the measured sources. `[TOOL: check_mix_levels / balance_music]`

## 8\. Verifying Your Work

- Frame grabs: `get_frame {assetId, t}` — on a source, a draft or a final. Look at both sides of a cut (t = out-point − 1 frame on the outgoing source, in-point on the incoming).
- Contact sheets: `get_contact_sheet` — timestamped grid; the fastest whole-clip look.
- Waveforms and loudness: `analyze_audio` (LUFS, true peak, LRA), `detect_silences`. No waveform image; the numbers are the readout.
- Scopes: *not available*; judge exposure and colour on `get_frame`.
- Timeline diffs: `compare_versions` (checkpoint → now, or checkpoint → checkpoint).
- Playback for a person: `render_draft` and tell them the path, or point them at the open editor.
- Automated checks: `check_soundtrack` (the audio map and its clashes), `check_mix_levels` (voice vs music on a draft), `check_cuts` (flash frames, mid-word cuts, kept dead air, lone jump cuts, overlays across cuts, transition use), `pacing_report`, `check_beat_alignment`, `verify_export` (duration to the frame, black and frozen picture, silence, loudness vs platform).

## 9\. Transactions, Undo, and Safe Batch Operations

- Undo stack: the desktop UI has one; the server has **checkpoints** (`create_checkpoint`, `list_checkpoints`, `restore_checkpoint`, newest 50 kept). A checkpoint captures settings, segments and overlays — not media, not renders.
- Transactions: `apply_edit_list` = checkpoint + ordered ops + rollback on failure + a change list.
- Dry runs: *not available* — but a checkpoint plus `compare_versions` after is the same information, and `restore_checkpoint` is the undo.
- Locks and shared sessions: there are none; the last write wins, and both sides see `project.changed`. Do not edit while `status` is `RENDERING` (the API refuses).
- Idempotency: `add_segment` is not idempotent (each call adds); check `get_project` before retrying a failed batch, or rely on the rollback.

## 10\. Prompting Patterns

- Describe an edit by **range, problem, constraint, success criterion**: "In the source from 12.0 to 14.5 s the pause drags; tighten the gaps between lines but keep the pause before her answer at 13.1; target 2 s shorter." Every element is checkable.
- Refer to clips by asset id, positions by seconds, segments by id (from `get_project`) or by their index in the main sequence.
- Say what must not change. Ask for a report: the change list (`compare_versions`) and the checks.
- Creative direction ("make it feel urgent") is a starting brief that the agent turns into mechanical instruction (shorter shots, cut inside movement, straight cuts) and shows you as a draft; mechanical instruction ("remove every silence longer than 0.5 s") is applied and verified.
- Common misunderstandings: source time vs timeline time; `durationS` is on-screen length, not the out-point; `muted` defaults to true for video clips; transitions are project-wide.

---

## 11\. Pre-production: the Interview, the Brief, the Plan

Every job before this section assumed the footage was already there. A new piece starts earlier: with a conversation that turns "make me a 30-second ad about X" into a brief the person has agreed to, and a plan they can read before a single clip is downloaded or generated. The tools: `set_brief` / `get_brief`, `set_plan` / `get_plan` / `check_plan` / `plan_document` / `approve_plan` / `plan_tasks`, and for sourcing `search_youtube`, `source_clips`, `add_ai_shot` / `generate_ai_shots`, `generate_narration`, `list_video_models`, `storyboard_sheet`. The procedure is the playbook `preproduction`; the prompts `interview` and `preproduction` carry it.

**The interview.** One round, at most eight questions, each with the default you inferred in brackets: (a) standalone piece or a scene of a longer video — and length, aspect; (b) scripted or unscripted, genre / form; (c) where the footage comes from (YouTube, AI, their files, stock) and any licence rule; (d) the premise; (e) tone and audience; (f) narration, music, on-screen text, must-include, avoid. A scene of a longer video changes the ending (no card, no fade, no sign-off) and the opening (it hands off from the previous scene). Store the answers with `set_brief`.

**The plan.** Logline → beats (contiguous, adding up to the length) → script (narration at ≤ 2 words/s, never over a sync-sound bite; the bites you expect to find; the cards) → storyboard (shots in order with duration, source, sound decision, card, transition; average shot length inside the genre norm, ch.16) → clip list (per YouTube source: what it must contain, search queries, preferred channels, the wanted moment; ≤ 180 s per import) → AI shot list (prompt, model, a length the model makes; public-figure blocks per `list_video_models`) → music brief and narration voice → risks. `set_plan` stores a version and returns the mechanical check: length against the brief, pacing, every source resolvable, narration density and overlaps, narration over sync sound, caps, AI cost, scene constraints. Fix the errors; `plan_document` renders the document; the person reads it; `approve_plan` records their yes.

**Fan-out.** `plan_tasks` turns the approved plan into a dependency graph: one source task per clip, one per AI shot, narration, music — all independent — then assemble, titles, checks, draft, final. Run the independent tasks at once: a *clip-scout* sub-agent per clip when the moment matters (search → import a window → contact sheet + transcript → exact in/out), `source_clips` when speed matters; `generate_ai_shots`; `generate_narration` per line; music. Sub-agents report; the lead assembles from one checkpoint, then the usual loop: titles, checks, draft, `storyboard_sheet` and the draft path to the person, final.

# Part III: Ingest and Organization

## 11\. Import, Transcoding, and Proxies

- `import_media` takes a local file path (video, image or audio); `import_youtube` a URL section. Media is copied into the project's asset folder. MKV/AVI/TS are accepted without a MIME type.
- Transcoding: none at import. Sources are decoded at render time; 10-bit HEVC and 4K sources use the GPU when that is faster.
- Proxies: *not available* as a separate pipeline. The **draft render** (≤640×360, seconds) is the proxy-quality preview for review; the desktop UI previews sources directly.
- Variable frame rate and mixed formats: everything is conformed to 30 fps at render. Audio is resampled to the export's rate.
- Audio extraction: `transcribe` and `analyze_audio` extract a mono 16 kHz WAV into the cache when needed.

## 12\. Metadata, Naming, and Search

- Naming: project titles are the only free-text field; use them as version names (`v3 2026-09-08 reveal earlier`).
- Automated analysis on demand: `transcribe`, `detect_scenes`, `detect_silences`, `analyze_audio`. Results are cached per asset (transcripts by model).
- Search: read the transcript and search it in your own context; `search_guide` searches this guide, not media.
- Keeping metadata useful for agents: put the reason for a choice in the checkpoint label and in your report.

## 13\. Sync, Multicam, and Grouping Clips

*Not available.* One picture track plus overlays; no multicam groups, no compound clips, no nesting. Sync between a clip's picture and its own audio is preserved by construction (`muted:false`); an uploaded master track (`UPLOAD_AUDIO`) starts at 0 and is padded or trimmed to the picture (`audioFitMode`).

## 14\. Backup, Versioning, and Project Portability

- Autosave: every edit is a server write; there is no unsaved state on the server side.
- Versions: checkpoints (labelled) and `compare_versions`. Duplicate a project to branch: *not available as one op* — create a project and rebuild from the checkpoint's data by `apply_edit_list` if needed.
- Portability: projects can live in a portable bundle folder (assets + final renders together); the SQLite database holds the rest. Back up the bundle and the database.
- Recovery: `restore_checkpoint`; missing media makes a segment un-renderable (the API says which).

---

# Part IV: The Craft of the Cut (Stated as Rules)

This part states editing craft as rules with rationale. Each rule is written so a human can learn it and an agent can apply it. Where a rule has a mechanical check, the check is named. Where a rule depends on judgment, the judgment is described so it can be argued about, not guessed at.

Tool mappings in `[TOOL: …]` name the MCP tool (see Part II and Appendix A) that runs the check; *not available* marks what SlopStudio cannot do yet.

---

## 15\. Shot Grammar and Continuity

Editing has a grammar. Viewers have absorbed it from a century of film and will notice, usually without being able to say why, when a cut breaks it. Learn the rules so you can break them on purpose.

### Shot sizes and when to change them

Shot sizes run from extreme wide, through wide, medium wide, medium, medium close, close-up, to extreme close-up. Each size carries a default meaning: wide shots show relationships and place, mediums show behavior, close-ups show thought and feeling.

**Rule: Every cut should change the shot size, the angle, or both — enough that the cut reads as a new view, not a stumble.** A cut between two nearly identical framings looks like a mistake (see the 30-degree rule below).

**Rule: Move closer as emotional intensity rises; move wider when new information about space or a new character is needed.** Cutting to a close-up says "this matters now." Spend close-ups accordingly.

**Rule: Don't jump more than two sizes without a reason.** Wide to extreme close-up is a shock. Sometimes shock is the point. Usually it isn't.

### The 180-degree rule and screen direction

Imagine a line drawn between two characters facing each other. Keep the camera on one side of that line and the characters keep their screen positions: A on the left looking right, B on the right looking left. Cross the line and they appear to swap sides.

**Rule: Do not cut across the line unless a shot on the line, a camera move, or a cutaway bridges the crossing.** A neutral shot (a character looking straight down the lens, or an insert with no direction) resets the line.

**Rule: Screen direction persists across cuts.** A car driving left-to-right in one shot should still drive left-to-right in the next, unless the audience is meant to understand it has turned back. Reversed direction reads as "returning."

*Mechanical check:* for dialogue coverage, tag each setup with the side of the line it was shot from. Flag any adjacent pair of clips with different sides and no neutral shot between them. `[TOOL: not available — no shot-side metadata. Compare the two setups with `get_contact_sheet` / `get_frame` and judge by eye, or ask the person]`

### The 30-degree rule

**Rule: Two consecutive shots of the same subject should differ in camera angle by at least 30 degrees, or in shot size by at least one full step, or both.** Anything less looks like the camera hiccupped. This is the origin of the jump cut's jarring quality.

Jump cuts are now a legitimate style, especially in interviews, vlogs, and montage. **Rule: Use jump cuts consistently or not at all within a sequence.** One accidental jump cut in a smoothly covered scene is an error; twenty deliberate ones are a rhythm.

### Matching action across cuts

**Rule: When cutting on action, the movement must continue at the same speed and from the same point in the next shot.** Cut a door opening at the moment the hand grips the handle in the wide, and pick it up at the same grip in the close-up. Overlapping by a frame or two is invisible; overlapping by six is a stutter; dropping frames is a skip.

**Rule: Cut on the movement, not before or after it.** A cut hidden inside motion is the most invisible cut there is. The eye is following the motion and doesn't register the frame change.

*Mechanical check:* compare motion vectors or the position of a tracked feature across the last frame of the outgoing shot and the first frame of the incoming one. Large discontinuities in position or velocity for the same subject indicate a mismatch. `[TOOL: `get_frame` at the outgoing shot's last frame (out-point − 0.033) and the incoming shot's in-point; compare by eye. No motion vectors]`

### Eyelines and spatial logic

**Rule: When a character looks off-screen, the next shot should show what they see, from a position consistent with their look.** If she looks down and left, the object should be below and to the left of her implied position. Eyeline mismatches make the geography wobble, and viewers lose their sense of where people are.

**Rule: Keep eyelines slightly off-lens in narrative; on-lens in direct address.** An interview subject looking at the lens is speaking to the audience. A character looking at the lens is breaking the fourth wall.

### Establishing shots and re-establishing

**Rule: Establish the space before cutting into it, unless withholding the space is the point.** A wide shot at the start of a scene tells the viewer where they are and who is present. Without it, every close-up is a question.

**Rule: Re-establish after significant movement, after a new character enters, or after a long run of close coverage.** Viewers drift. A wide shot resets them.

**Rule: Don't establish twice.** If the scene opened on the wide, you don't need it again until something changes.

### Continuity errors: what to hide and what to fix

Continuity errors — a glass fuller in the reverse, hair on the other side, a different tie — happen on every production.

**Rule: Hide the error before you fix it.** Most errors vanish if you cut around them: use a different take, trim the shot so the mismatch is off-screen, or cut on action so the eye is busy. Fixing in VFX is last resort.

**Rule: Performance beats continuity.** If the best take has a continuity error and the matching take is worse, use the best take and hide the error. Audiences forgive a moving glass; they don't forgive a flat line reading.

**Rule: Big, centered, stationary errors must be fixed. Small, peripheral, moving errors can stay.** Eye-tracking research is consistent: viewers look at faces and at motion. Errors outside that attention are rarely seen.

---

## 16\. Rhythm and Pacing

Pacing is the single most controllable quality in a cut, and the one most often gotten wrong. Fast is not the same as good. Rhythm is the pattern of shot durations and the pattern of what changes between them.

### What rhythm means in a cut

Rhythm has three components:

1. **Duration** — how long each shot holds.  
2. **Change** — how much each cut alters (size, angle, subject, location, sound).  
3. **Pattern** — how durations and changes repeat, vary, and build.

A sequence of 2-second shots is fast but can feel monotonous. A sequence alternating 1-second and 5-second shots has rhythm.

**Rule: Vary shot duration deliberately. Unintentional uniformity reads as mechanical.**

### Shot length as a controllable variable

Every shot has a natural length: long enough for the viewer to read what's in it, short enough that they don't start reading things you don't want them to.

**Rule: Hold a shot until the viewer has absorbed the information it carries, then cut.** A wide shot with lots of detail needs more time than a close-up of a single face. A shot the audience has seen before needs less time than a new one.

**Rule: The minimum readable duration for a new image is roughly 8–12 frames at 24 fps. Below that, the shot is felt rather than read.** Sub-8-frame shots are legitimate in action and montage, but each one is a decision, not a default.

**Rule: Shorten shots as the audience learns the space and the faces.** Coverage that needed three seconds at the start of a scene needs one second by the end.

### Cutting on motion, on stillness, and on the beat

There are three broad places to put a cut:

- **On motion** — inside a movement. Invisible, propulsive.  
- **On stillness** — after a movement completes, in the rest. Deliberate, contemplative.  
- **On the beat** — in time with music or a rhythmic sound. Musical, external.

**Rule: Match the cut style to the emotional register.** Motion cuts for energy and flow; stillness cuts for weight and thought; beat cuts for montage and spectacle.

**Rule: Don't cut on every beat when cutting to music.** Cutting on every downbeat becomes a metronome. Cut on the beat for two or three shots, then across it, then back.

### Building and releasing tension

Tension in editing comes from withholding the cut. The longer you hold, the more the audience wants the next shot.

**Rule: Lengthen shots to build tension; shorten them to release it or to accelerate into action.** A slow approach to a door, held in one long shot, then a burst of short shots when it opens.

**Rule: The opposite works too, and is less expected.** Rapid cutting can build anxiety; a sudden long hold can release it. Choose based on what the scene is doing, and use the less expected pattern when the scene needs surprise.

### Measuring pace: average shot length and its limits

Average shot length (ASL) is total duration divided by shot count. It's a blunt instrument but useful for comparison.

Reference points (approximate, feature films): classical Hollywood 8–11 seconds; contemporary drama 4–6; contemporary action 2–3; music video and social 1–2.

**Rule: Use ASL to compare versions of your own cut and to compare against genre norms, not as a target.** An ASL of 3 seconds could be a great action scene or a badly overcut drama.

**Rule: Look at the distribution, not just the mean.** Two sequences with the same ASL can feel completely different if one is uniform and the other alternates long and short.

*Mechanical check:* compute shot count, ASL, median, standard deviation, and a histogram of durations for any range. Compare across versions. `[TOOL: `pacing_report` (count, ASL, median, stdev, histogram, cut times; genre comparison)]`

### Pacing targets by genre and platform

Approximate, and every rule here has famous exceptions:

- **Drama:** hold on faces; let reactions land; cut on stillness.  
- **Comedy:** cut tight into the setup, hold for the reaction (see Chapter 35).  
- **Action:** short shots, but never so short that geography is lost.  
- **Documentary interview:** hold on the speaker; cut to B-roll on natural pauses.  
- **Commercial:** every shot earns its place; 15–30 seconds means no slack.  
- **Short-form social:** a change every 1–3 seconds; the first 2 seconds decide retention.

**Rule: Know the platform's norm, then decide whether to match it.** Matching feels native. Departing feels authored. Both are valid; only accidental departure is not.

### When to hold and when to cut early

**Rule: Hold when the shot is still giving.** A face changing, a movement completing, information arriving.

**Rule: Cut when the shot has finished giving, and cut a few frames before the viewer would have wanted to leave.** The best cuts arrive just before they're expected. Cuts that arrive after are the ones viewers feel as slow.

**Rule: If in doubt, cut it shorter and watch it back.** Most first cuts are 10–20% too long. Almost no first cuts are too short.

---

## 17\. Cutting Dialogue

Dialogue scenes are where most editing time goes and where editorial choice is least visible. The best dialogue cutting is invisible: viewers remember the performances, not the cuts.

### Finding the best take and the best line reading

**Rule: Choose takes by performance first, coverage second, technical quality third.** A slightly soft shot with the right reading beats a sharp shot with the wrong one.

**Rule: Build lines, not takes.** The best version of a speech is often the first line from take 3, the second from take 7, and the last from take 2\. Cut between them on the reverse angle or on a reaction so the seams don't show.

**Rule: Listen without watching, then watch without listening.** Audio-only reveals which reading is true. Video-only reveals which take has the best behavior between lines.

### Reaction shots and the listener

The most important shot in a dialogue scene is often the person who isn't talking.

**Rule: Cut to the listener when the listener's reaction is the story.** The line is the cause; the reaction is the effect. The effect is usually what the scene is about.

**Rule: Don't cut to the speaker just because they're speaking.** Following the ball is the beginner's pattern. Cut to who the audience needs to see.

**Rule: Give reactions time.** A reaction shot needs enough frames for the thought to visibly arrive. Cutting away as the face begins to change wastes the shot.

### J-cuts and L-cuts

A **J-cut** brings in the audio of the next shot before its picture. An **L-cut** lets the audio of the current shot continue under the next picture.

**Rule: Default to split edits in dialogue. Straight cuts where picture and sound change together feel mechanical.** Real listening involves looking at someone before they speak, or continuing to look after they stop.

**Rule: Lead with audio (J-cut) to pull the audience toward the next speaker; trail with audio (L-cut) to stay on the reaction.**

**Rule: Keep splits short — typically 4 to 24 frames — unless the scene calls for a long overlap.** Long overlaps become a stylistic device rather than a smoothing tool.

*Mechanical check:* for each dialogue cut, report the offset between the video cut point and the audio cut point. Flag runs of straight cuts. `[TOOL: not applicable — clip audio is locked to its segment, so every cut is a straight cut unless you build a split with an `audioOnly` clip (`add_segment audioOnly:true`, `offsetS` a few frames before/after the picture cut)]`

### Overlapping dialogue and interruptions

**Rule: Real conversation overlaps. Preserve overlaps when they're in the performance; build them when they aren't.** Two people who never interrupt each other sound like a table read.

**Rule: Interruptions need the interrupted line to be clearly cut off, not faded.** The abruptness is the point.

**Rule: When building an overlap from separate takes, check that room tone and mic perspective match, or the seam will be heard.**

### Subtext: cutting for what isn't said

**Rule: Cut for the thought under the line, not the line.** If a character says "I'm fine" and isn't, the cut should be on the face that shows they aren't — before the line, after it, or on someone else who knows.

**Rule: Silence is dialogue.** A held pause where a character doesn't answer can say more than any line. Don't fill it.

### Removing ums, pauses, and stumbles

In interviews, testimonials, and some naturalistic drama, cleaning speech is routine.

**Rule: Remove fillers and stumbles only when the picture can hide the cut.** Options: cut to B-roll, cut to a listener, use a different angle, or use a jump cut if the style permits.

**Rule: Don't over-clean.** A person who never pauses or hesitates sounds scripted, which undermines the authenticity that was the point.

**Rule: Keep breaths.** Removing every breath makes speech sound inhuman. Trim them; don't delete them.

*Mechanical check:* transcript-based detection of filler words and pauses over a threshold; report candidates with timecodes. Do not auto-remove; propose. `[TOOL: `transcribe` (word timings) + `detect_silences` on the source; `check_cuts` reports kept dead air and mid-word cuts. Propose; never auto-remove]`

### Pacing conversation without flattening it

**Rule: Tighten the gaps between lines before tightening the lines themselves.** Most slack in dialogue scenes is in the pauses, not the words.

**Rule: Keep the pauses that mean something.** A pause before an answer is information. A pause because the actor lost the line is not.

**Rule: Vary the tempo within a scene.** A conversation that's uniformly fast or uniformly slow is monotonous. Let it speed up as it heats and slow down as it lands.

---

## 18\. Cutting Action

Action editing has one job above all others: the audience must always know what is happening, where, and to whom. Speed comes second.

### Geography: where everyone is and where they're going

**Rule: Establish the space and the players before the action starts.** If the audience doesn't know the room, they can't follow the fight.

**Rule: Maintain screen direction for pursuit.** The chaser moves left to right; the chased moves left to right. If they move toward each other, they're converging. If direction flips without a bridging shot, the audience is lost.

**Rule: Re-establish whenever the geography changes.** A new room, a new vehicle, a new opponent — one wide shot resets everything.

### Motion matching and direction across cuts

**Rule: Match motion direction and speed across cuts.** A punch thrown right-to-left in the wide should land right-to-left in the close-up.

**Rule: Cut in the middle of movement, not at the start or end.** The peak of motion is the most invisible cut point.

**Rule: A motion in one shot can be continued by a different motion in the next, if the direction and energy match.** A car swerving left cuts to a camera pan left. This is the basis of "invisible" action cutting.

### Clarity over speed

**Rule: If the audience can't tell what happened, the cut is too fast, no matter how exciting it feels in the edit.** Watch with fresh eyes, or have someone else watch, and ask them what happened.

**Rule: Every shot in an action sequence must contain one clearly readable piece of information.** A shot that is only blur and noise contributes energy but no story. Use sparingly.

**Rule: Slow down at the moments that matter.** The hit that ends the fight, the near miss, the decision — give these more frames than the surrounding chaos.

### Impact frames and hit points

**Rule: Land the cut on the impact, or one to two frames after.** Cutting before the impact denies the payoff; cutting long after it goes slack.

**Rule: An impact can be shown once, or implied by cutting around it, but not both.** Showing the punch land and then cutting to a reaction shot that also shows it land is a double.

**Rule: Sound sells impact more than picture.** A hit with a strong sound effect and a fast cut reads as harder than a hit shown fully with weak sound.

### Coverage strategies for chaotic footage

Action is often shot with multiple cameras, handheld, with imperfect coverage.

**Rule: Find the spine first.** Identify the three to five beats the sequence must communicate. Build those from the clearest shots. Fill between them.

**Rule: Use the wide as the map.** Even if the wide is never used at length, refer to it to keep the geography straight.

**Rule: Cutaways and inserts cover gaps.** A hand on a weapon, a face reacting, feet on ground — these bridge missing coverage without lying about the space.

### Sound as the glue for action

**Rule: Continuous sound holds discontinuous picture together.** A sustained engine, a crowd, a score cue — as long as the sound carries across cuts, the audience accepts wide spatial jumps.

**Rule: Build the sound bed early, even with temp effects.** Action cut without sound is impossible to judge for pace.

**Rule: Silence in action is a weapon. Use it once per sequence at most.** Dropping all sound for a moment of shock is powerful and wears out instantly.

---

## 19\. Montage, Ellipsis, and Time Compression

Editing's unique power is control of time. A montage compresses; an ellipsis omits; both ask the audience to fill in what they didn't see.

### Types of montage

- **Temporal montage** — a sequence of shots implying time passing (training, a journey, a season).  
- **Intellectual montage** — juxtaposing images to produce an idea not in either shot (see Chapter 21).  
- **Rhythmic montage** — shots cut to a musical or rhythmic pattern for energy.  
- **Parallel montage** — intercutting two or more lines of action.

**Rule: Know which kind you're building.** They have different rules for shot selection and duration.

### Compressing hours, days, and years

**Rule: Each shot in a temporal montage should mark a distinct step.** Ten shots of the same activity from different angles is not progress. Ten shots of the activity getting harder, then easier, is.

**Rule: Change something visible between shots to signal time: light, weather, costume, location, hair, a prop.** Without a visible change, the audience reads the shots as continuous.

**Rule: Compress unevenly.** Real time doesn't pass at a steady rate in memory. Linger on the moment that matters; skip through the routine.

### Elision: what to leave out

**Rule: Cut every scene as late as possible and leave it as early as possible.** Enter after the greeting; leave before the goodbye. The audience fills in the rest and the scene is faster for it.

**Rule: If a scene exists only to get a character from A to B, cut it and let the next scene begin at B.** Audiences accept large gaps without explanation.

**Rule: Leave out what the audience can infer; keep what they can't.** The test: would a viewer be confused, or merely unsurprised, if this were gone?

### Parallel action and intercutting

**Rule: Intercut when two lines of action are connected by cause, by theme, or by clock.** A bomb in one place and the hero in another; two characters making opposite decisions; a wedding and a funeral.

**Rule: Alternate at increasing frequency to build toward convergence.** Longer sections early; shorter and shorter as the two lines approach the moment they meet.

**Rule: Each return to a line of action should advance it.** If nothing has changed since we left, the cutback is wasted.

### Music-driven montage

**Rule: Choose the music before cutting the montage, or accept that you'll recut when the music changes.** Montage pace is inseparable from its music.

**Rule: Cut on structure, not just beats.** Phrase changes, verse-to-chorus, drops, and rests are the strong cut points. Downbeats are the weak ones.

**Rule: Let the music end, or cut it, on picture.** Music that trails off into the next scene because no one decided where it ends feels unfinished.

### Avoiding the generic montage

**Rule: Every shot needs a specific reason to be in the montage.** "It looks nice" is not a reason. "It shows the third failure" is.

**Rule: Break the pattern at least once.** A montage of quick shots with one long held shot in the middle has shape. A uniform stream does not.

**Rule: Give the montage a turn.** Something should be different at the end than at the start — a skill learned, a relationship changed, a decision made. A montage without a turn is decoration.

---

## 20\. Transitions

The straight cut is invisible, fast, and honest. Every other transition is a visible authorial gesture and should be justified.

### The straight cut as the default

**Rule: Use a straight cut unless you can name the reason for something else.** "It was in the effects menu" is not a reason.

**Rule: The cut carries meaning by itself.** A hard cut from a quiet room to a loud street is a transition. It doesn't need help.

### Dissolves: duration and meaning

A dissolve overlaps outgoing and incoming shots. It signals a softer connection than a cut: time passing, memory, dream, or a gentle change of place.

**Rule: Dissolve duration sets its meaning. 6–12 frames is a softened cut; 1–2 seconds is a time passage; 3+ seconds is a statement.**

**Rule: A dissolve between two shots of the same subject creates a ghost image. Avoid unless the ghost is intended.**

**Rule: Dissolves in montage should be consistent in length.** Mixed dissolve lengths in a sequence read as sloppy.

**Rule: In contemporary narrative, dissolves are rare. Their rarity is what gives them weight.** Use them as punctuation, not as connective tissue.

### Fades and blacks

**Rule: Fade to black means an ending: a scene, an act, a chapter.** It's the heaviest transition and should be used at most a few times in a feature.

**Rule: Fade from black means a beginning, and gives the audience time to arrive.** Hold the black long enough to register — typically 12–24 frames minimum.

**Rule: A hard cut to black is a shock; a fade to black is a rest.** Choose deliberately.

**Rule: Match the audio to the picture transition.** A fade to black with sound continuing under it is a different effect than picture and sound fading together. Both are valid; both must be chosen.

### Wipes, whips, and stylized transitions

Wipes, whip pans, light leaks, zoom transitions, and other stylized moves are genre markers.

**Rule: Stylized transitions belong to a style. Establish the style in the first minute or don't use them.** One whip-pan transition in an otherwise classically cut film is an error.

**Rule: Stylized transitions cost attention.** Each one pulls the viewer out of the story for a moment. Spend that only when there's nothing to pull them out of.

**Rule: Hide a stylized transition inside motion where possible.** A whip pan that starts on a real camera move is better than one added in post to a static shot.

### Match cuts and graphic matches

A match cut links two shots by shape, motion, color, or composition: a spinning wheel to a spinning record, a hand reaching to a hand reaching.

**Rule: A match cut must be exact enough to read instantly, or it's just a cut.** Position, scale, and motion should align within a small tolerance.

**Rule: Match cuts are for meaning, not decoration.** The two matched things should be connected by the story.

**Rule: Once per film, maybe twice.** Match cuts are memorable precisely because they're rare.

### Rules for when a transition is justified

Use a non-straight transition when at least one of these is true:

1. Significant time passes and the audience needs to be told.  
2. The story shifts register (waking to dreaming, present to memory).  
3. The film's established style uses it consistently.  
4. A cut would be too abrupt for the emotional moment (rare; usually the cut is fine).  
5. A structural boundary needs marking (act break, chapter).

If none applies, cut.

---

## 21\. The Kuleshov Effect and Meaning Between Shots

Editing creates meaning that isn't in any single shot. This is the foundational insight of the craft and the thing that separates editing from assembly.

### What the Kuleshov effect demonstrates

In the 1910s–20s, Lev Kuleshov reportedly cut the same neutral shot of an actor's face against different images — a bowl of soup, a child in a coffin, a woman. Audiences saw hunger, grief, and desire in the identical face.

The lesson: **viewers read a shot in the context of the shots around it.** A face is not sad. A face followed by a coffin is sad.

### Juxtaposition as authorship

**Rule: Every cut is a claim about the relationship between two shots.** You can't make a neutral cut. Placing A next to B says "A and B are connected." The audience will find the connection whether or not you intended one.

**Rule: The editor writes with juxtaposition.** A character looks off-screen; what you cut to next tells the audience what they're thinking. This is as much authorship as the script.

### Implying cause, thought, and emotion

- **Cause:** Shot of a hand on a switch, then shot of lights going out. The audience infers the hand caused it, even if the shots were filmed in different buildings.  
- **Thought:** Shot of a face, then a shot of an object or memory. The audience infers the person is thinking of it.  
- **Emotion:** Shot of a neutral face after a shot of something emotional. The audience projects the emotion onto the face.

**Rule: Use these deliberately.** A neutral reaction shot placed after the right image is often stronger than a performed reaction.

**Rule: The implied connection is strongest when the second shot is what the character could plausibly be seeing or thinking.** Implausible connections become intellectual montage — deliberate, but colder.

### Using it deliberately and avoiding accidental meaning

**Rule: Audit every cut for unintended implication.** A character says "I trust him" and you cut to a shot of someone else looking uneasy. You've just told the audience not to trust him. Was that the intent?

**Rule: Adjacent shots of two characters imply a relationship between them.** Be careful what you put next to whom.

**Rule: Cutaways are never neutral.** An insert of a clock says "time is running out." An insert of a photograph says "this matters." Choose inserts for what they imply.

**Rule: In documentary, the Kuleshov effect is an ethical issue.** Cutting an interviewee's neutral pause after a provocative question implies discomfort that may not have existed. Chapter 34 covers this further.

### Testing juxtapositions quickly

Because the effect is fast and reliable, alternatives can be tested cheaply.

**Rule: When a reaction feels wrong, try changing the shot before it rather than the reaction itself.** Often the reaction is fine and the setup is what's off.

**Rule: Build two or three versions of a key juxtaposition and watch them cold.** The difference is usually obvious on viewing and invisible in thought.

*Workflow:* duplicate a range, swap the shot preceding the reaction, render both, compare. `[TOOL: `create_checkpoint` → edit → `render_draft`; `restore_checkpoint` → the other version → `render_draft`; compare with `get_contact_sheet` on both drafts; `compare_versions` for the change list]`

---

# 22\. Case Studies: Five Editing Styles and How to Emulate Them

Five directors and editors whose work since the 1950s defines a distinct, learnable approach to the cut. For each: what the style is, what it's built from, and a set of rules for reproducing it. Emulation is a training exercise, not a destination — learn the rules well enough to know which one you're breaking.

---

## 1\. Dede Allen — Cutting for Character Energy

**Key films:** *Bonnie and Clyde* (1967), *Dog Day Afternoon* (1975), *Reds* (1981), *The Breakfast Club* (1985).

### The style

Allen brought the energy of European New Wave cutting into American studio filmmaking and made it feel emotional rather than intellectual. Her cuts are driven by what a character is feeling, not by continuity or coverage logic. She was one of the first American editors to use audio-led transitions systematically: sound from the next scene arrives before its picture, pulling the audience forward.

Her scenes often start abruptly, mid-action, with no establishing shot, and end before they resolve. The audience is kept slightly off-balance and leans in.

### What it's built from

- **Sound-first scene transitions.** The J-cut, used structurally rather than as smoothing.  
- **Shock cuts.** Hard cuts between wildly different energies — a quiet moment to a gunshot, a laugh to violence.  
- **Jump cuts inside performance.** Trimming within a take to compress a character's behavior without hiding it.  
- **Late entrances, early exits.** Scenes trimmed to their emotional core.  
- **Character over geography.** She would sacrifice spatial clarity to stay on the face that mattered.

### How to emulate it

**Rule: Start every scene one beat later than feels comfortable.** Cut the establishing shot and enter on a face or an action already in progress.

**Rule: Bring in the next scene's sound 12–36 frames before its picture, especially across big tonal shifts.** Use it to create anticipation, not just smoothness.

**Rule: When a performance has energy, cut within it.** Jump-cut a take to keep only the moments where the actor is alive. Don't hide the jump; let it register as urgency.

**Rule: Prioritize the face that carries the emotion, even if it means the audience briefly loses the room.** Re-establish only when confusion would cost more than the momentum.

**Rule: End scenes on the strongest beat, not the natural end of the action.** If the line that matters is in the middle of the scene, cut the rest.

*Exercise:* take a conventionally covered dialogue scene. Remove the establishing shot. Trim every shot so it starts mid-motion. Bring the next scene's sound in early. Compare runtime and energy against the original.

---

## 2\. Walter Murch — The Blink, the Sound, and the Rule of Six

**Key films:** *The Conversation* (1974), *Apocalypse Now* (1979), *The English Patient* (1996), *Cold Mountain* (2003).

### The style

Murch treats the cut as a perceptual event modeled on the human blink: we blink at the moments where a thought ends, and a cut should land at the same place. His editing is calm, precise, and psychologically motivated. He's equally a sound designer, and his cuts are conceived with picture and sound as one system: often the sound decides where the picture cuts.

He formalized his priorities as the "Rule of Six" — a ranked list of what a cut should serve, with emotion at the top and 3D spatial continuity at the bottom. Emotion is worth roughly half the decision; story roughly a quarter; rhythm most of the remainder; eye-trace, 2D screen plane, and 3D space share what's left.

### What it's built from

- **Emotion first, continuity last.** A cut that's emotionally right but spatially wrong is preferred to the reverse.  
- **Eye-trace.** Where the viewer's eye is on the last frame of the outgoing shot determines where the important element should be on the first frame of the incoming one.  
- **Cut at the end of a thought.** Not at the end of a line or a motion, but where the character's (or viewer's) internal thought completes.  
- **Sound as structure.** Long, layered sound design that carries across cuts and defines the emotional temperature of a scene.  
- **Restraint.** Fewer cuts than most editors; each held slightly longer than expected.

### How to emulate it

**Rule: Before placing a cut, ask in order: does it serve the emotion, the story, the rhythm, the eye-trace, the screen plane, the space? If it fails on emotion, don't make it, regardless of the rest.**

**Rule: Track the viewer's eye.** Note where attention is at the tail of the outgoing shot. Place the incoming shot's subject there, or deliberately pull the eye elsewhere if disorientation is the goal.

**Rule: Cut where the thought ends.** Watch a performance and note where you naturally blink. Try cutting there. Then try ±3 frames and see if it gets better or worse.

**Rule: Build the sound bed before finalizing picture cuts.** Let a sustained sound decide the rhythm; cut the picture to the sound rather than the reverse.

**Rule: Hold every shot 10% longer than instinct says, then decide.** Murch's cuts often feel slower than expected on first viewing and correct on second.

*Mechanical check:* for a dialogue scene, compute the position of the dominant face or subject at the last frame of each outgoing shot and the first frame of each incoming shot. Flag cuts where the distance is large and no motion motivates it. `[TOOL: `get_frame` on both sides of the cut; no subject tracking — judge eye-trace by eye]`

---

## 3\. Thelma Schoonmaker & Martin Scorsese — Kinetic, Musical, Confrontational

**Key films:** *Raging Bull* (1980), *Goodfellas* (1990), *Casino* (1995), *The Departed* (2006), *The Wolf of Wall Street* (2013).

### The style

Scorsese and Schoonmaker's collaboration is the definitive example of editing as energy. Popular music drives structure; freeze frames, whip pans, speed changes, and voiceover are used freely; the cutting speeds up and slows down with the characters' adrenaline. The style is confrontational — it wants you to feel the cut — and simultaneously precise. Underneath the flash is rigorous attention to performance and rhythm.

The other half of the style is the long take: the Copacabana Steadicam shot in *Goodfellas* is famous because the film around it is cut so fast. The contrast is the point.

### What it's built from

- **Music as spine.** Needle drops chosen early; scenes cut to their structure, often with the song's energy dictating shot length.  
- **Freeze frames and voiceover as narration devices.** Stopping time to comment on it.  
- **Speed ramps and micro-slow-motion.** A few frames of slow motion on a look or a gesture.  
- **Long take vs. rapid cut contrast.** Using both extremes so each amplifies the other.  
- **Cutting on violence for shock, then holding on the aftermath.**  
- **Dialogue overlap and improvisation preserved.** Scenes cut to keep the mess of real talk.

### How to emulate it

**Rule: Pick the music first and cut the scene to its structure, not just its beat.** Use verse/chorus changes, drops, and stops as scene turns.

**Rule: Alternate extremes.** Follow a sequence of very short shots with a single very long one. Neither works as well alone.

**Rule: Use a freeze frame to mark a moment the narrator wants you to remember. Never more than a handful per film.**

**Rule: Ramp to slow motion for 8–20 frames on a glance, a hand, a reveal — then snap back to speed.** The brevity is what keeps it from becoming a music video.

**Rule: On violence, cut fast into it and hold long on what's left.** The aftermath is where the meaning lives.

**Rule: Keep overlapping dialogue and half-finished lines.** The scene should sound like people, not a script.

*Exercise:* cut the same scene twice — once to a fast song, once to a slow one — using the song's structure to place your cuts. Notice how the scene's meaning shifts.

---

## 4\. Andrei Tarkovsky — Time Pressure and the Long Take

**Key films:** *Andrei Rublev* (1966), *Solaris* (1972), *Mirror* (1975), *Stalker* (1979), *The Sacrifice* (1986).

### The style

Tarkovsky is the counterexample to everything else in this chapter. He argued that editing's job is not to assemble meaning from fragments but to preserve the pressure of time inside each shot. Shots run for minutes. The camera drifts. Cuts come rarely and, when they do, feel like a door closing.

The style is not slow for its own sake. Each long shot has an internal rhythm — water moving, wind in grass, a person crossing a room — and the cut comes only when that rhythm has fully played out. Editing becomes a matter of matching the time-pressure of adjacent shots so the join is not felt as a break.

### What it's built from

- **Long takes with internal movement.** The shot changes within itself; the cut is unnecessary.  
- **Cuts placed where the time-rhythm of one shot matches the next.** A slow shot cut to a slow shot; a break only when the film wants a break.  
- **Sound design as texture.** Dripping water, distant trains, wind — continuous, non-musical sound that carries across the rare cuts.  
- **Withholding.** No reaction shots, no coverage in the conventional sense. The audience watches, waits, and projects.  
- **Dreams and memory cut without signal.** Time shifts are not marked by dissolves or effects; the audience notices later.

### How to emulate it

**Rule: Do not cut while a shot is still changing.** If something in the frame is still moving, developing, or arriving, hold.

**Rule: Match the tempo of adjacent shots.** Cut a slow shot to a slow shot. When you must change tempo, do it at a structural boundary, not mid-scene.

**Rule: Remove reaction shots.** Play scenes in one or two setups. Let the audience decide who to watch.

**Rule: Build a continuous ambient sound bed and never break it at a picture cut.** The sound should suggest that the world continued while the camera wasn't looking.

**Rule: Cut time shifts as if they were continuous.** No dissolve, no signal. Trust the audience to catch up.

**Rule: Aim for an ASL of 30 seconds or more, and accept that the first viewing will feel slow.** The style asks the viewer to change their attention, not the film to change its pace.

*Exercise:* take a scene you've already cut conventionally. Recut it using only the two longest takes available, with no cutaways. Watch it three times. Note what you start to see on the third viewing that you didn't on the first.

---

## 5\. Edgar Wright — Comic Rhythm and the Visual Punchline

**Key films:** *Shaun of the Dead* (2004), *Hot Fuzz* (2007), *Scott Pilgrim vs. the World* (2010), *Baby Driver* (2017). Editors: Chris Dickens, Paul Machliss.

### The style

Wright treats editing as a comedic instrument. Cuts land like drumbeats; mundane actions (making tea, packing a bag) are cut as rapid, over-emphatic montages with heavy sound design; transitions are whip pans, crash zooms, and hard cuts timed to the music. Every cut is a joke or a setup for one. In *Baby Driver*, the entire film is cut to its soundtrack, with gunshots, footsteps, and dialogue landing on beats.

The precision is the point: the style only works if the timing is exact to the frame. A cut that's two frames late kills the joke.

### What it's built from

- **Micro-montage of the mundane.** Six shots in two seconds for someone getting dressed. The over-emphasis is the joke.  
- **Sound effects as punctuation.** Every cut has a hit, a whoosh, or a click.  
- **Whip pans and crash zooms as transitions.** Rarely a straight cut between scenes.  
- **Cutting to the beat, literally.** Actions and cuts synchronized to the soundtrack.  
- **Visual echoes and callbacks.** A shot from early in the film reprised, cut identically, for a payoff.  
- **Rhythm-based comedy.** The joke is in the pace of the cuts, not just the content.

### How to emulate it

**Rule: Find the beat grid of the music and place every cut on a beat, a half-beat, or a musical event.** Off-grid cuts are allowed only for deliberate contrast.

**Rule: For a mundane action, cut it as if it were an action sequence: 4–8 shots, each 6–12 frames, each with a sound effect on the cut.**

**Rule: Every scene transition gets a device — whip pan, crash zoom, match cut, sound bridge. The device is chosen for the joke it makes, not for smoothness.**

**Rule: Repeat a shot pattern later in the film, cut identically, so the audience recognizes it. Then change one element.** That's the callback.

**Rule: Timing to the frame.** Test each comedic cut at ±1 and ±2 frames. One of them is right and the others aren't.

**Rule: Sound effects on every cut in a rhythmic sequence, and nowhere else.** The contrast keeps the device fresh.

*Mechanical check:* extract the beat grid of a music cue; report the offset in frames of every cut in the range from the nearest beat. Flag cuts more than 2 frames off-grid. `[TOOL: `check_beat_alignment` (beat grid from `analyze_audio` tempo; every cut's frame offset from the nearest beat, bar and phrase; 2-frame tolerance)]`

---

## Choosing a Style, or Not

These five describe a spectrum: from Tarkovsky's almost-no-cuts to Wright's cut-on-every-beat, with Murch's perceptual precision, Allen's emotional urgency, and Schoonmaker's musical energy between them.

**Rule: Know where a project sits on this spectrum before cutting it.** A drama cut like Wright, or a comedy cut like Tarkovsky, will fail — unless the mismatch is the joke.

**Rule: Learn each style by imitating it on the same footage.** Cut one scene five ways. The differences teach more than any description.

**Rule: Never mix styles by accident.** A Murch-paced scene followed by a Wright-paced one is a choice when it's deliberate and a mess when it isn't.

---

# Part V: Structure and Iteration

Part IV was about the cut. Part V is about the film: how a pile of footage becomes a first assembly, how that assembly becomes a finished cut, and how notes, review, and versions drive the process. This is where most of an edit's time actually goes.

---

## 23\. From Transcript or Logs to Assembly Cut

The assembly cut is the first version in which every scene exists in order. It is expected to be long, loose, and rough. Its job is to reveal what you have, not to be good.

### Reading and marking the transcript

For any project with speech — interviews, scripted dialogue, narration — the transcript is the fastest map of the footage.

**Rule: Read the entire transcript before cutting anything.** You cannot find the best line if you don't know all the lines.

**Rule: Mark in three tiers: must-use, maybe, and never.** Use consistent labels so they survive into the edit as markers or ratings. Don't refine beyond three tiers on the first pass.

**Rule: Note *why* a passage is marked.** "Great" is not a note. "Only place she admits she was wrong" is.

**Rule: Mark non-verbal moments too.** A pause, a laugh, a look away — transcripts omit them; you shouldn't.

*Workflow:* transcript search returns timecoded passages; marking creates markers or ratings on the source clip. `[TOOL: `transcribe`; there are no markers — keep the selects as a written list (source ranges + reason) and as the ops of an `apply_edit_list`]`

### Paper edits and selects reels

A **paper edit** is the film written as a sequence of transcript excerpts and shot descriptions before anything is cut. A **selects reel** is a timeline containing only the marked passages, in source order.

**Rule: Build a selects reel before an assembly.** It's cheaper to reorder a selects reel than to recut an assembly, and it forces a complete pass over the footage.

**Rule: Keep selects generous.** Include handles and full sentences. Trimming is for later.

**Rule: Paper-edit when the structure is uncertain; skip it when the script or outline already defines order.**

### Building a stringout

A **stringout** is all the usable footage for a scene or topic laid end to end, roughly in the order it will be used.

**Rule: Stringout by scene for narrative, by topic for documentary.**

**Rule: Include every plausible take or passage. Cut nothing yet.** The stringout is for seeing, not for deciding.

**Rule: Name stringouts consistently and keep them.** They are the reference you'll return to when a note says "is there a better take?"

### Radio cuts for interview-driven work

A **radio cut** is an audio-only edit: the story told entirely in the interviewees' words, with no picture decisions made.

**Rule: For interview-driven films, cut the radio edit first and listen to it without picture.** If the story doesn't work as audio, no amount of B-roll will save it.

**Rule: Target the radio cut at 120–150% of final length.** Long enough to preserve options; short enough to have a shape.

**Rule: Lock the radio cut's structure before covering it with picture.** Changing structure after B-roll is laid is expensive.

### Ordering scenes from the script or outline

**Rule: Assemble in script order first, even if you suspect the order will change.** The script is a hypothesis; test it before revising it.

**Rule: Include every scripted scene in the assembly, including the ones you think should go.** Cutting them later, having seen them, is a decision. Never assembling them is a guess.

**Rule: Put scene cards or slugs in the timeline where scenes are missing.** The assembly should show the whole shape, gaps included.

### Letting an agent build the first assembly

The assembly is mechanical enough that an agent can build a credible first pass from a script, transcript, or marked selects.

**Rule: Give the agent the structure, the selects, and the constraints. Don't ask it to find the story.** "Assemble scenes 1–40 in script order, using the circled takes, with 2-second handles" is a good instruction. "Cut the movie" is not.

**Rule: Ask for the assembly at full length. Do not ask the agent to tighten yet.** Tightening requires judgment you haven't given it.

**Rule: Review the agent's assembly for mechanical errors first — wrong takes, missing scenes, sync — before evaluating it creatively.**

**Rule: Have the agent report what it couldn't do.** Missing coverage, unmarked scenes, and ambiguous selects should surface as a list, not be silently resolved.

---

## 24\. Rough Cut, Fine Cut, and Picture Lock

Cuts progress through stages. Each stage has a purpose, and doing a later stage's work in an earlier stage is the most common way edits go wrong.

### What each stage is for

- **Assembly** — everything, in order. Purpose: see what you have.  
- **Rough cut** — the film's shape. Scenes trimmed, order tested, obvious dead weight removed. Purpose: find the structure.  
- **Fine cut** — the film's rhythm. Every cut placed with intention; scenes at final length or near it. Purpose: make it good.  
- **Picture lock** — no more picture changes. Purpose: let sound, color, and VFX proceed.

**Rule: Don't polish in the rough cut.** Frame-level trimming on a scene that might be cut is wasted work.

**Rule: Don't restructure in the fine cut.** If the structure is still moving, you aren't in the fine cut yet.

### Trimming for shape before trimming for polish

**Rule: In the rough cut, ask of every scene: does the film work without it?** If yes, remove it — to a "removed scenes" timeline, not to oblivion.

**Rule: Trim scene heads and tails before trimming inside scenes.** Late entrances and early exits (Chapter 19\) remove more time, faster, than anything else.

**Rule: Trim the worst 10% first.** The scenes that drag most are obvious; fix them before fine-tuning the ones that already work.

**Rule: Keep a running list of structural questions separate from the cut.** "Should the reveal come before the wedding?" is a question to answer with a version, not a note to remember.

### Tracking runtime and pacing across versions

**Rule: Record runtime at every version.** A cut that goes from 140 minutes to 118 to 104 to 101 is telling you something about where the remaining slack is.

**Rule: Record per-scene runtime, not just total.** A scene that hasn't changed length in four versions while everything around it shrinks is probably too long.

**Rule: Compare pacing statistics across versions, not just runtime.** Shot count, ASL, and duration distribution per scene (Chapter 16\) show whether tightening came from cutting scenes or from cutting inside them.

*Mechanical check:* per-version report of total runtime, per-scene runtime, and per-scene shot statistics; diff against the previous version. `[TOOL: `compare_versions` (checkpoint → now or checkpoint → checkpoint) + `pacing_report`]`

### Locking picture and what changes after lock

**Rule: Picture lock means the timing of every cut is final.** Sound, color, titles, and VFX can change; frame counts cannot.

**Rule: Lock only when every department that depends on lock has signed off.** A lock that gets broken costs more than a delayed lock.

**Rule: Before lock, run every mechanical check once more.** Gaps, flash frames, sync, missing media, offline clips. `[TOOL: `check_cuts` + `verify_export` on a `render_draft`]`

**Rule: Export a reference (picture with burned-in timecode) at lock and distribute it.** Every downstream department works from that reference.

### Handling late changes safely

Changes after lock happen. The goal is to make them cheap and traceable.

**Rule: Every post-lock change produces a change list.** Which frames were added, removed, or moved, relative to the locked reference. `[TOOL: `compare_versions`]`

**Rule: Prefer changes that don't shift downstream timecode.** Replacing a shot with one of identical length is cheap. Adding six frames in reel 2 moves everything after it.

**Rule: Re-lock with a new version number and a new reference export.** Never let two things both be called "locked."

---

## 25\. Giving and Receiving Notes

Notes are how a cut gets better. Bad notes waste time; bad responses to good notes waste the note. This chapter applies whether the notes pass between people, from a person to an agent, or from an agent to a person.

### Notes that describe problems vs. notes that prescribe fixes

**Rule: The best notes describe the experience, not the solution.** "I lost track of who was in the room" is actionable. "Add a wide shot at 01:14:22" might be the right fix or might not, and it hides the actual problem.

**Rule: When you receive a prescriptive note, find the underlying problem before applying the fix.** Ask what the note-giver felt, then decide how to address it.

**Rule: When giving a note to someone with less context, be more prescriptive; with more context, be more descriptive.** The director needs to hear the experience. A junior assistant or an agent may need the instruction.

### Timecoded notes and markers

**Rule: Every note refers to a timecode, a range, or a named scene.** "The middle drags" is not a note. "01:02:10–01:05:40 drags" is.

**Rule: Attach notes to the timeline as markers, with the note text in the marker.** Notes that live only in email are lost.

**Rule: Use a consistent marker color or tag for note status: open, addressed, rejected.** `[TOOL: not available — no markers. Track notes as checkpoint labels and in the conversation]`

### Prioritizing and batching notes

**Rule: Sort notes into structure, scene, and polish before acting on any.** Structural notes first; polish notes only once structure is settled, since polish work on a moving structure is wasted.

**Rule: Batch notes by scene and address each scene once.** Bouncing between scenes to address notes in received order is slower and produces inconsistent results.

**Rule: When notes conflict, surface the conflict rather than picking silently.** Two people asking for opposite things is a decision for whoever owns the cut.

### Writing notes an agent can act on

An agent has less context than a human collaborator and no ability to ask a clarifying question mid-edit unless the harness supports it. Notes to an agent need to be more complete.

**Rule: Specify range, problem, constraint, and success criterion.** "In 00:12:00–00:14:30, the conversation feels slow. Tighten the gaps between lines but keep the pause before her answer at 00:13:12. Target 20 seconds shorter." Every element is checkable.

**Rule: Say what must not change.** Agents tighten indiscriminately unless told what's precious.

**Rule: Ask for a report, not just a result.** "List every cut you changed and by how many frames." The report is how you verify the note was addressed and nothing else was touched.

**Rule: Prefer several small notes over one large one.** Each can be verified independently and reverted independently.

### Disagreeing productively

**Rule: Try the note before arguing with it.** Most disagreements evaporate when the version exists. The rest become better arguments.

**Rule: When you disagree, show an alternative, not a refusal.** "Here's the version with the note, and here's a version that addresses the same problem differently."

**Rule: The person who owns the cut decides. Say your piece once, clearly, then execute.**

### Closing the loop: verifying a note was addressed

**Rule: Every note gets a response: done, done differently, or not done and why.**

**Rule: Verify by watching, not by reading the change list.** The change list tells you what moved; only watching tells you whether the problem is gone.

**Rule: Check for collateral damage.** A note addressed at 00:13:00 can break sync at 00:13:30 or shift a music cue at 00:15:00. `[TOOL: `compare_versions` + `check_cuts`]`

---

## 26\. Review, Comparison, and Alternate Versions

Editing is comparison. The only way to know whether a cut is better is to see it next to the alternative.

### Side-by-side and A/B comparison

**Rule: Compare versions cold, in the order that hides your preference.** If you cut version B and expect to prefer it, watch B first, then A.

**Rule: Compare short ranges, not whole films, for micro-decisions.** A 30-second range with two versions of a cut point is comparable. A 90-minute film with 200 differences is not.

**Rule: For structural comparison, watch the whole film both ways, with a day between.** Structural differences are felt cumulatively.

*Workflow:* render both versions of a range, play back-to-back or side by side, record the preference and the reason. `[TOOL: `render_draft` of each version (checkpoint → restore → draft); compare the drafts with `get_contact_sheet` and `get_frame`]`

### Version naming and duplication

**Rule: Never edit the current version in place once it's been reviewed. Duplicate, then edit.**

**Rule: Name versions with a number, a date, and a one-phrase description of what changed.** `v14_2026-09-08_reveal-moved-earlier` is findable. `Final_v2_FINAL` is not.

**Rule: Keep a version log with runtime, what changed, and who requested it.** The log is the edit's memory. `[TOOL: `create_checkpoint` / `list_checkpoints` (the label is the version name)]`

**Rule: Prune obsolete versions deliberately, not casually.** An exploratory branch that failed is still evidence of what didn't work.

### Alternate cuts for length, rating, or platform

**Rule: Cut the primary version to lock before starting alternates.** Alternates derived from a moving primary have to be redone.

**Rule: Derive alternates from the locked primary and track the differences as a change list, not as a separate cut.** When the primary changes, the change list tells you what to propagate.

**Rule: Length-based alternates (broadcast versus streaming, trailer versus feature) are structural edits, not trims.** Removing 12 minutes from a 100-minute film means losing scenes, not shaving every shot.

**Rule: Platform alternates (vertical, square, captioned) are reframes and re-timings of the same cut, and should never diverge in story.** Chapter 36 covers reframing.

### Exporting review copies with burn-ins

**Rule: Every review export has burned-in timecode, version name, and a visible watermark or "not final" indicator.** Notes without timecode are useless; review copies without version names get confused.

**Rule: Burn in the timeline timecode, not the source timecode.** Notes need to refer to the cut, not the footage.

**Rule: Review exports are low resolution, fast to make, and small enough to send.** They are not deliverables. `[TOOL: `render_draft` (≤640×360, seconds) is the review copy; no burn-ins — cite times from `get_project` / `pacing_report`]`

### Collecting feedback from screenings

**Rule: Ask viewers what they felt and where, not what they'd change.** Their diagnosis is usually right; their prescription usually isn't.

**Rule: Ask the same questions of every viewer, in the same order, in writing where possible.** Comparable feedback beats vivid feedback.

**Rule: Look for clusters, not individual comments.** One person confused at 00:40:00 is noise. Four people confused at 00:40:00 is a note.

**Rule: Watch the audience, not the screen.** Where they shift, look at their phones, or laugh late tells you more than the questionnaire.

**Rule: Don't cut for the loudest voice in the room.** Weight feedback by how well the viewer represents the intended audience, not by how confidently it's delivered.

---

# Part VI: Sound

Half of what an audience experiences in a cut is sound, and most of what they forgive in picture they forgive because the sound held. Picture editors are not mixers, but the picture edit sets up everything the mix can and cannot do. This part covers what the editor owes the sound.

---

## 27\. Dialogue, Ambience, Effects, and Track Layout

### Standard track layout and naming

**Rule: Assign every audio track a single purpose and name it for that purpose.** Dialogue on dialogue tracks, effects on effects tracks, music on music tracks. Mixed-purpose tracks are unmixable.

A workable default layout for picture editorial:

- **DX 1–4** — dialogue, one track per speaker or mic where practical  
- **VO 1** — narration or voiceover  
- **AMB 1–2** — ambience and room tone (stereo pair or two mono)  
- **FX 1–4** — hard effects, foley, and temp sound design  
- **MX 1–2** — music (stereo pair)

**Rule: Keep the layout identical across every timeline in the project.** Downstream tools and collaborators depend on track numbers meaning the same thing everywhere.

**Rule: Never put a clip on a track that doesn't match its purpose, even temporarily.** "I'll move it later" is how mixes get broken.

*Mechanical check:* list all clips whose media type or naming doesn't match their track's purpose tag. `[TOOL: not applicable — tracks are fixed by purpose: main sequence (track 0), overlay tracks ≥ 1, `audioOnly` clips, the music bed, the voiceover; `get_project` lists them]`

### Cleaning dialogue: room tone, fills, and gaps

Every location has a sound when nobody's talking. When dialogue is cut, the gaps between clips are either that sound or silence, and silence is audible as a hole.

**Rule: Never leave true silence in a dialogue track.** Fill every gap with room tone from the same location and mic.

**Rule: Record or extract room tone for every location and mic setup and keep it in a dedicated bin.** If none was recorded, extract it from the longest silent stretch in the takes.

**Rule: Fills go on the dialogue track, not the ambience track.** Room tone is part of the dialogue; the mixer needs it there.

**Rule: Crossfade dialogue clips with short fades (2–8 frames) rather than butt-joining them.** Butt joins click; fades don't.

**Rule: Checkerboard dialogue when speakers have different mic perspectives.** Alternate speakers across two tracks so the mixer can treat each perspective separately.

*Mechanical check:* find every gap on dialogue tracks longer than 1 frame; report and optionally fill with the location's room tone clip. `[TOOL: `detect_silences` on the draft; there is no room-tone fill — add an `audioOnly` room-tone clip at `offsetS`]`

### Ambience and atmosphere beds

Ambience is the continuous sound of a place: traffic, wind, HVAC, birds, crowd.

**Rule: Every scene has an ambience bed running its full length, under every cut.** This is what makes the scene feel like one place instead of a stack of shots.

**Rule: Ambience does not cut with picture. It crossfades at scene changes and holds through shot changes.**

**Rule: Change ambience only when the location or the story changes.** Cutting to a new angle in the same room is not a reason to change the bed.

**Rule: Layer two or three ambiences for depth: a wide bed, a mid-distance texture, and occasional specific sounds.** One layer sounds like a loop.

### Sound effects: hard effects and foley

**Hard effects** are sounds tied to specific on-screen events: a door, a gunshot, a phone. **Foley** is performed sound tied to movement: footsteps, cloth, handling props.

**Rule: The picture editor places temp hard effects for anything the story depends on.** A door slam that motivates a reaction, a gunshot that ends a scene. Without them, the cut can't be judged.

**Rule: Don't foley in the picture edit.** Footsteps and cloth are the mixer's job, and temp foley usually gets thrown away.

**Rule: Sync hard effects to the frame.** An impact one frame late reads as soft; one frame early reads as wrong.

**Rule: Temp effects are labeled as temp.** Track name, clip name, or marker. The mixer must be able to find and replace them.

### Sound as continuity across cuts

**Rule: Continuous sound licenses discontinuous picture.** A line of dialogue, a sustained ambience, or a music cue running across a cut is what makes the cut invisible. When a cut feels rough, check what the sound is doing first.

**Rule: Never cut sound and picture at the same frame in dialogue unless the hard cut is the point.** (See J-cuts and L-cuts, Chapter 17.)

**Rule: At scene changes, decide what carries across: ambience, music, a line, or nothing.** Each is a different effect. The choice is a creative one and should be made, not defaulted.

### Sync and drift checks

**Rule: Verify sync on every clip at ingest and again at picture lock.** Sync errors introduced by mixed frame rates, sample rate mismatches, or bad merges are invisible until someone notices a lip flap.

**Rule: Check sync at the end of long clips, not the start.** Drift accumulates.

**Rule: Sync tolerance is zero frames for on-screen dialogue and one frame for off-screen or wide shots.** Audiences detect one-frame errors on close-ups.

*Mechanical check:* for each clip with linked audio, compare the offset between video and audio at head and tail; flag drift. For dialogue clips, optionally compare waveform transients against a visual mouth-motion estimate. `[TOOL: not available. A clip's audio stays locked to its picture, so drift can only exist in the source; check head and tail with `get_frame` + `detect_silences`]`

---

## 28\. Music

Music is the most powerful and most dangerous tool in the edit. It can make a weak scene work and hide the fact that the scene is weak. The editor's job is to use it well and to know when it's covering for something.

### Temp music and its dangers

Temp music is existing music laid in during the edit to indicate feel, before the score is written or the licensed tracks are cleared.

**Rule: Use temp music, but choose it as if it were final.** Bad temp trains everyone to accept the wrong feel.

**Rule: Beware temp love.** After a hundred viewings, the temp track becomes inseparable from the scene, and the composer's replacement will always feel wrong. Change temp cues periodically during the edit to stay honest.

**Rule: Cut a scene without music first. Add music only when the scene works dry.** Music added to a scene that doesn't work dry hides the problem instead of fixing it.

**Rule: Track every temp cue: what it is, where it came from, and whether it's clearable.** A temp track that becomes essential and can't be licensed is a disaster discovered too late. `[TOOL: `get_project` shows `music`; keep the cue log in your report and checkpoint labels]`

### Placing music cues

**Rule: A cue has a reason to start and a reason to stop.** Both should be identifiable — a look, a decision, a scene change, a line. Music that starts because the scene felt empty is decoration.

**Rule: Start cues under something, not on nothing.** A cue that enters under a line or an action is felt; one that enters on silence is heard.

**Rule: Enter late, leave early.** Most cues can start later than instinct suggests and end sooner.

**Rule: Vary how cues enter: a sting, a fade, a swell, a sneak.** Uniform entrances become predictable.

**Rule: Not every scene needs music. A film wall-to-wall with score has no dynamic range.** Silence between cues is what makes the cues land.

### Beat alignment and cutting to music

**Rule: When picture is cut to music, decide which is master.** Either the cut follows the music (montage, action, trailer) or the music follows the cut (drama, dialogue). Mixed masters produce fights.

**Rule: Cut on musical structure before cutting on beats.** Phrase boundaries, verse-to-chorus, the drop, the rest. Beats are secondary.

**Rule: Land cuts within 1–2 frames of the beat when cutting to it. Beyond that, the sync is felt as wrong even when it isn't consciously noticed.**

**Rule: Cut on the beat for a few shots, then off it. Return to it for emphasis.** Metronomic cutting is fatiguing after ten seconds.

*Mechanical check:* detect the beat grid of a music clip; report each cut in the range with its frame offset from the nearest beat and nearest phrase boundary. `[TOOL: `check_beat_alignment`]`

### Editing music: shortening and extending cues

Cues rarely fit the scene as written. The picture editor must be able to make a 3:20 track into 2:05 or 4:10 without the seams showing.

**Rule: Cut music at phrase boundaries and on downbeats.** Bar 8 to bar 24 is usually a seamless join; bar 8 to bar 23 is not.

**Rule: Match the join on the waveform.** Align the transient of the downbeat on both sides of the cut; then crossfade over a few frames at most.

**Rule: Extend by looping a phrase, not a bar.** A looped single bar is heard as a loop. A looped four- or eight-bar phrase usually isn't.

**Rule: Keep the intro and the ending; cut the middle.** Intros and endings are the parts the ear remembers. The middle is repeatable.

**Rule: Check music edits with the picture off.** A seam hidden by a picture cut is still a seam, and the mixer will hear it.

### Rhythm and energy across a sequence

**Rule: Map the energy of the scene before choosing music.** Where does it rise, fall, and turn? The music's energy should either match that map or deliberately counter it.

**Rule: Music that counters the picture (calm music over violence, upbeat music over grief) is a strong device. Use it knowingly and rarely.**

**Rule: Adjacent cues should differ in key, tempo, or instrumentation.** Two similar cues back to back merge into one long undifferentiated wash.

**Rule: The loudest moment in a sequence's music should coincide with the most important moment in its picture.** If they don't line up, one of them is in the wrong place.

### Handing off to a composer

**Rule: Deliver a locked picture with temp music, a cue sheet, and a description of what each temp is doing.** "This cue is here to say she's decided" is more useful than "this cue is here."

**Rule: Tell the composer what you like about each temp and what you'd change.** Temp tracks are a reference, not a target.

**Rule: Provide timecode for every cue start, every cue end, and every hit point the music should acknowledge.**

**Rule: Deliver picture with temp music in a separate stem so the composer can hear the scene dry.**

---

## 29\. Mixing Basics and Preparing Stems

The picture editor's mix is a temp mix: enough to judge the cut and to communicate intent. It is not the final mix. But a bad temp mix hides problems and a good one reveals them.

### Levels, panning, and basic EQ

**Rule: Dialogue is the reference level. Everything else sits relative to it.** Set dialogue first, then bring music and effects in under it.

**Rule: Dialogue is intelligible at every moment, or the cut has a problem.** If a line can't be heard under the music, either the music is too loud, the line is too quiet, or the line isn't needed.

**Rule: Pan dialogue to center.** Stereo dialogue in picture editorial creates problems downstream. Ambience and music go wide; dialogue stays centered.

**Rule: Use EQ only to fix problems you can name: a boomy room, a thin lav, a rumble.** Creative EQ is the mixer's job.

**Rule: Don't compress or limit in the picture edit.** Leave dynamic range for the mixer.

### Loudness standards by platform

Loudness is measured in LUFS (loudness units relative to full scale), integrated over the program. Platforms specify targets, and delivery to the wrong target gets rejected or auto-normalized.

Approximate targets (verify against the current spec for each platform):

- **Broadcast (EBU R128 / ATSC A/85):** −23 LUFS / −24 LKFS integrated, true peak −1 to −2 dBTP  
- **Streaming services:** typically −24 to −27 LUFS integrated; check each service's spec  
- **Web video and social:** typically −14 to −16 LUFS integrated  
- **Cinema:** measured differently (Leq(m)); leave to the mixer

**Rule: The picture editor's temp mix should sit near the delivery target, so the film is judged at the loudness it will be heard.**

**Rule: Check integrated loudness and true peak on every review export.** A review copy that's 6 dB hot gives false confidence about impact.

*Mechanical check:* measure integrated LUFS, short-term LUFS range, and true peak for the timeline or a range; compare against a named platform target. `[TOOL: `analyze_audio` (kinds: loudness) or `verify_export` with a platform target; voice-vs-music balance: `check_mix_levels` / `balance_music`]`

### Ducking and automation

**Rule: Music ducks under dialogue; dialogue does not rise over music.** Automate the music track down when a line starts and back up when it ends.

**Rule: Duck by hand at the moments that matter and let automated ducking handle the rest.** A key line deserves a specific decision.

**Rule: Ducks are shaped, not switched.** Ramp the music down over 6–24 frames before the line, hold, and ramp back over a similar duration after. Instant ducks are audible.

**Rule: Keyframe automation lives on the track, not in the clip, wherever the tool allows.** Clip-level automation is lost when the clip is replaced.

### Exporting stems and OMF/AAF

Stems are the mix separated into its component groups: dialogue, music, effects, and often ambience and VO. OMF and AAF are interchange formats that carry the timeline's audio clips, edits, and (sometimes) automation to a dedicated audio tool.

**Rule: Export stems at the mixer's requested sample rate and bit depth, at the same start timecode as the picture reference, and at identical length.** Stems that don't line up are unusable.

**Rule: Export an AAF (preferred) or OMF with handles of at least 2 seconds, ideally 5\.** Handles let the mixer extend and smooth edits without coming back to picture.

**Rule: Include the picture reference with burned-in timecode and a 2-pop.** The 2-pop — a single-frame tone two seconds before first frame of action — is how the mixer verifies alignment.

**Rule: Deliver a track sheet: what each track is, what's temp, what's final, and any known problems.**

*Workflow:* export stems by track group; export AAF with handles; export picture reference with BITC and 2-pop; generate track sheet from track metadata. `[TOOL: not available — SlopStudio exports one mixed file (`render_final`). Stems and AAF are out of scope]`

### What to leave for the mix

**Rule: The picture editor delivers intent, not finish.** Every choice that communicates the scene's needs is the editor's. Every choice that makes it sound good is the mixer's.

Leave for the mix:

- Final dialogue cleanup and noise reduction  
- Foley  
- Final sound design and effects replacement  
- Reverb and spatial treatment  
- Compression, limiting, and final loudness  
- Surround panning and stems for delivery

Do in the picture edit:

- Dialogue selection, track layout, and room tone fills  
- Temp ambience and story-critical hard effects  
- Music placement, edits, and temp levels  
- Rough level balance and ducking  
- Sync verification  
- Notes on everything that's temp

**Rule: Anything the mixer needs to know and can't hear goes in a note.** A line the director wants replaced by ADR, a temp effect that's a placeholder for something specific, a music cue that will change. The mix session starts with the notes, not the timeline.

---

# Part VII: Picture Finishing and Delivery

Finishing is where the cut becomes a deliverable. The creative decisions are mostly made; the remaining work is precise, technical, and unforgiving of shortcuts. This part covers color, titles and compositing, export, and moving the cut between tools.

---

## 30\. Color Correction and Grading

### Correction vs. grading

**Correction** makes shots technically right and consistent: proper exposure, neutral white balance, matched skin tones across a scene. **Grading** makes them look a particular way: warm, cold, desaturated, high-contrast, period, genre.

**Rule: Correct before you grade. A look applied to uncorrected footage produces inconsistent results shot to shot.**

**Rule: Correction is objective enough to delegate or automate. Grading is a creative decision and must be specified.**

### Reading scopes

Eyes lie. Monitors lie more. Scopes don't.

- **Waveform** — luminance (and optionally RGB) plotted against horizontal position. Shows exposure, clipping, and crushed blacks.  
- **Vectorscope** — hue and saturation on a color wheel. Shows color casts and skin tone (which falls along a known line).  
- **Histogram** — distribution of tonal values. Shows overall balance and clipping.  
- **RGB parade** — waveform split into red, green, and blue. The fastest way to see a color cast.

**Rule: Check the waveform for clipping before anything else.** Whites above legal range and blacks crushed to zero lose information that can't be recovered.

**Rule: Use the RGB parade to neutralize.** If the three channels don't align in the blacks and whites of a neutral object, there's a cast.

**Rule: Put skin tones on the skin tone line of the vectorscope.** Everything else in the frame can be stylized; skin that's off-hue reads as wrong immediately.

*Mechanical check:* for each clip, report clipped highlight and shadow percentage, RGB channel offsets in shadows and highlights, and skin tone hue deviation where a face is detected. `[TOOL: not available — no scopes. `get_frame` and judge; `update_segments` brightness/contrast/saturation are the primaries, `colorLook` + `set_lut` the look]`

### Primary corrections: exposure, white balance, contrast

**Rule: Work in this order — exposure, white balance, contrast, saturation.** Each step depends on the one before it.

**Rule: Set exposure so the important subject sits in the correct part of the range, not so the whole frame averages to middle grey.** A night scene should look dark.

**Rule: White balance to a neutral reference where one exists; to skin where it doesn't.**

**Rule: Set contrast by placing black point and white point, then adjusting the midtones.** Don't crush blacks to make an image "pop"; that's a look, and it should be a grading decision.

**Rule: Adjust saturation last and least.** Oversaturation is the most common amateur tell.

### Secondary corrections and masks

Secondaries isolate a region — by color, by luminance, or by a drawn or tracked mask — and correct only that.

**Rule: Use secondaries for problems, not for looks.** A too-red face, a sky that's blown, a distracting bright object. If you're using secondaries on every shot to create a look, build the look as a primary instead.

**Rule: Track every mask that's on a moving subject. A static mask on a moving face is worse than no mask.**

**Rule: Feather every mask edge.** Hard-edged secondaries are visible.

**Rule: Secondaries stack. Check the result of all of them together, not each alone.**

### Shot matching across a scene

A scene shot with two cameras, at different times of day, with different lenses, must look like one continuous event.

**Rule: Pick a hero shot per scene and match everything else to it.** Usually the most-used or most-representative angle.

**Rule: Match in this order — black point, white point, midtone brightness, white balance, saturation, then skin tone specifically.**

**Rule: Match by scopes first, then by eye, then by cutting between the shots at speed.** Mismatches show on cuts that scopes miss.

**Rule: Group shots by camera and setup, correct the group, then trim individual shots.** Correcting every shot independently produces drift.

*Workflow:* group clips by camera and setup metadata; apply the hero correction to the group; report residual scope differences per clip. `[TOOL: `update_segments` with the same brightness/contrast/saturation for every segment from one setup; check on `get_contact_sheet` of the draft]`

### LUTs, looks, and color spaces

A **LUT** (lookup table) is a fixed transform from input color to output color. **Technical LUTs** convert between color spaces (log to Rec.709). **Creative LUTs** apply a look.

**Rule: Know the color space of every source, the working space of the timeline, and the target space of the deliverable.** Most color disasters are a wrong or missing transform, not a wrong grade.

**Rule: Apply technical LUTs or color-managed transforms at input; apply creative looks after correction; apply output transforms at delivery.** In that order, in separate stages.

**Rule: A creative LUT is a starting point, not a grade. Apply it, then correct under it.**

**Rule: Never bake a creative look into the source media.** Keep the look as a layer that can be adjusted or removed.

**Rule: Grade on a calibrated display in the target color space, or accept that you're guessing.**

### Grading with an agent: what to specify

Correction can be delegated to an agent with reasonable confidence. Grading requires specification.

**Rule: For correction, specify the reference and the tolerance.** "Match all clips in scene 12 to clip 12C-3; skin tone within 5° of hue; blacks within 2 IRE." The agent can verify its own work by scope.

**Rule: For grading, specify the look in measurable terms wherever possible.** "Warm: shift shadows toward blue, highlights toward orange, overall white balance \+300K" is checkable. "Make it feel like autumn" is not — but it can be a starting brief, followed by a rendered frame and a correction.

**Rule: Ask for before/after frame grabs at three points in every scene the agent grades.** Review the grabs, not the parameters.

**Rule: Agents should never touch the color pipeline configuration (input transforms, working space, output transforms) without explicit instruction.** A change there affects every shot.

---

## 31\. Titles, Graphics, and Compositing

### Title design basics: type, safe areas, duration

**Rule: One typeface family per project, two at most.** Titles, lower thirds, captions, and credits share a type system.

**Rule: Keep text inside the title-safe area — roughly the inner 90% of the frame for modern displays, tighter (80%) for broadcast.** Text near the edge is cropped on some screens.

**Rule: Hold a title for reading time plus a beat.** Minimum around 2 seconds for a name; longer for a sentence. A rough rule: half a second per word, plus one second.

**Rule: Titles that appear over picture must be legible against every frame they're on.** Check the busiest frame, not the first one. Add a subtle drop shadow, a gradient, or a background plate when contrast fails.

**Rule: Title animations are short — 8 to 20 frames in and out. Longer animation draws attention to the animation rather than the text.**

### Lower thirds and captions

**Rule: A lower third appears when the person first speaks on camera, or the first time they're the clear subject, and is held 3–5 seconds.**

**Rule: Repeat a lower third only after a long absence (several minutes) or a return from a section where many people were introduced.**

**Rule: Lower thirds are consistent to the pixel: same position, same size, same animation, same timing.** Build one, template it, and never adjust individual instances.

**Rule: Don't put a lower third over a cut. Let it sit on one shot.**

*Workflow:* generate lower thirds from a template and a list of names and timecodes; verify that none overlaps a cut. `[TOOL: `add_text_overlay` per name and time; `check_cuts` flags overlays that straddle a cut]`

### Subtitles and accessibility

**Subtitles** translate or transcribe dialogue. **Captions** (closed captions, SDH) also describe sound for viewers who can't hear it.

**Rule: Deliver captions as a sidecar file (SRT, VTT, or a broadcast format) rather than burned in, unless the platform requires burn-in.** Sidecars are editable and switchable.

**Rule: Follow a caption style guide: line length (around 32–42 characters), maximum two lines, minimum display duration (about 1 second), and reading speed (around 160–180 words per minute for adults).**

**Rule: Caption timing follows the audio, not the picture cut.** Captions that cut with picture change too early or too late.

**Rule: Captions do not straddle a shot change by a few frames.** If a caption would end within a few frames of a cut, snap it to the cut.

**Rule: Proof every caption file by reading it against the audio.** Auto-generated captions are a starting point, not a deliverable.

*Mechanical check:* validate caption files for line length, duration, reading speed, overlap, and proximity to shot changes. `[TOOL: captions are rendered by libass from `voScript` (`update_project` captionsEnabled/captionStyle/captionSizePct); no sidecar validation — check reading speed against the transcript's word timings by hand]`

### Basic compositing and keying

**Rule: Compositing in the edit is for simple, story-critical work: a screen replacement, a sign fix, a split-screen, a simple key.** Anything requiring tracking, roto, or more than three layers goes to a dedicated tool.

**Rule: For keying, the source must have been shot for it.** A badly lit green screen doesn't key well in any tool. Report it; don't fight it.

**Rule: Match grain, blur, and color between composited layers.** A sharp, clean element over grainy footage is the most common composite tell.

**Rule: Composite in the working color space, not the delivery space.**

### Stabilization, reframing, and clean-up

**Rule: Stabilize only what needs it, and only enough.** Over-stabilized footage floats unnaturally. A little handheld motion is life.

**Rule: Stabilization crops. Check the edges of every stabilized shot for lost information and for warping.**

**Rule: Reframing (punch-ins, repositions) is legitimate up to the point where resolution suffers.** A 10–20% punch-in on 4K delivered at HD is invisible; the same on HD delivered at HD is soft.

**Rule: Clean-up (removing a boom, a logo, a distraction) is a note to VFX unless it's a simple static patch. Do the simple ones; flag the rest.**

**Rule: Every stabilized, reframed, or cleaned shot gets a marker saying so.** Downstream color and VFX need to know what was changed.

### Round-tripping to external tools

**Rule: Send the shot, not the timeline.** A VFX or motion graphics tool needs a rendered plate with handles (typically 8–24 frames each side) plus a reference of the cut.

**Rule: Plates are rendered at source resolution, in a lossless or near-lossless codec, in the working color space, with the source's frame rate.** Never send a compressed delivery-format file as a plate.

**Rule: Name plates by shot ID and version, and keep a shot list that maps each plate to its timeline position.**

**Rule: When the shot comes back, replace the original with the finished version at the same position and length, and mark it as final.** If the length changed, that's a cut change and goes back through the change list process (Chapter 24).

*Workflow:* render plates for a list of marked shots with specified handles and format; generate the shot list; on return, match by shot ID and replace. `[TOOL: not available]`

---

## 32\. Render Presets, Export, and Delivery Specs

### Choosing codecs and containers

Codecs fall into three families, and the family determines the use:

- **Intra-frame, high-bitrate (ProRes, DNxHR, CineForm, uncompressed):** editing, mastering, interchange. Large, robust, every frame is independent.  
- **Inter-frame, delivery (H.264/AVC, H.265/HEVC, AV1, VP9):** viewing, streaming, upload. Small, efficient, harder to edit.  
- **Archival and intermediate (JPEG 2000, FFV1, DPX/EXR sequences):** long-term storage and VFX.

**Rule: Master in an intra-frame codec at or above source quality. Deliver in whatever the platform asks for. Never master in a delivery codec.**

**Rule: The container (MOV, MP4, MXF, MKV) is separate from the codec. Choose the container the destination expects.** MP4 for web, MXF for broadcast, MOV for most post workflows.

**Rule: On Linux, verify that the codec/container combination encodes correctly with the app's FFmpeg build, and that the destination decodes it.** Not every combination is supported everywhere. `[TOOL: `export_formats`]`

### Resolution, frame rate, and aspect ratio decisions

**Rule: Deliver at the resolution the platform expects, derived from a master at the highest resolution you have.** Don't upscale to meet a spec; deliver the master resolution and let the platform handle it, unless the spec requires otherwise.

**Rule: Never change frame rate at delivery unless the spec requires it. If it does, use proper frame rate conversion, not frame dropping or duplication.** 23.976 to 25 or 29.97 is a real conversion with real artifacts; plan for it.

**Rule: Aspect ratio changes are creative decisions, not export settings.** A 2.39 film delivered at 16:9 is either letterboxed (preserving the frame) or reframed (a new cut). Decide which, and if reframed, review every shot.

**Rule: Pixel aspect ratio must be square for all modern deliverables. Check when the source is anamorphic or legacy SD.**

### Bitrate and quality settings

**Rule: For masters, use the codec's highest reasonable profile and don't think about bitrate.** ProRes 422 HQ or 4444, DNxHR HQX or 444\.

**Rule: For delivery, follow the platform's bitrate spec. Where none is given, target: 1080p H.264 at 10–20 Mbps, 4K H.264 at 35–50 Mbps, H.265 at roughly 60% of those.** Verify against current platform recommendations.

**Rule: Use two-pass or constant-quality (CRF) encoding for delivery, not single-pass constant bitrate, unless the spec demands CBR.**

**Rule: Audio in delivery files is AAC at 256–320 kbps for stereo, or PCM where the spec allows.** Never deliver low-bitrate audio to save space.

### Platform specifications

Every destination has a spec. Broadcasters publish delivery specifications running to dozens of pages. Streaming platforms publish encoding recommendations. Social platforms publish upload guidelines.

**Rule: Read the spec before the final export, not after the rejection.**

**Rule: Build a render preset per destination, name it for the destination and the spec version, and don't edit it in place.** New spec, new preset. `[TOOL: `update_project` (exportCodec, frameWidth/frameHeight, audioNormalize, captions) — the project's settings are the preset]`

**Rule: The spec covers more than codec: it includes loudness, caption format, slate, timecode start, color space, and file naming. Meet all of it.**

### Burn-ins, slates, and deliverable naming

**Rule: Review exports have burn-ins. Deliverables don't, unless the spec requires them.**

**Rule: A broadcast slate (title, duration, audio configuration, date, contact) precedes program at the timecode the spec requires, followed by bars and tone if required, black, then program at a fixed start timecode (commonly 01:00:00:00 or 10:00:00:00).**

**Rule: Name deliverables by a fixed pattern that encodes project, version, resolution, frame rate, codec, and audio layout.** `ProjectName_v14_UHD_2398_ProRes422HQ_51.mov` is unambiguous. `final export.mov` is not.

**Rule: Never overwrite a delivered file. New export, new version suffix.**

### Batch rendering and queue management

**Rule: Queue all deliverables for a version at once, from the same locked timeline, with named presets.** Exporting them one at a time over several days risks exporting from different versions.

**Rule: Render to a scratch location, verify, then move to the delivery location.** Partial or failed renders never land in the delivery folder.

**Rule: Log every render: source timeline and version, preset, output path, duration, checksum.** `[TOOL: one render per project at a time: `render_final` (blocks) or `render_status`; `probe_asset` returns the file path and size]`

**Rule: Overnight and headless rendering is normal on Linux. Build the queue, check the log in the morning, verify the outputs.**

### Verifying exports

**Rule: Watch every deliverable, start to finish, at least once, on a device other than the one that rendered it.** Every editor who skips this eventually delivers a file with a black frame, a dropped audio channel, or a missing title.

**Rule: Verify technically before verifying visually.** Duration to the frame, frame rate, resolution, codec, audio channels and layout, loudness, start timecode, file size within expected range.

**Rule: Compare a checksum of the delivered file against the render log, and again after transfer.**

**Rule: Spot-check frames at the head, tail, every reel boundary, and every VFX shot against the timeline.**

*Mechanical check:* probe the exported file; compare every technical parameter against the preset and the spec; measure loudness; detect black frames, frozen frames, silent audio, and clipped audio; compare frame grabs against the timeline at sampled timecodes. `[TOOL: `verify_export` (probe, duration to the frame, black and frozen picture, silences, loudness and true peak vs platform)]`

---

## 33\. Interchange

No editing tool is an island. Cuts move to color, sound, VFX, and other editing tools, and sometimes come back. Interchange formats are how that happens, and each carries some of the timeline and loses the rest.

### OpenTimelineIO

OTIO is an open, JSON-based interchange format for timelines, designed to carry structure — tracks, clips, transitions, markers, metadata — between tools without vendor lock-in. It has adapters for most major formats.

**Rule: OTIO is the preferred interchange format for this app and the canonical representation for agent-driven workflows.** It's readable, diffable, versionable, and scriptable.

**Rule: Store project-specific metadata in OTIO's metadata dictionaries under a namespaced key, so it survives round trips and doesn't collide with other tools.**

**Rule: Test every adapter you depend on with a real timeline before relying on it in production.** Adapters vary in what they preserve.

### EDL and CMX3600

The EDL (edit decision list) is the oldest interchange format still in daily use. A CMX3600 EDL is a plain-text list of edits: reel, source in/out, record in/out, transition type.

**Rule: EDLs carry one video track and up to four audio tracks, cuts and simple dissolves, and nothing else.** No effects, no speed changes beyond simple ones, no nested sequences, no metadata beyond comments.

**Rule: Use EDLs for conform to color and for archival.** Their simplicity is their durability: any tool from the last forty years reads them.

**Rule: Reel names in the EDL must match the source media's reel or tape name exactly, or the conform will fail.** Verify reel names before export.

**Rule: Export one EDL per video track.** Layered timelines need flattening or multiple EDLs.

### AAF and FCPXML

**AAF** (Advanced Authoring Format) carries more than EDL — multiple tracks, effects metadata, audio automation, embedded or linked media — and is the standard for audio post handoff.

**FCPXML** is Apple's XML format for Final Cut Pro, widely supported as an interchange format by other tools, and richer than EDL for effects and metadata.

**Rule: Use AAF for audio post and for interchange with Avid. Use FCPXML or OTIO for interchange with most other editing and color tools. Use EDL when nothing else works.**

**Rule: Every AAF and FCPXML export is tested by reimporting it into a fresh project and comparing against the original.** If it doesn't round-trip, it won't survive the trip to another tool. `[TOOL: not available — no AAF/FCPXML/OTIO]`

### Round-tripping with other tools

Round-tripping means sending a timeline out, having it modified (color, VFX, sound), and bringing the result back into alignment with the picture cut.

**Rule: Freeze the picture before round-tripping.** A cut that changes while it's out for color returns as a conform problem.

**Rule: Send a reference video with burned-in timecode alongside every interchange file.** The receiving tool verifies against the reference; when in doubt, the reference wins.

**Rule: Give every clip a unique identifier that survives the trip.** Source file name plus source timecode is usually enough; a UUID in metadata is better.

**Rule: On return, verify alignment at every cut, not just head and tail.**

### Conform and relink workflows

**Conform** is rebuilding a timeline from an interchange file plus source media. **Relink** is reconnecting existing timeline clips to media that has moved, been transcoded, or been replaced.

**Rule: Conform against original camera media, not proxies, and verify the match by frame at every edit.**

**Rule: Relink by unique identifier first, by file name and timecode second, by file name alone last.** Name-only relinks are where wrong clips sneak in.

**Rule: After any relink, run a full mechanical check: offline clips, duration mismatches, frame rate mismatches, audio channel mismatches.** `[TOOL: not available — media lives in the project's asset folder or bundle]`

**Rule: Keep proxies and originals in a fixed, documented folder structure so relinks are predictable.**

### What survives interchange and what doesn't

Reliably survives in all formats:

- Cuts, source and record timecode, reel or file identity  
- Simple dissolves and fades  
- Track assignment (with limits per format)

Survives in richer formats (AAF, FCPXML, OTIO) but not EDL:

- Markers and notes  
- Multiple video tracks and nesting (partially)  
- Speed changes (sometimes)  
- Basic audio levels and pan  
- Clip metadata

Rarely or never survives:

- Effects parameters beyond the most basic  
- Color corrections and grades  
- Third-party plugin effects  
- Titles and generated graphics (as editable objects)  
- Compound or nested timeline internals  
- Transitions other than dissolves and simple wipes

**Rule: Anything that doesn't survive interchange is rendered before the trip or rebuilt after it. Plan which, per element, before exporting.**

**Rule: Document what was lost in every interchange export, as a note attached to the exported file.** The receiving party needs to know what to rebuild.

---

# Part VIII: Genre Playbooks

The rules in Parts IV–VII apply everywhere. This part is about how they bend for specific forms: what documentary demands that drama doesn't, why comedy timing is a different discipline, what short-form platforms punish, and where an agent belongs in all of it.

---

## 34\. Documentary and Interview-Driven Edits

Documentary is edited backward from drama. Drama starts with a script and finds footage to serve it. Documentary starts with footage and finds the story inside it. The editor is a co-writer, and the writing happens in the timeline.

### Finding the story in unscripted footage

**Rule: Watch everything before deciding anything.** The story you plan to tell is rarely the story the footage contains. The one it contains is usually better.

**Rule: Log for moments, not for coverage.** A drama log says "wide, CU, reverse." A documentary log says "she stops mid-sentence and looks at the door." The moments are the story.

**Rule: Identify the question the film is asking before assembling.** Every documentary is an argument or an inquiry. Until the question is clear, no scene can be judged as relevant or not.

**Rule: Find the ending first.** A documentary without a known ending will grow forever. Once the ending exists, everything either leads to it or gets cut.

**Rule: Expect the structure to change three or four times.** This is not failure; it is the process. Keep every structural version (Chapter 26).

### Transcript-first workflows

**Rule: Transcribe everything with speech, verbatim, timecoded, with speaker identification.** Half of documentary editing is reading.

**Rule: Build the story on paper before building it in the timeline.** A paper edit of transcript excerpts (Chapter 23\) is faster to restructure than any timeline.

**Rule: Search transcripts by idea, not by keyword.** The line that makes the film may not contain the word you're looking for. Read the surrounding context of every hit. `[TOOL: `transcribe`, then read and search the text in your own context (`search_guide` searches this guide, not media)]`

**Rule: Mark the moment where a speaker stops performing and starts telling the truth.** Usually after a pause, after they think the question is over, or on the second time they answer it. That's the take.

### Structuring interviews and B-roll

**Rule: Cut the radio edit first, then cover it.** (Chapter 23.) A documentary that doesn't work as audio doesn't work.

**Rule: A talking head is not a failure. Let people speak on camera when what they're saying is the thing to watch.** Cover with B-roll when the face is not adding, or when a cut must be hidden.

**Rule: B-roll illustrates or contradicts. It does not decorate.** A shot of a street while someone talks about the street is illustration. A shot of an empty house while someone says "we were happy there" is contradiction. Both are legitimate. Wallpaper is not.

**Rule: Cut back to the speaker for the line that matters.** The audience needs to see the face for the emotional beat, not the B-roll.

**Rule: Multiple interviewees on the same topic are intercut like a conversation they never had.** Choose the order for argument, contrast, or escalation. Give each voice a distinct role.

**Rule: Don't let one interviewee explain what another one is about to show.** Let the audience discover it.

### Verité and observational pacing

Verité footage — events unfolding without interviews or narration — needs a different rhythm.

**Rule: Hold longer than you would in drama.** The audience is learning a real world; they need time to read it.

**Rule: Cut for behavior, not for information.** The scene is about how people act, not about what happens. Keep the shot where he almost says something and doesn't.

**Rule: Let scenes play in as few shots as the coverage allows.** Verité cut like drama — reverse angles, inserts, reaction shots — starts to look staged.

**Rule: Build scenes from the found moments and accept the gaps.** You will not have coverage for everything. Sound bridges and time jumps handle it; don't fake continuity.

**Rule: Verité is still structured. Every scene must turn.** Something changes between the start and the end or the scene is an observation, not a scene.

### Ethics of the documentary cut

Every editing tool in this guide can be used to mislead. In drama that's craft; in documentary it's a lie.

**Rule: A cut must not make someone say something they didn't say.** Removing a qualifier, joining two answers into one, or trimming a "but" changes meaning. If the edited statement isn't something the speaker would recognize as their own, don't make it.

**Rule: A reaction shot must not be moved to a different context.** Putting a laugh after a different question is fabrication. (See the Kuleshov effect, Chapter 21.)

**Rule: Compression of time is legitimate; reversal of sequence is not, unless the film tells the audience.** Showing the argument before the reconciliation when it happened after is a different story.

**Rule: Footage of people who didn't consent, or who consented to a different film, is a decision for the director and producers, not for the editor alone. Flag it.**

**Rule: When an edit is technically defensible but feels dishonest, it's dishonest.** Documentaries are trusted because editors make this call.

**Rule for agents: in documentary, no edit that changes the meaning of a spoken statement may be applied without human review.** Removing filler words is fine. Removing a clause is not.

---

## 35\. Narrative and Comedy Timing

### Serving performance

Narrative editing's first duty is to the actor's work. The best cut of a scene is the one where the performances are strongest, and every other consideration serves that.

**Rule: Find the moment the actor is truthful and build the scene around it.** There is usually one take, or one line in one take, where it happens. Everything else is coverage.

**Rule: Don't cut away from a performance that's still building.** If the face is still changing, hold. This overrides pacing.

**Rule: Protect the actor from their weakest moments.** Use the reverse, the cutaway, or the other take. The audience should see the best of every performer.

**Rule: Rhythm comes from the performance, not imposed on it.** Cut where the actor breathes, pauses, and turns.

### Comedy timing: setup, beat, punchline

Comedy is the most precise editing discipline. A joke is a setup, a pause, and a payoff, and the length of the pause is the joke.

**Rule: The setup is cut tight. The beat is exact. The punchline is not cut short.**

**Rule: Test every comedic beat at three lengths — as shot, two frames shorter, two frames longer — and pick by watching, not by reasoning.** Frame-level differences are audible as laughter.

**Rule: The cut into the punchline arrives a hair before the audience expects it.** Late is death.

**Rule: Never cut on the punchline's last word. Hold through it and into the silence after.** The laugh needs a place to happen.

**Rule: A joke that needs explaining is cut, not fixed.** No amount of editing rescues a setup the audience didn't get.

### Reaction and the cutaway laugh

**Rule: The reaction shot is often funnier than the joke.** A deadpan face after an absurd line is where the laugh lands. Cut to it and hold.

**Rule: Don't show a reaction to every joke.** Reactions are punctuation. Too many, and they become the sentence.

**Rule: The cutaway after a punchline extends the laugh.** Cut to a third person, an object, or a wide, and hold for the length of the expected laugh. In a screening, this is where the audience catches up.

**Rule: In multi-camera comedy, cut to whoever is doing the most interesting thing, not to whoever is speaking.** Comedians listen actively.

### Drama: holding on emotion

**Rule: Drama holds where comedy cuts.** The emotional moment needs time to be received.

**Rule: Stay on the face after the line.** The line is what the character said; the frames after are what they meant.

**Rule: Resist the reaction shot at the peak.** Sometimes the audience needs to stay with the person feeling the thing, not see someone else watching them feel it.

**Rule: The cut that ends a dramatic scene arrives after the audience has finished feeling, not when the action stops.**

**Rule: Silence is the most powerful sound in drama. Don't fill it with music until the scene has proven it works without it.** (Chapter 28.)

### Genre expectations and rhythm

Every genre has a rhythmic contract with its audience. Editors who don't know the contract break it by accident.

- **Thriller:** information withheld and released on a schedule. Cuts hide as much as they show. Tension held until it must break.  
- **Horror:** long holds punctuated by shock. The build is the film; the scare is the release. Cut the false alarm exactly like the real one.  
- **Romance:** two-shots and matching reaction sizes. The cut alternates between the pair with balance; unequal coverage signals unequal feeling.  
- **Action:** see Chapter 18\. Clarity, then speed.  
- **Comedy:** see above. Precision above everything.  
- **Drama:** performance above everything.

**Rule: Learn the contract, then decide whether to honor or break it. Only breaking it by accident is a mistake.**

**Rule: Mixed-genre films switch contracts at scene boundaries, and the audience must feel the switch.** A comedy scene inside a thriller is cut like a comedy scene.

---

## 36\. Short-Form and Social Cuts

Short-form is not a smaller version of long-form. It has its own physics: seconds instead of minutes, retention instead of narrative, and platforms that measure everything.

### Hook, retention, and the first three seconds

**Rule: The first second must show what the video is. The first three must give a reason to stay.** Titles, logos, and slow opens are for other formats.

**Rule: Open on the most interesting frame, even if it's from the end.** The chronological beginning is rarely the best beginning.

**Rule: Every three to five seconds, something must change: shot, text, sound, or information.** The audience's finger is on the screen.

**Rule: Cut anything that isn't the point. A 45-second video with 10 seconds of setup is a 35-second video.**

**Rule: Study the retention graph after publishing, and cut the next video where the last one lost people.** Short-form editing is empirical.

### Vertical and square reframing

**Rule: Vertical is not cropped horizontal. Reframe every shot for the subject, and accept that some shots don't work vertical and must be replaced.**

**Rule: The subject sits in the middle third of the vertical frame.** The top and bottom are covered by platform UI on most devices.

**Rule: Two-shots in vertical are a problem. Alternate singles, stack them, or use a split-screen.**

**Rule: Wide shots lose their meaning in vertical. Replace with closer coverage or punch in, resolution permitting.**

**Rule: Reframing is a creative pass and gets watched shot by shot, not batch-applied.** Auto-reframing tools are a starting point; a human or an agent with frame-grab verification checks every result. `[TOOL: `update_segments` `transform` (keyframed scale/pan) or the `crop` effect; verify every shot with `get_frame`]`

### Captions and sound-off viewing

A large fraction of short-form viewing is silent. The video must work without sound.

**Rule: Burn in captions for short-form. Sidecar captions are off by default and most viewers won't turn them on.**

**Rule: Captions are large, high-contrast, centered or lower-center, and styled consistently.** They're a design element, not an accessibility afterthought.

**Rule: Caption in phrases, not sentences. One idea on screen at a time, timed to the speech.**

**Rule: If the video depends on a sound the audience can't hear, show it — as text, an on-screen reaction, or a visual.**

**Rule: The video still needs good sound. Sound-on viewers are the ones who share.**

### Pacing for platform norms

Each platform has a native rhythm, and each shifts over time. Approximate:

- **Short vertical video:** 15–60 seconds; a cut or change every 1–3 seconds; hook in the first second.  
- **Long vertical video and vlog formats:** up to several minutes; pacing relaxes after the hook but never to long-form levels.  
- **Horizontal social video:** 30 seconds to 3 minutes; broadcast pacing, tighter.  
- **Commercial spots:** 6, 15, 30, 60 seconds — fixed to the frame; every shot earns its place; the brand appears when the spec says.

**Rule: Match the platform's rhythm unless you're deliberately standing out from it.** Both work; drifting between them doesn't.

**Rule: Check current platform norms before cutting; they change yearly.** The figures above are directional.

**Rule: For spots, cut to the exact duration in the spec, and verify to the frame.** A 30-second spot that's 30 seconds and 2 frames is rejected.

### Repurposing long-form into short-form

**Rule: Don't cut a highlight reel; find the standalone moments.** A short must make sense without the long-form. Choose the segments that are complete on their own.

**Rule: Rebuild the hook for each short.** The moment that works at minute 40 of a long piece needs a new opening line or shot to work as second one.

**Rule: Re-time, don't just re-crop.** Long-form pacing in a short is a short nobody finishes.

**Rule: Keep a manifest linking every short to its source timecode in the long-form master.** For rights, for corrections, for finding the next one. `[TOOL: one project per short: `create_project` (preset vertical) + `add_segment` ranges from the same source asset; keep the manifest in your report]`

**Rule: An agent can propose candidate segments by transcript, energy, and scene detection. A human picks. The agent then builds the shorts to a template.**

---

## 37\. Automated and Agent-Assisted Workflows

This app is built to be operated by agents as well as people. This chapter is about the division of labor: what to hand to an agent, what to keep, and how to build the handoff so the result is trustworthy.

### Tasks agents do well

An agent excels at work that is rule-bound, verifiable, high-volume, or tedious.

- **Logging and metadata:** transcription, scene detection, shot-size classification, speaker ID, tagging, naming.  
- **Sync and organization:** multicam sync, grouping by setup, bin structure, proxy generation.  
- **Assemblies:** script- or transcript-ordered first cuts from marked selects (Chapter 23).  
- **Mechanical cleanup:** filler-word detection, gap filling with room tone, flash-frame removal, sync verification.  
- **Conforms and relinks:** matching by identifier, verifying by frame, reporting mismatches.  
- **Verification:** every mechanical check in this guide. Loudness, caption validation, export probing, timeline diffs.  
- **Variants:** deriving platform versions from a locked master to a defined template.  
- **Reports:** pacing statistics, version comparisons, change lists, render logs.

**Rule: If the task can be described with a range, a rule, and a success criterion, it's an agent task.**

### Tasks that need human judgment

- **Choosing the take.** Performance judgment is the core of the craft.  
- **Structure.** Which scene goes where, and which goes.  
- **The frame-level cut on a dramatic or comedic beat.** An agent can propose three; a person picks.  
- **Music selection and cue placement.** Taste, licensing, and emotional intent.  
- **Grading decisions.** Correction is delegable; the look is not.  
- **Anything with an ethical dimension.** Documentary meaning, consent, representation.  
- **Anything the director cares about.** If they'll have an opinion, ask before, not after.

**Rule: An agent may propose in these areas. It does not decide.**

### Human-in-the-loop review patterns

Three patterns cover most cases:

1. **Propose and approve.** The agent generates a change and a report; a human approves or rejects before it's applied. For anything creative or structural.  
2. **Apply and review.** The agent applies changes in a transaction and reports; a human reviews after and reverts if needed. For mechanical work with low blast radius.  
3. **Apply and verify.** The agent applies, runs the relevant mechanical checks, and only escalates if a check fails. For fully rule-bound work — gap filling, export verification, relinks.

**Rule: Choose the pattern by blast radius, not by convenience.** A change that touches every clip is propose-and-approve, even if it's mechanical.

**Rule: Every agent operation produces a report readable by a human in under a minute.** What changed, where, why, and what didn't work.

**Rule: The report includes frame grabs or renders for anything visual and loudness or waveforms for anything audible.** Parameter lists aren't verification.

### Guardrails and approval gates

**Rule: Agents work in a duplicated version, never in the reviewed cut.** (Chapter 26.)

**Rule: Structural operations — deleting scenes, reordering, changing the locked cut — require an explicit confirmation step in the harness.**

**Rule: Destructive operations on media — deleting files, consolidating, overwriting — are never available to an agent without a human confirmation per operation.**

**Rule: The color pipeline, project settings, and render presets are read-only to agents unless a human unlocks them for a named operation.**

**Rule: In documentary, any edit that changes the meaning of a spoken statement is gated for human review.** (Chapter 34.)

**Rule: An agent that can't complete a task as specified stops and reports. It does not improvise a partial solution and present it as complete.**

**Rule: Rate-limit and log everything.** An agent making a thousand edits per minute is either doing a batch job it was asked to do or malfunctioning; the log tells you which. `[TOOL: every mutation broadcasts `project.changed` with the client id; checkpoints are the audit trail. No rate limits]`

### Measuring agent output quality

**Rule: Measure against the human baseline on the same footage.** Have a human do the task on a sample; compare the agent's output on the same sample.

**Rule: Mechanical tasks are measured by error rate against the check.** Sync errors per hundred clips; caption validation failures per file; conform mismatches per timeline.

**Rule: Creative proposals are measured by acceptance rate.** What fraction of the agent's proposed cuts, takes, or segments did a human accept unchanged? Track it over time and per task type.

**Rule: Track collateral damage separately.** Did the agent's change break something it wasn't asked to touch? This is the most important metric and the easiest to miss.

**Rule: Review a random sample of "apply and verify" operations by hand, on a schedule.** Automated checks catch what they were written to catch.

### Building repeatable pipelines

**Rule: A pipeline is a named sequence of operations with defined inputs, outputs, checks, and gates. Build it once; run it many times.**

Typical pipelines:

- **Ingest:** import, verify, transcode proxies, transcribe, detect scenes, sync, organize into bins, report.  
- **Assembly:** from marked selects and a structure document to a stringout and a first assembly, with a coverage report.  
- **Pre-lock check:** every mechanical check in Chapters 24 and 27, run against a candidate lock.  
- **Handoff:** picture reference, AAF with handles, stems, OTIO, EDL, shot list, track sheet, notes.  
- **Delivery:** batch render to named presets, verify each output, checksum, log, move to delivery location.  
- **Variants:** from a locked master, derive platform versions to templates, verify, manifest.

**Rule: Every pipeline stage is idempotent.** Running it twice produces the same result as running it once. This is what makes retries safe.

**Rule: Every pipeline logs its inputs, outputs, and version, so any deliverable can be traced back to the timeline and settings that produced it.**

**Rule: Pipelines are versioned like code.** A change to the delivery pipeline is reviewed, tested on a sample, and versioned before it runs on real work.

**Rule: Start with the pipelines that are entirely mechanical — ingest, pre-lock check, delivery — and prove them before automating anything upstream of a creative decision.**

---

# Appendices

## A. MCP Tool Reference

Generated from the running server: see `guide/appendix-a-tools.md`.

Errors come back as text with `isError`; the message is the API's (`POST /api/… → 400: …`). Common ones: "Cannot edit a project while it is RENDERING" (wait or `cancel_render`), "sourceAssetId is required", "Draft previews only assemble existing media" (AI shots need a full render), "no music: set_music first".

## B. Keyboard Shortcuts and CLI Equivalents

The desktop editor's shortcuts are listed in its Help menu. CLI equivalents: `pnpm serve:headless` (server without a window), `pnpm test:eval` (scored editing tasks), `pnpm test:mcp` (MCP acceptance), `pnpm mcp` (the server on stdio). Raw routes: `docs/AGENT-API.md`.

## C. Glossary

- **Segment** — a clip instance on the timeline (SlopStudio's word for clip).
- **Main sequence** — track 0, the ripple sequence of segments.
- **Overlay track** — tracks ≥ 1: positioned picture-in-picture or full-frame B-roll at `offsetS`.
- **Audio-only clip** — a segment with `audioOnly:true`: unlinked audio at `offsetS`.
- **Draft** — the ≤640×360 fast preview render; never the final.
- **Checkpoint** — a server-side capture of settings, segments and overlays; restorable.
- **Edit list** — the ops given to `apply_edit_list`.
- **Trim in-point (`trimStartS`)** — source seconds skipped from the start.
- **Duration (`durationS`)** — on-screen length; the out-point is `trimStartS + durationS × speed`.
- **ASL** — average shot length (ch.16).
- **J-cut / L-cut** — audio leads / trails the picture cut; built here with an audio-only clip.
- **LUFS / dBTP** — integrated loudness / true peak (ch.29).  

## 12\. Typography, Safe Areas and Motion

Text on a frame is a shot: it has a face, a size, a place, an entrance, a hold and an exit, and it is either the most-read thing on screen or the thing that gets cut off on a phone. This chapter is the harness's typography — distilled from the craft of title design and from three of Anthropic's design skills (`canvas-design`: text as a rare gesture, one family, nothing falls off the page, refine by subtraction; `theme-factory`: a look is a palette and a heading/body pairing applied consistently; `brand-guidelines`: a heading face and a body face with fallbacks) — turned into rules the tools enforce.

### Safe areas

Every delivery cuts or covers the edge of the frame: overscan on a television, the rounded corners and notches of a phone, the caption block, the icon rail and the status bar a social app draws over a vertical video. Two rectangles, from `src/lib/typography/safe.ts`:

| profile | when | action-safe | title-safe |
|---|---|---|---|
| `web` | 16:9 and other landscape for the web (auto) | 5 % each side | 10 % each side |
| `broadcast` | television delivery (SMPTE ST 2046-1) | 93 % (3.5 %) | 90 % (5 %) |
| `social` | 9:16 vertical (auto) | top 8, bottom 12, left 5, right 5 | top 14, bottom 22, left 6, right 17 |
| `square` | 1:1 (auto) | 5 % | 10 % |
| `none` | a full-bleed card, on purpose | 0 | 0 |

**Rule 12.1 — All text inside title-safe; nothing that matters outside action-safe.** Every burned-in text (`add_text_overlay`) and every caption anchors to the title-safe rectangle: `position` picks the corner or edge of *that* rectangle, `marginPx` moves it further in. The project's `safeArea` is `auto` (by aspect) unless the brief says broadcast. The Live monitor shows the two rectangles (the ▢ button); *Mechanical check:* `check_text` — error outside action-safe, warning outside title-safe; `verify_export` runs it on every render.

### The face

**Rule 12.2 — One family per piece, two weights at most.** The bundled faces (`list_typography`): Liberation Sans (the broadcast grotesk), Liberation Serif (the book serif), Liberation Mono (the typewriter), Noto Sans and Noto Serif (the clean humanist pair), DejaVu Sans Bold (wide and heavy, for captions that shout). A directing style names its face through its preset (Curtis: Noto Sans lower-case on black; Burns: Liberation Serif; the trailer: Liberation Sans Bold capitals; the retention cut: DejaVu Sans Bold outlined). Mixing a serif card with a grotesk lower-third is allowed when the two have different jobs; a third face is a mistake.

**Rule 12.3 — Hierarchy by size and place, not by decoration.** Sizes as % of frame height: a title 8–10, a card 4–6, a lower-third 3.5–4.5, a callout 3–3.5, a citation 2.5. On a vertical frame use the preset's vertical size (the height is the long side). Never under 2.2 % (2.4 % vertical). *Mechanical check:* `check_text` readable size.

### The line

**Rule 12.4 — Lines are short and few.** 44 characters a line (26 on a vertical frame), three lines at most; a lower-third is two lines: the name, then the role. Break the text where the sentence breathes, not where the width runs out. Capitals are for titles and intertitles, never for a sentence. *Mechanical check:* `check_text` line length and line count.

**Rule 12.5 — Hold for the reading time.** ≈ 0.8 s plus 0.32 s a word (about 190 words a minute); a card that says something holds 3–4 s; a lower-third 3.5 s; a pop caption as long as the word is spoken. *Mechanical check:* `check_text` reading time (error under 60 % of it).

### Contrast

**Rule 12.6 — Text over picture needs a treatment; text on a field needs none.** Over a shot: a translucent box (lower-thirds, callouts), an outline (pop captions, quotes over sky), or a shadow (titles). On black or a flat card: plain. A box is 35 % of the size in padding; an outline 4–9 % of the size; a shadow 4–6 %. Never a box *and* an outline.

### Motion

**Rule 12.7 — One entrance vocabulary per piece.** `FADE` (0.4 s in and out) is the default; `SLIDE_UP` (rises 0.6 em over 0.35 s, eased) is the broadcast lower-third and the map label; `POP` (grows from 82 % over 0.16 s) is the retention caption and the attack-ad word; `NONE` is the archive card and the intertitle (they cut, like the picture). Do not mix them inside a piece unless the change of vocabulary is the point.

**Rule 12.8 — Text moves with the cut, not against it.** A lower-third arrives 0.5 s after the shot it names begins and leaves 0.5 s before the cut. A card is its own shot (`source.type: "card"`), never over the tail of a moving image. A caption lands on the word (`atS` from the transcript), not on the sentence.

**Rule 12.9 — One thing at a time.** Two texts on screen at once are a layout, not a film. *Mechanical check:* `check_text` overlap.

### The director's type

**Rule 12.10 — The directing style decides the type.** Each style carries a surveyed type system (`src/lib/typography/styleType.ts`, the *Type* section of its file): the faces its titles and credits actually use, the open-licence stand-ins that replace them here (Jost for Futura, Montserrat for Gotham and Avenir, Liberation Sans for Helvetica, Oswald for Trade Gothic Bold Condensed and Tungsten, Cinzel for Trajan, Libre Baskerville for Morris's Baskerville, Libre Franklin for Vox's Balto, Anton and Bebas Neue as MrBeast's real faces, Permanent Marker for Neistat's hand), its case (Curtis in sentence case, Nolan in spaced capitals, Jonze in lower-case), its colour and field, its entrance, and the roles it puts on the frame — a title, a card, an intertitle, a lower-third, a caption, a callout, a citation, a date, a quote, a label, a credit — with the roles it never uses. `add_text_overlay {role}` resolves through it; Herzog, Wiseman, Jennings, Malick and Cunningham are no-text styles and any overlay is a departure to name in notes. *Mechanical check:* `check_text` — text on a no-text style, a face outside the style's family, capitals on a sentence-case style, a role the style does not use. Where the survey found nothing (Burns's PBS faces, Veritasium, Rober, Zhou, Jennings, Guest) the file's survey note says the choice is an assumption; when you know better, change the type system and rerun `scripts/gen-style-type.ts`.

### Transitions between shots

The cut is the default (ch.15). The project's `transition` (`CROSSFADE`, `DISSOLVE`, `FADE_BLACK`, `WIPE`, `SLIDE`) is a global grammar and belongs to the styles that name one (Ken Burns' dissolves, Hal Riney's, LEMMiNO's). A style that says "cuts" gets `NONE`. Image motion on stills (`imageMotion`: push, pull, pan) is a move with a reason — it starts on something and ends on something (Burns, Vsauce, LEMMiNO).

### Applying it

- `list_typography {projectId}` — the presets, the faces, the project's safe rectangles and the preset its style reaches for first.
- `add_text_overlay {role, text, startS}` — the brief's style fills face, case, colour, size, place, treatment, entrance and hold for this frame (`list_typography` → `styleType`); `preset` for the generic version; pass any field to override.
- `check_text {projectId}` — before `render_final`; `verify_export` repeats it on the file.
- `update_project {safeArea: "broadcast"}` for television delivery; `"none"` only for a deliberate full-bleed card.

