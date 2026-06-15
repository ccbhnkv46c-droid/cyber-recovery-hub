# Cyber Recovery Hub — production container (Debian for Prisma OpenSSL compatibility)
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN echo "=== Docker builder image: node:20-bookworm-slim ===" \
  && node -p "process.platform + ' ' + process.version"

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_PORT=3001
ENV USE_INTERNAL_API=true
ENV RAILWAY_ENVIRONMENT=production
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

RUN rm -rf node_modules/.prisma node_modules/@prisma/client
RUN npm install @prisma/client@5.22.0 prisma@5.22.0
RUN npx prisma generate --schema=prisma/schema.prisma
RUN echo "=== Prisma query engines (builder) ===" \
  && ls -1 node_modules/.prisma/client/ | grep query_engine \
  && ! ls node_modules/.prisma/client/ | grep -q musl

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home crh \
  && mkdir -p uploads \
  && chown -R crh:nodejs uploads

RUN echo "=== Docker runner image: node:20-bookworm-slim ==="

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV API_PORT=3001
ENV API_HOST=0.0.0.0
ENV TRUST_PROXY=true

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts ./scripts

RUN echo "=== Prisma query engines (runner) ===" \
  && ls -1 node_modules/.prisma/client/ | grep query_engine \
  && ! ls node_modules/.prisma/client/ | grep -q musl \
  && echo "=== OK: debian engine only, no musl ==="

RUN chmod +x ./scripts/start-production.sh && chown -R crh:nodejs /app
USER crh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3000/api/health" || exit 1

CMD ["./scripts/start-production.sh"]
