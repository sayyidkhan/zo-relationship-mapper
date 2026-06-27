#!/usr/bin/env bash
set -euo pipefail

npm ci
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"
npm run build
npm run start
