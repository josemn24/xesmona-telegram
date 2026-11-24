# Production image for Railway: one Node process (apps/server) that also serves the Mini Apps'
# static files (ADR 0002). Built with Docker rather than auto-detection so Node and pnpm are the
# versions the repo pins (.nvmrc, packageManager).

FROM node:24-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@xesmona/server --filter=@xesmona/miniapp-games

# The server bundles the internal packages (tsup noExternal), so it only needs its production
# dependencies. The layout keeps apps/server/dist/../../miniapp-games/dist, where the server
# looks for the Mini App (apps/server/src/index.ts).
RUN pnpm --filter @xesmona/server deploy --prod /app/apps/server \
  && mkdir -p /app/apps/miniapp-games \
  && cp -r apps/miniapp-games/dist /app/apps/miniapp-games/dist

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/apps/server
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
