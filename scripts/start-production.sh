#!/bin/sh

API_PORT="${API_PORT:-3001}"
API_HOST="${API_HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
API_LOG="/tmp/crh-api.log"

echo "[startup] Cyber Recovery Hub"
echo "[startup]   Express API -> ${API_HOST}:${API_PORT}"
echo "[startup]   Next.js web -> 0.0.0.0:${PORT}"
echo "[startup]   Proxy target -> http://127.0.0.1:${API_PORT}/api/*"

if [ -n "$DATABASE_URL" ] && [ "$RUN_DB_PUSH" = "true" ]; then
  echo "[startup] Applying Prisma schema..."
  npx prisma db push --skip-generate || echo "[startup] WARNING: db push failed (continuing)"
fi

if [ "$RUN_DB_SEED" = "true" ]; then
  echo "[startup] RUN_DB_SEED=true — seeding database..."
  node scripts/prisma-seed.cjs || exit 1
elif [ -n "$DATABASE_URL" ]; then
  echo "[startup] Checking whether database needs seeding..."
  node scripts/check-and-seed.cjs || exit 1
fi

: > "$API_LOG"

echo "[startup] Launching Express API (tsx server/index.ts)..."
./node_modules/.bin/tsx server/index.ts 2>&1 | tee -a "$API_LOG" &
API_PID=$!

TRIES=0
HTTP_CODE="000"
while [ "$TRIES" -lt 45 ]; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[startup] FATAL: API process exited before becoming ready (pid ${API_PID})"
    cat "$API_LOG"
    exit 1
  fi
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
    echo "[startup] API listening on 127.0.0.1:${API_PORT} (health HTTP ${HTTP_CODE}, pid ${API_PID})"
    break
  fi
  TRIES=$((TRIES + 1))
  sleep 2
done

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "503" ]; then
  echo "[startup] FATAL: API not reachable after 90s (last health HTTP ${HTTP_CODE})"
  cat "$API_LOG"
  kill "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "[startup] Launching Next.js (next start -p ${PORT})..."
./node_modules/.bin/next start -p "$PORT" -H 0.0.0.0 &
WEB_PID=$!

sleep 3
if ! kill -0 "$WEB_PID" 2>/dev/null; then
  echo "[startup] FATAL: Next.js exited immediately (pid ${WEB_PID})"
  cat "$API_LOG"
  kill "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "[startup] Both processes running — API pid ${API_PID}, Web pid ${WEB_PID}"

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 10
done

echo "[startup] A process exited"
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "[startup] API process died — last log output:"
  cat "$API_LOG"
fi
if ! kill -0 "$WEB_PID" 2>/dev/null; then
  echo "[startup] Next.js process died"
fi
exit 1
