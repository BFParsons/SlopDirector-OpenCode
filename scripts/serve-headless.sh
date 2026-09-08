#!/usr/bin/env bash
# Run the SlopStudio server WITHOUT the Electron shell — for an agent harness
# (MCP), CI, or a box with no display. Same embedded SQLite + in-process worker
# as the desktop app; the open editor (if any) and the API share one state.
#
#   scripts/serve-headless.sh            # production bundle (built when stale) on :38473
#   scripts/serve-headless.sh --dev      # next dev on the same port (hot reload)
#   PORT=4100 scripts/serve-headless.sh  # another port
#
# Auth: SLOPSTUDIO_DESKTOP=1 (default) = single local user, no login. For a
# multi-user server keep SLOPSTUDIO_DESKTOP unset and give agents
# SLOPSTUDIO_API_TOKEN (sent as `Authorization: Bearer …`), optionally with
# SLOPSTUDIO_API_TOKEN_USER=<email> to pick the account it acts as.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE=prod
for a in "$@"; do
  case "$a" in
    --dev) MODE=dev ;;
    --prod) MODE=prod ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
  esac
done

# .env fills in defaults; anything already set in the environment wins.
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    key="${key#export }"
    [ -n "${!key+x}" ] && continue
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    export "$key=$val"
  done < .env
fi
export SLOPSTUDIO_DB="${SLOPSTUDIO_DB:-sqlite}"
export SLOPSTUDIO_DESKTOP="${SLOPSTUDIO_DESKTOP:-1}"
export WORKER_ENABLED=true
export PORT="${PORT:-38473}"
BIND="${BIND_HOST:-127.0.0.1}"

if [ "$MODE" = "dev" ]; then
  echo "SlopStudio headless (dev) on http://$BIND:$PORT"
  exec pnpm exec next dev -H "$BIND" -p "$PORT"
fi

SERVER=".next/standalone/server.js"
if [ ! -f "$SERVER" ] || [ -n "$(find src prisma public next.config.ts package.json scripts/postbuild-standalone.mjs -newer "$SERVER" -print -quit 2>/dev/null)" ]; then
  echo "Building the production bundle (first run / sources changed)…"
  pnpm desktop:standalone
fi
export NODE_ENV=production
export HOSTNAME="$BIND"
export SLOPSTUDIO_SCHEMA_SQL="$PWD/prisma/desktop-schema.sql"
echo "SlopStudio headless on http://$BIND:$PORT (db=$SLOPSTUDIO_DB, desktop-auth=$SLOPSTUDIO_DESKTOP${SLOPSTUDIO_API_TOKEN:+, bearer token set})"
exec node "$SERVER"
