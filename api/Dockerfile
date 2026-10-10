# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f api/Dockerfile -t wehobby-api .

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
RUN npm ci --workspace @wehobby/shared --workspace @wehobby/api --include-workspace-root
COPY packages/shared packages/shared
COPY api api
RUN npm run build --workspace @wehobby/api

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api/package.json api/
RUN npm ci --workspace @wehobby/api --include-workspace-root=false --omit=dev \
  && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ARG APP_VERSION=unknown
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=3000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json packages/shared/
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/api/package.json api/
COPY --from=build --chown=node:node /app/api/dist api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "api/dist/server.js"]
