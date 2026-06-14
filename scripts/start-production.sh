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

# Express API — Next.js rewrites /api/* to this process
npx tsx server/index.ts &
API_PID=$!

# Next.js web front door (Azure App Service routes traffic to PORT)
npx next start -p "$PORT" &
WEB_PID=$!

trap 'kill $API_PID $WEB_PID 2>/dev/null' TERM INT
wait -n $API_PID $WEB_PID
exit $?
