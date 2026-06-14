# Cyber Recovery Hub — production container for Azure App Service / ACR
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV API_PORT=3001
ENV API_HOST=0.0.0.0
ENV TRUST_PROXY=true

RUN addgroup -g 1001 -S nodejs && adduser -S crh -u 1001 -G nodejs
RUN mkdir -p uploads && chown -R crh:nodejs uploads

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
COPY scripts/start-production.sh ./scripts/start-production.sh

RUN chmod +x ./scripts/start-production.sh && chown -R crh:nodejs /app
USER crh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["./scripts/start-production.sh"]
