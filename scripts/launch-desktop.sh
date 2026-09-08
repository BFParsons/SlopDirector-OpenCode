#!/usr/bin/env bash
# SlopStudio Pro — desktop launcher (Linux / Omarchy).
#
#   launch-desktop.sh          dev:  `next dev` (HMR) + Electron window onto :3000
#   launch-desktop.sh --prod   prod: production standalone server spawned by
#                              Electron (no HMR, React production mode, precompiled
#                              routes) — noticeably faster and lighter for daily use.
#                              Rebuilds first when the sources are newer than the
#                              last build. Uses the same .env (DB, assets, keys).
#
# The app-menu entry uses --prod; `pnpm desktop:dev` is the development loop.
set -euo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJ"

MODE="dev"
for a in "$@"; do case "$a" in --prod) MODE="prod";; --dev) MODE="dev";; esac; done

# Node/pnpm are managed by mise on this box; a .desktop launch doesn't go
# through the shell profile, so activate the shims explicitly.
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash --shims)"
fi

# Electron on Hyprland: native Wayland window (already set session-wide on
# Omarchy, but harmless to pin here for launches that bypass the shell env).
export ELECTRON_OZONE_PLATFORM_HINT="${ELECTRON_OZONE_PLATFORM_HINT:-auto}"

if [ "$MODE" = "prod" ]; then
  # The standalone server doesn't read .env — export it so the production run
  # uses the same SQLite DB, asset root and API keys as development.
  if [ -f .env ]; then
    set -a; . ./.env; set +a
  fi
  export SLOPSTUDIO_DB="${SLOPSTUDIO_DB:-sqlite}"

  # Rebuild when there's no build, or anything under src/ prisma/ public/ or the
  # Next config is newer than the last standalone server.
  SERVER=".next/standalone/server.js"
  if [ ! -f "$SERVER" ] || [ -n "$(find src prisma public next.config.ts package.json scripts/postbuild-standalone.mjs -newer "$SERVER" -print -quit 2>/dev/null)" ]; then
    echo "Building the production bundle (first run / sources changed)…"
    pnpm desktop:standalone
  fi
  echo "Starting SlopStudio Pro (production) from $PROJ …"
  # ELECTRON_ARGS: extra Chromium/Electron switches (e.g. --remote-debugging-port=9222)
  # Call the Electron binary directly when present (skips pnpm's own startup).
  # shellcheck disable=SC2086
  if [ -x node_modules/.bin/electron ]; then exec node_modules/.bin/electron electron/main.js ${ELECTRON_ARGS:-}; fi
  # shellcheck disable=SC2086
  exec pnpm exec electron electron/main.js ${ELECTRON_ARGS:-}
fi

# --- dev -------------------------------------------------------------------
# Stop any stale dev server still holding :3000 so Electron connects to the
# right server (Next would otherwise fall back to 3001 and the window would 404).
stale="$(ss -ltnpH 'sport = :3000' 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
if [ -n "$stale" ]; then
  echo "Stopping stale dev server on :3000 (pid $stale)…"
  kill $stale 2>/dev/null || true
  for _ in $(seq 1 20); do ss -ltnH 'sport = :3000' | grep -q . || break; sleep 0.25; done
fi

echo "Starting SlopStudio Pro (desktop, dev) from $PROJ …"
# desktop:dev = `next dev` + Electron window (server + UI). -k kills the
# server when the window closes.
exec pnpm desktop:dev
