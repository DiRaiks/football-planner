# Build stage
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HTTPS_PRIVKEY_PATH=./privkey.pem
ENV HTTPS_FULLCHAIN_PATH=./fullchain.pem
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
EXPOSE 3000
