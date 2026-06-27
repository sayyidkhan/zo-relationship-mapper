#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${ZO_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PORT="${PORT:-8000}"
LOG_DIR="${ZO_LOG_DIR:-$APP_DIR/logs}"
PID_FILE="${ZO_PID_FILE:-$LOG_DIR/zo-deploy.pid}"
LOG_FILE="${ZO_LOG_FILE:-$LOG_DIR/zo-deploy.log}"

mkdir -p "$LOG_DIR"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID"
    sleep 1
  fi
fi

cd "$APP_DIR"

nohup env PORT="$PORT" bash "$APP_DIR/scripts/zo-deploy.sh" > "$LOG_FILE" 2>&1 &
NEW_PID="$!"
echo "$NEW_PID" > "$PID_FILE"

echo "Started Zo deploy on port $PORT with pid $NEW_PID"
echo "Logs: $LOG_FILE"
