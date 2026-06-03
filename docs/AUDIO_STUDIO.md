# Audio Studio

A DAW-style, audio-only workspace — a fourth startup mode alongside Storyboard,
Assembly, and Open Project. Launch it from `/start` → **Audio Studio**
(`NewAudioStudioCard`), which creates a project and opens
`/projects/<id>?ws=audio-studio` with the audio panel preset.

## Architecture

- **No new route** — it's a regular project opened with the `?ws=audio-studio`
  workspace preset (`src/config/studio-presets.ts`). The server reads `?ws` and passes
  it down (`app/projects/[id]/page.tsx` → `ProjectWorkspace` → `StudioRoot` →
  `WorkspaceShell.applyPreset`).
- **Panels** are registered in `src/components/studio/PanelRegistry.ts` (types in
  `src/types/panel.ts`) and arrange via the `audio-studio` preset:
  | Panel | File | What it does |
  |---|---|---|
  | Audio Importer | `AudioImporterPanel` | drag/drop import (mp3/wav/m4a/flac/ogg/aac) |
  | Visualizer | `AudioVisualizerPanel` | bars / spectrum / waveform (Web Audio + wavesurfer.js) |
  | Stem Separation | `StemSeparationPanel` | **Demucs** — split a mix into stems |
  | Multitrack Timeline | `AudioMultitrackPanel` | N audio tracks |
  | Processing Rack | `AudioProcessingPanel` | roll-off, denoise, EQ, de-esser, compressor, gain, fades, LUFS normalize (ffmpeg filters) |
  | Audio Tools | `AudioToolsPanel` | ducking, silence trim, tempo, captions |
  | Loudness Meter | `LoudnessMeterPanel` | LUFS metering |
- **Shared state:** `src/stores/audioStudioStore.ts` (imported audio is shared across
  all panels). **Server libs:** `src/lib/audio/` (`demucs.ts`, `whisper.ts`, `dsp.ts`,
  `analyze.ts`, `workspace.ts`, `binaries.ts`, `jobs.ts`). **API:** `src/app/api/audio/*`
  (`upload`, `stems`, `process`, `tools`, `analyze`, `transcribe`, `file`, `jobs/[id]`).
- **Jobs:** long tasks (Demucs, Whisper) are fire-and-forget — the route returns a
  `jobId` and the client polls `GET /api/audio/jobs/[id]` for `{status, progress, result, error}`.

## Dependencies

Stem separation and captions need a local **Python ML stack** (demucs, torch,
torchaudio, **torchcodec**, openai-whisper). **See [DEPENDENCIES.md §4](DEPENDENCIES.md#4-audio-studio--python--ml-stack-optional-heavy).**
The rest of Audio Studio (import, visualize, EQ/processing via ffmpeg, loudness) works
without Python.

> The processing/visualization panels need only ffmpeg + the browser. **Demucs** and
> **Whisper** are the only Python-gated features, and they degrade gracefully (the
> panel shows the job error) when the stack is missing.

## Known gotcha

If Demucs reports `ImportError: TorchCodec is required for save_with_torchcodec`,
install `torchcodec` (`pip install torchcodec`) — torchaudio ≥2.8 needs it to *write*
the stems. Separation runs, then fails on save without it.
