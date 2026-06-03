#!/usr/bin/env bash
# Manage the local user-owned Postgres instance for SpotForge dev (no sudo).
# Usage: scripts/pg.sh {start|stop|status|psql}
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/17/bin}"
DATA="$(cd "$(dirname "$0")/.." && pwd)/.data/pg"
PORT="${PGPORT:-5434}"

case "${1:-status}" in
  start)
    "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/logfile" -o "-p $PORT -k /tmp" start
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DATA" stop
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$DATA" status
    ;;
  psql)
    PGPASSWORD=spotforge_dev "$PGBIN/psql" -h localhost -p "$PORT" -U spotforge -d spotforge
    ;;
  *)
    echo "usage: $0 {start|stop|status|psql}" >&2
    exit 1
    ;;
esac
