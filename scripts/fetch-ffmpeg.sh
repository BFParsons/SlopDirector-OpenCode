#!/usr/bin/env bash
# Fetch the static ffmpeg/ffprobe bundled into the desktop AppImage (linux x64).
# Binaries are gitignored; run this before `pnpm desktop:build` on a fresh clone.
set -euo pipefail
DEST="$(cd "$(dirname "$0")/.." && pwd)/vendor/ffmpeg"
URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
mkdir -p "$DEST"
if [ -x "$DEST/ffmpeg" ] && [ -x "$DEST/ffprobe" ]; then echo "ffmpeg already present in $DEST"; exit 0; fi
tmp="$(mktemp -d)"
echo "Downloading static ffmpeg…"
curl -fsSL -o "$tmp/ff.tar.xz" "$URL"
tar xf "$tmp/ff.tar.xz" -C "$tmp"
src="$(ls -d "$tmp"/ffmpeg-*-static | head -1)"
cp "$src/ffmpeg" "$src/ffprobe" "$DEST/"
chmod +x "$DEST/ffmpeg" "$DEST/ffprobe"
rm -rf "$tmp"
echo "ffmpeg + ffprobe installed to $DEST"
