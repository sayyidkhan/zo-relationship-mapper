#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${ZO_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${ZO_BRANCH:-main}"

cd "$APP_DIR"

if [ -d .git ]; then
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and add OPENAI_API_KEY and EXA_API_KEY." >&2
  exit 1
fi

npm ci
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"
npm run build

if [ "${ZO_SYNC_ONLY:-0}" = "1" ]; then
  echo "Zo sync/build complete."
  exit 0
fi

exec npm run start
