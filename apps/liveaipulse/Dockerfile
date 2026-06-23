# syntax=docker/dockerfile:1
# Build context: monorepo root
#   docker build -f apps/liveaipulse/Dockerfile .
# In Coolify: Base Directory = "/", Dockerfile = "apps/liveaipulse/Dockerfile"

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS deps
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /repo/apps/liveaipulse
RUN pnpm build
# Create a self-contained production deployment with native deps resolved
WORKDIR /repo
RUN pnpm --filter liveaipulse deploy --legacy --prod /deploy
RUN cp -r /repo/apps/liveaipulse/dist /deploy/dist

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL=/data/app.db
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "dist/server/server.js"]
