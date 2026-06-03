# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder ----
FROM base AS builder
# Subpath the app is served under (e.g. /vid). Empty = root. NEXT_PUBLIC_* is
# inlined into the client bundle at build, so it must be set here.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Media + YouTube-import tooling: ffmpeg (assembly), yt-dlp (download/clip), and
# Deno (runs yt-dlp's EJS solver for YouTube's n-challenge). The standalone
# yt-dlp binary extracts to /tmp at runtime — fine in a container (/tmp is exec,
# unlike the noexec tmpfs on the dev host).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
       -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && yt-dlp --version && deno --version
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
# Self-contained admin bootstrap: `docker compose exec app pnpm create-admin …`
COPY --from=builder /app/scripts/create-admin.ts ./scripts/create-admin.ts
EXPOSE 3000
# migrate then boot (the worker starts via instrumentation.ts).
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
