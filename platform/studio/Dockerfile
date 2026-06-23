FROM node:20-slim

# Native build deps + Playwright/Chromium system libraries
RUN apt-get update && apt-get install -y \
  python3 make g++ \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 libx11-6 libxext6 \
  fonts-liberation wget && \
  rm -rf /var/lib/apt/lists/*

# corepack picks up pnpm version from packageManager field in package.json
RUN corepack enable

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Download Chromium for Playwright (needed by scrape-g2.ts)
RUN PLAYWRIGHT_BROWSERS_PATH=/ms-playwright pnpm exec playwright install chromium

# SQLite DB lives here - mount /data as a volume in Coolify for persistence
RUN mkdir -p /data
ENV DATABASE_URL=/data/burningdemand.db

EXPOSE 3000

# Dev server keeps the /api/run-script scraper endpoint alive
CMD ["pnpm", "dev", "--host"]
