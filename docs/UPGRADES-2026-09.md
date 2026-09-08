# Dependency audit & upgrade opportunities — 2026-09-08

Audit of everything SlopStudio-Omarchy runs on (JS packages, ffmpeg, external tools,
the Python audio stack), what was updated, what was deliberately held back, and — the
useful part — which **product features** the newer versions make possible.

## 1. Status

| Component | Was | Now | Upstream latest | Notes |
|---|---|---|---|---|
| ffmpeg (system, Omarchy) | 9.0.1 | 9.0.1 | n9.0.1 | Current. VAAPI H.264/HEVC encode verified on Intel UHD 620; AV1 encode and QSV are not available on this GPU generation. |
| ffmpeg (bundled in the AppImage) | 7.0.2 static (Aug 2024, no VAAPI) | **BtbN n9.0 static** via `scripts/fetch-ffmpeg.sh` | 9.0.1 | Verified: VAAPI/QSV/Vulkan, libplacebo, libx265, SVT-AV1, libvidstab, librubberband, libass, lut3d. Packaged app now gets hardware export. |
| yt-dlp | 2026.08.19 | 2026.08.19 | 2026.08.19 | Current (pacman). |
| Deno (yt-dlp challenge solver) | 2.9.5 | 2.9.5 | 2.9.6 | Pacman will pick it up. |
| Python audio stack | torch 2.14 / torchaudio 2.11 / torchcodec 0.16 / demucs 4.1 / whisper 20250625 | same | same | Current (CPU wheels). |
| Node (dev, `mise.toml`) | 22.23.2 LTS | 22.23.2 | 24.20 LTS | Electron 44 embeds Node 24.18, so the *packaged* server already runs on 24. Moving dev to 24 is a one-line change once Electron's installer is confirmed on it (Node 26 broke it). |
| Electron | 33.4.11 | **44.2.0** | 44.2.0 | Chromium 152, Node 24.18. No breaking change touches this app (removed: Unity DE, macOS 12, 32-bit builds). Fixes 7 audit highs. |
| electron-builder | 25.1.8 | **26.15.3** | 26.15.3 | Fixes the electron-updater advisories. |
| Next.js | 16.2.6 | **16.3.4** | 16.3.4 | Fixes 4 highs (SSRF in rewrites/Server Actions, middleware bypass, DoS). |
| React / react-dom | 19.2.4 | **19.2.8** | 19.2.8 | |
| Prisma | 6.19.3 | 6.19.3 | 7.10.0 (8.0 rc) | **Held** — see §3. |
| TypeScript | 5.9.3 | 5.9.3 | 7.0.2 | **Held** — native (Go) compiler; wait for Next/ESLint plugin support. |
| ESLint | 9.39.5 | 9.39.5 | 10.10 | **Held** — `eslint-config-next` 16.3's `eslint-plugin-react` fails on ESLint 10 (`getFilename is not a function`). Retry when Next ships an ESLint-10-ready config. |
| PixiJS / pixi-filters | 8.18.1 | **8.20.1** | 8.20.1 | WebGPU renderer path for the planned compositor. |
| wavesurfer.js, zod, zustand, tailwind, tsx, fontsource, @node-rs/argon2, react-rnd | minors | **latest minors** | | |
| concurrently / wait-on | 9 / 8 | 9 / 8 | 10 / 9 | Dev-only; held, no benefit. |
| `pnpm audit` | 2 critical · 44 high · 43 moderate · 7 low | **0 / 0 / 0 / 0** | | Via the bumps above + same-major floors in `pnpm-workspace.yaml` overrides. |

## 2. What the updates unlock — feature candidates

Effort: **S** = a day or less, **M** = a few days, **L** = a sprint. "Both builds" means the
filter/encoder exists in Omarchy's system ffmpeg *and* the new bundled static build, so
it works in dev and in the AppImage.

### Export & delivery (ffmpeg 9 + hardware in the bundle)
1. **Hardware export in the packaged app** — *done by the bundle swap*: the capability
   probe already validates `h264_vaapi`, so AppImage users on Intel/AMD get GPU H.264.
2. **HEVC / H.265 export preset (S–M).** `hevc_vaapi` (GPU) / `libx265` (CPU), both
   builds. ~40–50 % smaller files at the same quality — the natural companion to the new
   4K frame sizes. Needs: probe + validate `hevc_*` in `capabilities.ts`, a codec choice in
   the Export dialog, `-tag:v hvc1` for Apple players.
3. **AV1 export (M).** `libsvtav1` (CPU, both builds); `av1_vaapi` on Gen12+/Arc GPUs.
   Best size/quality for YouTube & web; slow on a laptop CPU, so keep it opt-in.
4. **WebM (VP9 + Opus) and ProRes 422 (`prores_ks`) outputs (S each).** Web delivery and
   hand-off to Premiere/Resolve.
5. **More audio mixdown formats (S).** Opus / MP3 / FLAC alongside the Audio Studio's WAV.
6. **Import of H.266/VVC and AV1 sources (S).** Both decode already (`vvc`, `libdav1d`);
   only the upload allow-list needs the extensions.

### Effects & finishing (filters present in both builds)
7. **Stabilization (M).** `vidstabdetect` → `vidstabtransform` two-pass; already on the
   roadmap (MORNING-NOTES "stabilization (two-pass) in export").
8. **Custom LUT color looks (M).** `lut3d` / `haldclut` with user-uploaded `.cube` files;
   extend `COLOR_LOOKS` with "Custom LUT…". Preview approximates; export is exact.
9. **Denoise / sharpen / deinterlace effects (S each).** `hqdn3d`, `nlmeans`, `cas`,
   `unsharp`, `bwdif` as new entries in the effect registry (`src/config/effects.ts`).
10. **True slow motion (M).** `minterpolate` frame interpolation for speeds < 1× (export
    only; expensive).
11. **Deshake (S).** Single-pass `deshake` for quick fixes when two-pass stabilization is
    overkill.
12. **HDR phone footage → SDR (M).** `libplacebo` (GPU) or `zscale`+`tonemap`: fixes the
    washed-out look of iPhone HDR clips on an SDR timeline.
13. **GPU compositing for 4K timelines (L).** `scale_vaapi` / `overlay_vaapi` filter graph
    to keep 4K renders off the CPU.
14. **Styled captions via libass (M).** `subtitles` / `ass` instead of `drawtext`: fonts,
    outlines, positioning, fades, karaoke-style word highlighting.

### Audio Studio
15. **Pitch-preserving tempo & pitch shift (S–M).** `rubberband` (both builds); clip speed
    currently uses `atempo`.
16. **RNN noise suppression (S–M).** `arnndn` — needs a bundled `.rnnn` model file.
17. **Speech leveler (S).** `speechnorm` as a one-click voice-over normalize.
18. **Audiogram export (M).** `showwaves` / `showspectrum` over a still → a video for
    podcast/social clips; bridges Audio Studio → Assembly.

### Preview & UI (Electron 44 = Chromium 152; PixiJS 8.20)
19. **WebGPU renderer for the planned PixiJS compositor (L).** Chromium 152 ships stable
    WebGPU; PixiJS 8 has a WebGPU backend — roadmap item #7.
20. **WebCodecs-based preview (L).** `VideoDecoder`/`VideoFrame` for frame-accurate
    scrubbing; the perf plan in `docs/SLOPSTUDIO.md` already points here.
21. **Faster startup (free).** Electron 44 boots from a Node startup snapshot and speeds
    up `ELECTRON_RUN_AS_NODE` children — i.e. the embedded Next server.

### Packaging & platform
22. **Prisma 7 — Rust-free client (M–L).** Removes the query-engine binary from the
    AppImage (the exact pain point in `docs/DESKTOP.md` milestone 3). Requires: the
    `prisma-client` generator with an output dir, `prisma.config.ts`, driver adapters
    (`@prisma/adapter-better-sqlite3` / `@prisma/adapter-pg`), ESM client. This repo's
    dual Postgres/SQLite client setup needs a redesign around adapters → its own change.
23. **TypeScript 7 (L risk).** ~10× faster type-checks with the native compiler, but
    wait for `next lint`/typescript-eslint support.
24. **Node 24 for dev (S).** Matches Electron's embedded Node; verify Electron's postinstall
    (the Node 26 `extract-zip` hang) before flipping `mise.toml`.

### Not available here (checked)
- ffmpeg's **`whisper` filter** (whisper.cpp) is not compiled into Arch's or BtbN's
  builds — keep the Python Whisper path for captions.
- **QSV** fails on this laptop (Gen9.5 UHD 620 isn't supported by the oneVPL runtime)
  and **AV1 hardware encode** needs Gen12+/Arc — VAAPI H.264/HEVC is the path here.

## 3. Held back, and why
- **Prisma 7** — schema/config/generator/ESM migration plus driver adapters; see #22.
- **TypeScript 7** — new compiler; ecosystem plugins not there yet.
- **@types/node 26** — kept at 22 on purpose to match the pinned dev runtime.
- **concurrently 10 / wait-on 9** — dev-only, no benefit, small breakage risk.
- **ESLint 10** — tried; Next's React plugin isn't compatible yet (see table).

## 4. Keeping it current
- JS: `pnpm outdated` → `pnpm update` for minors; `pnpm audit` should stay at zero (floors
  live in `pnpm-workspace.yaml` → `overrides`; remove one when the tree no longer needs it).
- ffmpeg: system via `pacman`; bundle via `scripts/fetch-ffmpeg.sh` (bump `FFMPEG_RELEASE`
  for the next major; BtbN's `latest` release tracks the release branch).
- yt-dlp/Deno: `pacman`. Python stack: `~/.slopstudio-py/bin/pip list --outdated`.
