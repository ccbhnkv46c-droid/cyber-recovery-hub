#!/bin/sh
set -e

export API_PORT="${API_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

echo "Starting Cyber Recovery Hub (API :${API_PORT}, Web :${PORT})"

if [ -n "$DATABASE_URL" ] && [ "$RUN_DB_PUSH" = "true" ]; then
  echo "Applying Prisma schema to database..."
  npx prisma db push --skip-generate
fi

# Run Express + Next in the foreground (Railway expects a single long-lived process tree)
exec npx concurrently \
  --kill-others-on-fail \
  --names api,web \
  --prefix-colors blue,green \
  "tsx server/index.ts" \
  "next start -p ${PORT}"
