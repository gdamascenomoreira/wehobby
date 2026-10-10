# syntax=docker/dockerfile:1
# Edge image: Caddy serving the web build and proxying /api to the API.
# Build from the repo root: docker build -f web/Dockerfile -t wehobby-web .

ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2.10-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY web/package.json web/
RUN npm ci --workspace @wehobby/shared --workspace @wehobby/web --include-workspace-root
COPY packages/shared packages/shared
COPY web web
RUN npm run build --workspace @wehobby/web

FROM ${CADDY_IMAGE} AS runtime
COPY web/Caddyfile /etc/caddy/Caddyfile
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
COPY --from=build /app/web/dist /srv
# The admin API only listens on localhost inside the container.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:2019/config/ || exit 1
