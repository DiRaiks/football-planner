# Build context: repository root (see docker-compose.yml)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts
COPY apps/server apps/server
COPY packages/shared packages/shared
RUN npm run build --workspace @football-planner/shared \
  && npm run build --workspace apps/server --ignore-scripts \
  && npm prune --omit=dev --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
# TODO(A4): switch to `USER node` once TLS terminates at Caddy; the app reads root-owned
# certificates mounted from the host while it still serves HTTPS itself.
WORKDIR /app/apps/server
EXPOSE 3000
CMD ["node", "dist/index.js"]
