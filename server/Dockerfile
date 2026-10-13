# Build context: thư mục gốc repo (cần cả server/ và shared/)
FROM node:22-bookworm-slim AS base
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY shared /app/shared
COPY server /app/server
# generate không kết nối DB, nhưng prisma.config.ts cần biến DATABASE_URL
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

# Dev: nest start --watch (mã nguồn được mount từ máy)
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3001
CMD ["npx", "nest", "start", "--watch", "--preserveWatchOutput"]

FROM base AS build
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS prod
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/server/src/main"]
