# Appendix A. MCP Tool Reference

*Generated from the server (63 tools). Regenerate with `pnpm exec tsx scripts/gen-tool-reference.ts`.*

## Project

### `list_projects`

All projects (newest first) with id, title, status, frame and segment count. Use the id with every other tool.

### `create_project`

Create an empty project (timeline). Pick a frame with `preset` (1080p, 4k, 720p, vertical, square, 4:5, preview) or explicit width/height. audioMode NONE (default) means the clips' own audio, music and overlays make the soundtrack; UPLOAD_AUDIO for a master voice track you upload; TTS_FROM_SCRIPT to synthesize narration from voScript (costs credits).

| Parameter | Type | Notes |
|---|---|---|
| `title` | string | required |
| `preset` | 1080p \| 4k \| 720p \| vertical \| square \| 4:5 \| preview | optional |
| `width` | integer | optional |
| `height` | integer | optional |
| `audioMode` | NONE \| UPLOAD_AUDIO \| TTS_FROM_SCRIPT \| TTS_VERBATIM | default "NONE" |
| `exportCodec` | h264 \| hevc \| av1 \| vp9 \| prores | optional |

### `get_project`

Compact view of a project: frame, look, captions, every segment (id, track, trim, duration, speed, muted, effects), overlays, render state and the total timeline length.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `update_project`

Patch project-level settings. Common fields: title, exportCodec (h264|hevc|av1|vp9|prores), colorLook (NONE|WARM|COOL|VINTAGE|…), transition (NONE|CROSSFADE|…) + transitionMs, fillMode (LETTERBOX|BLUR_FILL), vignette, grain (0-100), captionsEnabled + captionStyle (OUTLINE|BOX|POP) + captionPosition + captionSizePct, audioNormalize, audioFadeInS/audioFadeOutS, musicVolume/musicDucking/musicMuted, voScript (narration text for TTS modes), frameWidth/frameHeight. Unknown fields are rejected by the server.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `patch` | object | required |

### `delete_project`

Soft-delete a project (it disappears from lists; media stays on disk until cleanup).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

## Media

### `import_media`

Upload a local video, image or audio file into the project's media bucket and return its asset (id, kind, duration, size). Does NOT place it on the timeline — call add_segment with the asset id. Video: mp4/mov/mkv/webm/avi/ts…; images: png/jpg/webp; audio: wav/mp3/m4a/flac/ogg.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `path` | string | required; absolute path on the machine running SlopStudio |

### `import_youtube`

Download a section of a YouTube video (startS–endS) as a video segment on the timeline, or as an audio overlay (kind=audio). Runs as a background job: poll get_project until the segment's status is READY.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `url` | string | required |
| `startS` | number | required |
| `endS` | number | required |
| `kind` | video \| audio | default "video" |

### `list_media`

Reusable media across the user's projects (uploads and generated clips), newest first, with a flag for assets already on this project's timeline.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `probe_asset`

Duration, video stream (codec, size, pixel format), file size, mime and the absolute file path of any asset — including finished renders (finalRender.assetId / draftAssetId).

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |

### `set_music`

Upload a music file as the project's background bed (looped to the video length, ducked under voiceover by default). Volume 0–1.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `path` | string | required |
| `volume` | number | optional |
| `ducking` | boolean | optional |

### `set_lut`

Upload a .cube 3D LUT applied to every clip after the built-in colour look. Pass remove=true to clear it.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `path` | string | optional |
| `remove` | boolean | optional |

## Inspect

### `get_frame`

One JPEG frame of a video asset at time t (seconds). Works on sources, generated clips, drafts and finals. Use it to check a cut point, a caption, an effect or the framing.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `t` | number | required |
| `width` | integer | default 640 |

### `get_contact_sheet`

A grid of cols×rows frames sampled evenly between startS and endS (default: the whole clip), each cell stamped with its source timestamp — the fastest way to see what a clip contains before deciding where to cut. Returns the image plus the sampled times.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `cols` | integer | default 4 |
| `rows` | integer | default 3 |
| `width` | integer | default 1280 |
| `startS` | number | optional |
| `endS` | number | optional |

### `detect_scenes`

Shot boundaries in a video asset (ffmpeg scene score > threshold, default 0.4; lower = more sensitive). Returns cut times and the shots they delimit.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `threshold` | number | default 0.4 |

### `detect_silences`

Silent stretches in an asset's audio (below noiseDb, default -30 dB, lasting at least minS, default 0.5 s) AND the complementary `speech` ranges — the pieces to keep when cutting dead air.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `noiseDb` | number | default -30 |
| `minS` | number | default 0.5 |

### `transcribe`

Whisper transcript of an asset's audio with segment and word timings (startS/endS per word) — the basis for cutting by transcript, captions and finding a quote. Cached per asset+model; `tiny`/`base` are fast, `small`+ more accurate. Long clips can take minutes.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `model` | tiny \| base \| small \| medium \| large-v3 | default "base" |
| `language` | string | optional |
| `includeWords` | boolean | default true |
| `force` | boolean | default false; ignore the cached transcript and transcribe again |

### `analyze_audio`

Integrated loudness (LUFS), true peak and loudness range; silence spans; tempo (BPM) and the beat grid — for any asset (source, music bed, draft, final). Beat grid feeds check_beat_alignment; loudness feeds verify_export (guide ch.28–29).

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `kinds` | array | default ["loudness","silence","tempo"] |

## Timeline

### `add_segment`

Place an imported asset on the timeline. Track 0 appends to the main sequence; the same asset can be added several times with different trimStartS/durationS to make sub-clips (that is how you cut). The clip's OWN SOUND is off unless muted:false (see check_soundtrack). Returns the updated project.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `assetId` | string | required; an UPLOAD_VIDEO / UPLOAD_IMAGE / audio asset from import_media or list_media |
| `trimStartS` | number | optional |
| `durationS` | number | optional; default: the rest of the clip (video) or 5 s (image) |
| `track` | integer | default 0; 0 = main sequence (appended in order); >=1 = positioned overlay |
| `offsetS` | number | optional |
| `audioOnly` | boolean | default false |
| `muted` | boolean | optional; SOUND DECISION for a video clip: true (default here) = silent B-roll under music/narration; false = keep the clip's own sound (dialogue, sync sound). Note the raw API keeps sound by default; this tool mutes by default. Ignored for audioOnly clips (always audible). |
| `volume` | number | optional; gain on this clip's audio — unmuted shots and audio-only clips; 1 = as recorded, 2 ≈ +6 dB, 0.5 ≈ −6 dB (guide §7 Levels) |
| `imageMotion` | string | optional |

### `update_segments`

Change any number of segments at once (trim, duration, speed, mute, colour, effects, overlay placement). Only the fields you pass change.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `edits` | array | required |

### `split_segment`

Cut a segment into two at atS seconds from its own start (on-screen time, not source time).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `segmentId` | string | required |
| `atS` | number | required |

### `reorder_segments`

The main-sequence segment ids in their new order (overlay and audio-only clips may be omitted; they keep their place).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `orderedIds` | array | required |

### `delete_segment`

Remove a segment from the timeline (the media asset stays in the bucket).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `segmentId` | string | required |

### `add_text_overlay`

A title / lower-third / disclaimer drawn over the video from startS to endS (null = to the end). position: TOP_LEFT|TOP_CENTER|TOP_RIGHT|CENTER|BOTTOM_LEFT|BOTTOM_CENTER|BOTTOM_RIGHT.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `text` | string | required |
| `position` | string | default "BOTTOM_CENTER" |
| `startS` | number | default 0 |
| `endS` | object | optional |
| `sizePct` | integer | optional |
| `color` | string | optional |
| `boxEnabled` | boolean | optional |
| `animation` | NONE \| FADE | optional |

### `remove_text_overlay`



| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `overlayId` | string | required |

### `apply_edit_list`

Run a sequence of timeline operations as one unit: a checkpoint is taken first and, if any step fails, the project is rolled back to it. Ops: add_segment {assetId, trimStartS?, durationS?, track?, offsetS?, muted? (video is SILENT unless muted:false), audioOnly?}, update_segment {id, …fields incl. volume}, delete_segment {id}, split_segment {id, atS}, reorder {orderedIds}, clear_timeline. Ids created by earlier add_segment ops can be referenced as "$1", "$2", … (1-based index of the add op).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `ops` | array | required |
| `label` | string | optional |

## Checkpoints

### `create_checkpoint`

Save the project's editable state (settings, segments, overlays) server-side so you can try an edit and roll back with restore_checkpoint. Take one before any multi-step change.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `label` | string | optional |

### `list_checkpoints`



| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `restore_checkpoint`

Put settings, segments and overlays back exactly as captured (same ids). Media and renders are untouched.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `checkpointId` | string | required |

### `compare_versions`

Change list between a checkpoint and the current project (or between two checkpoints): segments added, removed and changed (trim, duration, speed, mute, position), runtime before/after, and changed project settings (guide ch.24 change list, ch.25 collateral damage).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `fromCheckpointId` | string | required |
| `toCheckpointId` | string | optional |

## Checks

### `pacing_report`

Shot count, average/median shot length, spread, min/max and a duration histogram for the main sequence (guide ch.16), with flags for sub-10-frame shots and near-uniform pacing, and a comparison against a genre norm if you name one (classical, drama, documentary, comedy, action, music_video, social, commercial).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `genre` | string | optional |

### `check_cuts`

Mechanical checks on every cut of the main sequence: in/out points landing inside a spoken word (needs a transcript — pass transcribe=true to make one per source at the given model), kept dead air inside shots, flash frames, lone jump cuts among conventional cuts, text overlays straddling a cut, and transition use. Cites the guide chapter for each finding.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `transcribe` | boolean | default false |
| `model` | tiny \| base \| small \| medium \| large-v3 | default "base" |

### `check_beat_alignment`

Where every cut of the main sequence falls relative to the music's beat grid (guide ch.28: land cuts within 1–2 frames of the beat when cutting to it; cut on structure — bars and phrases — before beats). Uses the project's music bed unless musicAssetId names another asset. Transition overlap is ignored.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `musicAssetId` | string | optional |
| `toleranceFrames` | number | default 2 |

### `verify_export`

Technical verification of a rendered file (guide ch.32): probe (duration, size, codec), duration/frame against an expected length, black stretches, frozen picture, head/tail silence, integrated loudness and true peak against a platform target (web, social, streaming, broadcast, none). Returns pass/fail with findings. Works on drafts and finals.

| Parameter | Type | Notes |
|---|---|---|
| `assetId` | string | required |
| `target` | web \| social \| streaming \| broadcast \| none | default "web" |
| `expectedDurationS` | number | optional |
| `expectedWidth` | integer | optional |
| `expectedHeight` | integer | optional |
| `toleranceFrames` | number | default 1 |

## Render

### `render_draft`

Fast low-resolution (≤640×360) preview of the current timeline with every effect, caption and mix applied — seconds, not minutes, and free. Waits up to 50 s and returns the draft asset id + file path; a longer render returns {started:true} — call render_status, then draft_result. Then use get_frame / get_contact_sheet / detect_silences on the draft asset to check the result.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `wait` | boolean | default true |

### `render_final`

Full-quality export at the project's frame and codec. Generates any AI shots / TTS narration first (those cost credits and can take minutes); pure edits of uploaded media assemble in seconds to minutes. Waits up to 50 s; a longer render returns {started:true} — poll render_status, then final_result. Returns the final asset id and its file path.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `wait` | boolean | default true |

### `render_status`

Project status (DRAFT / RENDERING / DONE / FAILED), render progress %, error, and the current final and draft asset ids.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `cancel_render`



| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `export_formats`

Which codecs this machine can export (H.264, HEVC, AV1, VP9, ProRes) and whether each runs on the GPU; plus the cost preview of a full render.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

## Guide

### `search_guide`

Find the guide sections (rules + rationale + which tool to use) that bear on a question: pacing, dialogue cuts, montage, transitions, music, loudness, captions, documentary ethics, short-form, agent workflows. Returns section ids for read_guide.

| Parameter | Type | Notes |
|---|---|---|
| `query` | string | required |
| `limit` | integer | default 5 |
| `rulesOnly` | boolean | default false |

### `read_guide`

Full text of a chapter (by number, e.g. "17", or name) or a section id from search_guide. Use before doing a kind of edit you have not done in this session.

| Parameter | Type | Notes |
|---|---|---|
| `section` | string | required |

### `list_guide`

Chapters and section ids of the editing guide, plus the playbook names.

### `get_playbook`

Step-by-step procedure (tools + the guide's rules) for a common job. Names: see list_guide. Read it before starting the job; follow its verification steps before reporting done.

| Parameter | Type | Notes |
|---|---|---|
| `name` | string | required |

## Other

### `generate_narration`

Synthesize one narrator line with the TTS model and place it on the timeline as an audio-only clip at offsetS (audible, ducks the music, levelled with volume). One call per line: an ad's six lines become six clips you can move and level separately. Costs credits (~$0.015 per 1k characters). Returns the clip id + duration and the updated project. (The raw route only files the clip in the media bucket, where the render and the checks never see it — this tool puts it on the timeline.)

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `text` | string | required |
| `offsetS` | number | required; timeline second the line starts |
| `voice` | string | optional; ara | eve | rex | sal | leo (Grok Voice TTS); default rex |
| `instructions` | string | optional; delivery notes the model may honor: pace, tone, mood |
| `volume` | number | optional; gain on the clip (1 = as synthesized) |
| `ttsModel` | string | optional |

### `draft_result`

The latest draft preview's asset id, duration, video stream and file path (after render_draft reported stillRendering).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `final_result`

The latest final export's asset id, duration, video stream, size and file path (after render_final reported stillRendering).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `check_soundtrack`

The audio map of the timeline (guide ch.27–29 and Part II §7 'Sound'): which layers sound when — unmuted shot audio, narration / audio-only clips, the voiceover, the music bed (volume, ducking, fade), audio overlays — and findings: source narration or music bleeding through unmuted shots under the bed or narration (the classic clash), narration clips overlapping, two music sources at once, music that never ducks or never ends, clips past the end, or a silent film. Run before every render_draft.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `check_mix_levels`

Measures a rendered file (the latest draft by default) the way a mixer reads it: short-term loudness in the speech windows (narration clips / voiceover) vs the music-only stretches, the gap between them, and the estimated speech-to-music ratio under speech. Targets (guide Part II §7 'Levels', ch.29): speech windows −14…−16 LUFS for a −14 program, music-only stretches 4–8 LU under the speech, ratio under speech ≥ 12 LU (≥ 8 for music-driven pieces). Run after render_draft; fix with balance_music.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `assetId` | string | optional; a draft or final asset; default: the latest draft |
| `musicDriven` | boolean | default false |

### `balance_music`

Sets musicVolume from measured loudness so the bed sits `gapLu` (default 6) below the narration in the stretches where the music plays alone (with ducking it drops a further ~10 LU under speech). Measures the narration sources (audio-only clips / voiceover) and the music asset; reports the numbers it used. Then render_draft and check_mix_levels.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `gapLu` | number | default 6 |

### `interview_next`

The pre-production interview, one question at a time with multiple choice — like a planning prompt. Pass the person's request and the answers so far ({questionId: value}); get the next question (id, header, question, options with the recommended one marked, multiSelect) or, when everything needed is in, the finished brief to pass to set_brief. Present each question through the host's question UI (Claude Code: AskUserQuestion — one question, the options as given, recommended first labelled '(Recommended)'); in a plain chat, a numbered list. When the question says `agentFills`, write 3–4 concrete options yourself from what you know of the subject (the tool cannot), keep 'Other' last, and store the chosen text as the value. Never ask two questions at once; never ask what the request already answered — put it in `answers` yourself.

| Parameter | Type | Notes |
|---|---|---|
| `request` | string | required; what the person asked for, verbatim |
| `answers` | object | default {}; answers so far, keyed by question id |

### `set_brief`

Record the outcome of the interview (guide Part II §11, playbook 'preproduction'): standalone piece or a scene of a longer video, length, aspect; scripted or not and the genre; where footage comes from (youtube / ai / upload / stock); premise; tone; audience; must-include / avoid; narration, music and text wanted. Stored on the project; status 'draft' until approve_plan. Replaces the whole brief — pass everything.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `brief` | object | required |

### `get_brief`

The stored brief (null until set_brief).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `set_plan`

Store the proposed plan — logline, beats (contiguous, cover the runtime), script lines (narration / bite / text with atS), shots in order (durationS, description, source {youtube+clipId | ai+prompt | upload | card}, sound sync|muted|vo, text, transition), clipList (what to search for, per clip), aiShots (prompt + model + length per AI shot), music, narration voice. Validated, versioned (v1, v2…), status 'proposed'; returns the mechanical check (length vs brief, pacing norm, sources, narration density and overlaps, caps, AI cost) and the path of plan-v<N>.md. Fix every error, then show the person plan_document and wait for their yes before approve_plan.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `plan` | object | required |

### `get_plan`

The stored plan with the brief and the current check (null until set_plan).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `check_plan`

Mechanical check of the stored plan against the brief: total length, average shot length vs the genre norm (ch.16), beats, every shot's source resolvable, narration density (≤ 2 w/s) and overlaps, narration over sync-sound shots, caps (segments, AI shots, text cards), AI generation cost, scene-of-a-longer-video constraints. Errors block approval.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `plan_document`

The plan as the person reads it in a terminal. Default 'table': box-drawn tables — beats, then a two-column AV script (one row per shot: # / at / len / sound / VIDEO = picture, source, card / AUDIO = the narration and bite lines over it), clips to find, AI shots — followed by music, narration, risks and the check. 'list' is the same as an indented list; 'markdown' has markdown tables (also written to plan-v<N>.md). Paste the output into your reply VERBATIM inside a code block, do not summarize it (RULES 2: propose-and-approve).

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `format` | table \| list \| markdown | default "table" |
| `width` | integer | default 110; table: total columns |

### `approve_plan`

Record the person's approval of the current plan (and brief). Call ONLY after they said yes to plan_document. Sourcing, generation and cutting follow from an approved plan.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `plan_tasks`

The approved plan as tasks with dependencies: one 'source:<clipId>' per clip to find, one 'ai:<shotId>' per AI shot, 'narration' (all lines), 'music' — none of these depend on each other, so run them in parallel (sub-agents, or source_clips / generate_ai_shots / generate_narration in a batch); then 'assemble' (needs all of them), 'titles', 'checks', 'draft', 'final'. `parallelNow` lists what can start immediately.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |

### `storyboard_sheet`

One captioned frame per shot of the main sequence (index · start · length · sync/mute · title card) tiled as a storyboard — for YOUR eyes when reviewing a cut (the person's terminal shows no images: give them the file path and the shot list in text). Needs shots on the timeline.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `cols` | integer | default 4 |
| `width` | integer | default 400; cell width in px |

### `list_video_models`

The AI video models this build can generate with (id, label, price per second, clip lengths, notes such as public-figure blocks), plus TTS voices and chat models.

### `search_youtube`

Search YouTube (yt-dlp, no download): id, url, title, channel, duration, views per result. Filter by duration. Prefer archives, official channels and Creative Commons uploads; the licence isn't in the search page — check the video page when it matters. Then import_youtube a ≤ 180 s section.

| Parameter | Type | Notes |
|---|---|---|
| `query` | string | required |
| `max` | integer | default 8 |
| `minDurationS` | number | optional |
| `maxDurationS` | number | optional |

### `source_clips`

For each clip spec (default: the approved plan's clipList): search YouTube with its queries, rank the candidates (must-have words in the title, preferred channels, duration hint, views; penalises reactions/compilations), and import a section of the best one (the shot's planned section, else the first ≤ 180 s). Runs the clips in parallel and returns what it picked, the alternatives, and the new segment ids to poll with get_project. Handles at most `maxClips` per call and lists the rest in `remaining` — call again. For precision (a specific quote, a specific moment) send a clip-scout sub-agent instead: search_youtube → import → get_contact_sheet / transcribe → pick.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `clips` | array | optional; explicit specs; default: the plan's clipList (+ each shot's planned section) |
| `maxClips` | integer | default 6 |
| `candidatesPerQuery` | integer | default 6 |

### `add_ai_shot`

Create an AI-generated shot from a prompt and start generating it (costs credits: see list_video_models for price per second and the clip lengths each model makes; Veo blocks public figures). The segment appears at the end of the main sequence with status PENDING/GENERATING; poll get_project for READY, then trim/reorder like any clip.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `prompt` | string | required |
| `durationS` | integer | default 5 |
| `model` | string | optional; default: the build's default video model |
| `referenceImageAssetId` | string | optional |

### `generate_ai_shots`

Start every AI shot in the approved plan (aiShots[]) in one go — each becomes a generating segment at the end of the main sequence. Returns shotId → segmentId so the assemble step can reorder. Costs credits; the plan's check states the estimate.

| Parameter | Type | Notes |
|---|---|---|
| `projectId` | string | required |
| `onlyShotIds` | array | optional |

## Resources

- `slopstudio://guide` — Editing guide (table of contents)
- `slopstudio://projects` — Projects
- `slopstudio://projects/{projectId}`, `slopstudio://guide/{sectionId}`, `slopstudio://playbooks/{name}` (templates)

## Prompts

- `playbook` — Start a job with its playbook, the always-on rules and the project context.
- `edit_video` — A playbook for turning a source clip into a finished edit with these tools.
- `interview` — One question at a time, multiple choice, recommended answer first — the questions that pin a new piece down before any footage is touched; then set_brief.
- `preproduction` — From an approved-or-draft brief, author the plan per the playbook, store and check it, present the document, wait for approval, then fan out.
