#!/usr/bin/env bash
# Fetch the static ffmpeg/ffprobe bundled into the desktop build (Linux AppImage or
# macOS .app). Binaries are gitignored; run this before `pnpm desktop:build` /
# `pnpm desktop:build:mac` on a fresh clone. Windows uses scripts/fetch-ffmpeg.ps1.
#
# Linux source: BtbN's FFmpeg-Builds "latest" release, release-branch 9.0 (GPL). Unlike
# the johnvansickle 7.0.2 build this used to fetch (Aug 2024), it includes
# VAAPI + QSV + Vulkan hardware encode/decode, libplacebo, libx265, SVT-AV1,
# libvidstab, librubberband, libass and lut3d - verified 2026-09-08 on an Intel
# UHD 620 (h264_vaapi/hevc_vaapi encode OK). Bump FFMPEG_RELEASE to move majors.
#
# macOS source: Martin Riedl's static builds (https://ffmpeg.martin-riedl.de), one zip
# per binary, arm64 and amd64, "latest release" redirect (9.0.x as of Sep 2026). Set
# FFMPEG_MAC_FFMPEG_URL / FFMPEG_MAC_FFPROBE_URL to pin or swap the source.
set -euo pipefail
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor/ffmpeg"
FFMPEG_RELEASE="${FFMPEG_RELEASE:-9.0}"
mkdir -p "$DEST"
if [ -x "$DEST/ffmpeg" ] && [ -x "$DEST/ffprobe" ]; then echo "ffmpeg already present in $DEST ($("$DEST/ffmpeg" -version | head -1 | cut -d' ' -f3))"; exit 0; fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

case "$(uname -s)" in
  Linux)
    URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n${FFMPEG_RELEASE}-latest-linux64-gpl-${FFMPEG_RELEASE}.tar.xz"
    echo "Downloading static ffmpeg ${FFMPEG_RELEASE} for Linux x64 (BtbN)..."
    curl -fsSL -o "$tmp/ff.tar.xz" "$URL"
    tar xf "$tmp/ff.tar.xz" -C "$tmp"
    src="$(ls -d "$tmp"/ffmpeg-*/bin | head -1)"
    cp "$src/ffmpeg" "$src/ffprobe" "$DEST/"
    ;;
  Darwin)
    case "$(uname -m)" in
      arm64) arch="arm64" ;;
      x86_64) arch="amd64" ;;
      *) echo "Unsupported macOS architecture: $(uname -m)" >&2; exit 1 ;;
    esac
    base="https://ffmpeg.martin-riedl.de/redirect/latest/macos/${arch}/release"
    echo "Downloading static ffmpeg + ffprobe for macOS ${arch} (martin-riedl.de)..."
    curl -fsSL -o "$tmp/ffmpeg.zip" "${FFMPEG_MAC_FFMPEG_URL:-$base/ffmpeg.zip}"
    curl -fsSL -o "$tmp/ffprobe.zip" "${FFMPEG_MAC_FFPROBE_URL:-$base/ffprobe.zip}"
    unzip -qo "$tmp/ffmpeg.zip" -d "$tmp/ffmpeg"
    unzip -qo "$tmp/ffprobe.zip" -d "$tmp/ffprobe"
    cp "$(find "$tmp/ffmpeg" -type f -name ffmpeg | head -1)" "$DEST/ffmpeg"
    cp "$(find "$tmp/ffprobe" -type f -name ffprobe | head -1)" "$DEST/ffprobe"
    # Downloaded binaries carry the quarantine attribute; the .app would refuse to spawn them.
    xattr -d com.apple.quarantine "$DEST/ffmpeg" "$DEST/ffprobe" 2>/dev/null || true
    ;;
  *)
    echo "Unsupported OS: $(uname -s). On Windows run scripts/fetch-ffmpeg.ps1." >&2
    exit 1
    ;;
esac

chmod +x "$DEST/ffmpeg" "$DEST/ffprobe"
echo "ffmpeg + ffprobe installed to $DEST: $("$DEST/ffmpeg" -version | head -1 | cut -d' ' -f3)"
