#!/usr/bin/env bash
# Fetch the static ffmpeg/ffprobe bundled into the desktop AppImage (linux x64).
# Binaries are gitignored; run this before `pnpm desktop:build` on a fresh clone.
#
# Source: BtbN's FFmpeg-Builds "latest" release, release-branch 9.0 (GPL). Unlike
# the johnvansickle 7.0.2 build this used to fetch (Aug 2024), it includes
# VAAPI + QSV + Vulkan hardware encode/decode, libplacebo, libx265, SVT-AV1,
# libvidstab, librubberband, libass and lut3d — verified 2026-09-08 on an Intel
# UHD 620 (h264_vaapi/hevc_vaapi encode OK). Bump FFMPEG_RELEASE to move majors.
set -euo pipefail
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor/ffmpeg"
FFMPEG_RELEASE="${FFMPEG_RELEASE:-9.0}"
URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n${FFMPEG_RELEASE}-latest-linux64-gpl-${FFMPEG_RELEASE}.tar.xz"
mkdir -p "$DEST"
if [ -x "$DEST/ffmpeg" ] && [ -x "$DEST/ffprobe" ]; then echo "ffmpeg already present in $DEST ($("$DEST/ffmpeg" -version | head -1 | cut -d' ' -f3))"; exit 0; fi
tmp="$(mktemp -d)"
echo "Downloading static ffmpeg ${FFMPEG_RELEASE} (BtbN)…"
curl -fsSL -o "$tmp/ff.tar.xz" "$URL"
tar xf "$tmp/ff.tar.xz" -C "$tmp"
src="$(ls -d "$tmp"/ffmpeg-*/bin | head -1)"
cp "$src/ffmpeg" "$src/ffprobe" "$DEST/"
chmod +x "$DEST/ffmpeg" "$DEST/ffprobe"
rm -rf "$tmp"
echo "ffmpeg + ffprobe installed to $DEST: $("$DEST/ffmpeg" -version | head -1 | cut -d' ' -f3)"
