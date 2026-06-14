#!/bin/sh
set -e

export API_PORT="${API_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
API_LOG="/tmp/crh-api.log"

echo "Starting Cyber Recovery Hub (API :${API_PORT}, Web :${PORT})"

if [ -n "$DATABASE_URL" ] && [ "$RUN_DB_PUSH" = "true" ]; then
  echo "Applying Prisma schema to database..."
  npx prisma db push --skip-generate
fi

# Express API — Next.js rewrites /api/* to this process
: > "$API_LOG"
npx tsx server/index.ts >>"$API_LOG" 2>&1 &
API_PID=$!

sleep 2
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "Express API failed to start:"
  cat "$API_LOG" 2>/dev/null || true
  exit 1
fi
echo "Express API started (pid $API_PID)"

# Next.js web front door (Railway routes traffic to PORT)
npx next start -p "$PORT" &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' TERM INT

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done

if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "Express API exited unexpectedly:"
  cat "$API_LOG" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  exit 1
fi

wait "$WEB_PID" 2>/dev/null || true
exit 0
