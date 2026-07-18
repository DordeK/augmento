#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCAL_UVICORN="$PROJECT_ROOT/backend/.venv/bin/uvicorn"

if [[ -x "$LOCAL_UVICORN" ]]; then
  UVICORN="$LOCAL_UVICORN"
elif command -v uvicorn >/dev/null 2>&1; then
  UVICORN="$(command -v uvicorn)"
else
  echo "Backend dependencies are missing. Create backend/.venv and install the backend first." >&2
  exit 1
fi

backend_pid=""

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT HUP INT TERM

echo "Starting Augmento API at http://0.0.0.0:8000"
(
  cd "$PROJECT_ROOT/backend"
  exec "$UVICORN" app.main:app --reload --host 0.0.0.0 --port 8000
) &
backend_pid=$!

sleep 1
if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid" || true
  echo "The backend failed to start. Check the error above." >&2
  exit 1
fi

echo "Starting Expo. Press Ctrl+C to stop both services."
cd "$PROJECT_ROOT"
npm run start -- "$@"
