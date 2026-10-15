FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/data/im-status-local
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg gosu util-linux && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/worker ./worker
COPY --from=build --chown=node:node /app/scripts ./scripts
EXPOSE 3000
ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]
CMD ["node", "scripts/start.mjs"]
