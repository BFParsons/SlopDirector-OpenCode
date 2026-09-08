#!/usr/bin/env bash
# SlopStudio Pro — desktop launcher (Linux / Omarchy).
# Linux port of scripts/launch-desktop.ps1: starts the Next dev server and opens
# the Electron (Chromium) window onto it. Used by the app-menu entry
# (~/.local/share/applications/slopstudio-pro.desktop).
set -euo pipefail

# Project root = this script's folder's parent (scripts/..), path-independent.
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJ"

# Node/pnpm are managed by mise on this box; a .desktop launch doesn't go
# through the shell profile, so activate the shims explicitly.
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash --shims)"
fi

# Electron on Hyprland: native Wayland window (already set session-wide on
# Omarchy, but harmless to pin here for launches that bypass the shell env).
export ELECTRON_OZONE_PLATFORM_HINT="${ELECTRON_OZONE_PLATFORM_HINT:-auto}"

# Stop any stale dev server still holding :3000 so Electron connects to the
# right server (Next would otherwise fall back to 3001 and the window would 404).
stale="$(ss -ltnpH 'sport = :3000' 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
if [ -n "$stale" ]; then
  echo "Stopping stale dev server on :3000 (pid $stale)…"
  kill $stale 2>/dev/null || true
  for _ in $(seq 1 20); do ss -ltnH 'sport = :3000' | grep -q . || break; sleep 0.25; done
fi

echo "Starting SlopStudio Pro (desktop) from $PROJ …"
# desktop:dev = `next dev` + Electron window (server + UI). -k kills the
# server when the window closes.
exec pnpm desktop:dev
