#!/usr/bin/env bash
# Start BucksFlow API on :8080 and Vite on :5173 (default).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ss -tlnp 2>/dev/null | grep -q ':8080'; then
  if pgrep -f 'docker-proxy.*8080' >/dev/null 2>&1; then
    echo "Port 8080 is used by Docker. Stopping containers (sudo may prompt)..."
    sudo docker stop "$(sudo docker ps -q)" 2>/dev/null || true
  fi
  fuser -k 8080/tcp 2>/dev/null || true
  sleep 2
fi

pkill -f 'go run ./cmd/api' 2>/dev/null || true
pkill -f 'vite --host' 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

export PORT=8080
echo "Starting API on http://localhost:8080 ..."
go run ./cmd/api &
API_PID=$!

sleep 3
if ! curl -sf http://localhost:8080/api/v1/health >/dev/null; then
  echo "API failed to start on 8080. Check logs above."
  exit 1
fi

echo "Starting frontend on http://localhost:5173 ..."
cd "$ROOT/frontend"
npm run dev -- --host &
echo "API PID: $API_PID | Frontend: npm run dev"
wait
