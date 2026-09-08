#!/usr/bin/env bash
# Manage the local user-owned Postgres instance for SlopStudio Pro dev (no sudo).
# Usage: scripts/pg.sh {init|start|stop|status|psql}
#
# PGBIN auto-detects the server binaries: Arch/Omarchy (/usr/bin), then the
# newest Debian/Ubuntu versioned dir (/usr/lib/postgresql/<ver>/bin). Override
# with PGBIN=/path/to/bin if needed.
set -euo pipefail

detect_pgbin() {
  if [ -x /usr/bin/pg_ctl ]; then echo /usr/bin; return; fi
  local d
  d="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [ -n "$d" ]; then echo "$d"; return; fi
  echo "pg_ctl not found — install the PostgreSQL server (Arch: sudo pacman -S postgresql)" >&2
  exit 1
}

PGBIN="${PGBIN:-$(detect_pgbin)}"
DATA="$(cd "$(dirname "$0")/.." && pwd)/.data/pg"
PORT="${PGPORT:-5434}"
SOCKDIR="${PGSOCKDIR:-/tmp}"
DBUSER="spotforge"
DBPASS="spotforge_dev"
DBNAME="slopstudio_pro"

case "${1:-status}" in
  init)
    # One-time: create the cluster, start it, create the role + database.
    if [ -f "$DATA/PG_VERSION" ]; then echo "cluster already exists at $DATA"; exit 0; fi
    mkdir -p "$DATA"
    "$PGBIN/initdb" -D "$DATA" -U "$DBUSER" --auth=md5 --pwfile=<(echo "$DBPASS") -E UTF8 >/dev/null
    "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/logfile" -o "-p $PORT -k $SOCKDIR" -w start
    PGPASSWORD="$DBPASS" "$PGBIN/psql" -h localhost -p "$PORT" -U "$DBUSER" -d postgres \
      -c "CREATE DATABASE $DBNAME OWNER $DBUSER;"
    echo "initialized: postgresql://$DBUSER:$DBPASS@localhost:$PORT/$DBNAME"
    ;;
  start)
    "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/logfile" -o "-p $PORT -k $SOCKDIR" -w start
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DATA" stop
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$DATA" status
    ;;
  psql)
    PGPASSWORD="$DBPASS" "$PGBIN/psql" -h localhost -p "$PORT" -U "$DBUSER" -d "$DBNAME"
    ;;
  *)
    echo "usage: $0 {init|start|stop|status|psql}" >&2
    exit 1
    ;;
esac
