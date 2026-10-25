# Build context: repository root. The image is Caddy with the built app inside:
# it terminates TLS, serves the SPA and proxies the API (see deploy/Caddyfile).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build --workspace @football-planner/shared \
  && npm run build --workspace apps/web --ignore-scripts

FROM caddy:2.11.7-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443 443/udp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
